/**
 * Scrittura nello store bitemporale.
 *
 * Regola invariabile: **le correzioni non sovrascrivono**. Quando una versione o
 * una relazione cambia, si chiude `knownTo` sulla riga esistente e se ne apre una
 * nuova. Così una segnalazione pubblicata resta riproducibile anche dopo un
 * aggiornamento del corpus, ed è possibile rispondere alla domanda «in base a
 * cosa lo avevate detto, quel giorno?» (ADR 0007).
 *
 * Il costo è che lo store cresce. È il costo giusto.
 */
import type { Prisma } from '@prisma/client';
import type { IngestBundle } from '../ingest/records.js';
import { getPrisma } from './client.js';

export interface WriteStats {
  acts: number;
  versionsInserted: number;
  versionsUnchanged: number;
  versionsSuperseded: number;
  articles: number;
  provisions: number;
  relationsInserted: number;
  relationsSuperseded: number;
}

export function emptyStats(): WriteStats {
  return {
    acts: 0,
    versionsInserted: 0,
    versionsUnchanged: 0,
    versionsSuperseded: 0,
    articles: 0,
    provisions: 0,
    relationsInserted: 0,
    relationsSuperseded: 0,
  };
}

/**
 * Scrive un atto e tutto quello che gli appartiene, rispettando la bitemporalità.
 * `knownAt` è il momento di conoscenza da attribuire alle righe nuove: si passa
 * esplicitamente perché un'intera esecuzione della pipeline deve condividere lo
 * stesso istante, altrimenti le finestre di conoscenza si frastagliano.
 */
export async function writeBundle(
  bundle: IngestBundle,
  knownAt: Date,
  stats: WriteStats = emptyStats(),
): Promise<WriteStats> {
  const prisma = getPrisma();

  await prisma.act.upsert({
    where: { urn: bundle.act.urn },
    create: bundle.act,
    update: {
      title: bundle.act.title,
      actType: bundle.act.actType,
      authority: bundle.act.authority,
      sourceRank: bundle.act.sourceRank,
      workDate: bundle.act.workDate,
      publicationDate: bundle.act.publicationDate,
      gazzettaNumber: bundle.act.gazzettaNumber,
      editorialCode: bundle.act.editorialCode,
      eli: bundle.act.eli,
      collection: bundle.act.collection,
    },
  });
  stats.acts++;

  const articlesByVersion = new Map<string, typeof bundle.articles>();
  for (const article of bundle.articles) {
    const list = articlesByVersion.get(article.versionId);
    if (list) list.push(article);
    else articlesByVersion.set(article.versionId, [article]);
  }
  const provisionsByArticle = new Map<string, typeof bundle.provisions>();
  for (const provision of bundle.provisions) {
    const list = provisionsByArticle.get(provision.articleId);
    if (list) list.push(provision);
    else provisionsByArticle.set(provision.articleId, [provision]);
  }

  for (const version of bundle.versions) {
    const current = await prisma.actVersion.findFirst({
      where: { actUrn: version.actUrn, inForceFrom: version.inForceFrom, knownTo: null },
    });

    if (current && current.checksum === version.checksum) {
      // Stessi byte di origine: la nostra conoscenza non è cambiata, non si
      // tocca nulla. È anche ciò che rende la pipeline quotidiana economica.
      if (current.inForceTo !== version.inForceTo) {
        await prisma.actVersion.update({
          where: { id: current.id },
          data: { inForceTo: version.inForceTo },
        });
      }
      stats.versionsUnchanged++;
      continue;
    }

    if (current) {
      await prisma.actVersion.update({ where: { id: current.id }, data: { knownTo: knownAt } });
      stats.versionsSuperseded++;
    }

    // L'id include l'istante di conoscenza solo quando si sta soppiantando una
    // riga: la prima ingestione di una versione conserva l'id deterministico,
    // che è quello citato dagli URL e dal dataset.
    const versionId = current ? `${version.id}@${knownAt.getTime()}` : version.id;
    await prisma.actVersion.create({
      data: {
        id: versionId,
        actUrn: version.actUrn,
        ordinal: version.ordinal,
        inForceFrom: version.inForceFrom,
        inForceTo: version.inForceTo,
        consolidated: version.consolidated,
        eli: version.eli,
        checksum: version.checksum,
        sourceFile: version.sourceFile,
        dateConflict: version.dateConflict,
        knownFrom: knownAt,
      },
    });
    stats.versionsInserted++;

    const articles = articlesByVersion.get(version.id) ?? [];
    if (articles.length > 0) {
      await prisma.article.createMany({
        data: articles.map((a) => ({ ...a, versionId, id: current ? `${a.id}@${knownAt.getTime()}` : a.id })),
        skipDuplicates: true,
      });
      stats.articles += articles.length;

      const provisions = articles.flatMap((a) => {
        const list = provisionsByArticle.get(a.id) ?? [];
        const articleId = current ? `${a.id}@${knownAt.getTime()}` : a.id;
        return list.map((p) => ({
          ...p,
          articleId,
          id: current ? `${p.id}@${knownAt.getTime()}` : p.id,
        }));
      });
      if (provisions.length > 0) {
        await prisma.provision.createMany({ data: provisions, skipDuplicates: true });
        stats.provisions += provisions.length;
      }
    }
  }

  return stats;
}

/**
 * Scrive le relazioni di un atto. Gli archi assenti dall'insieme nuovo vengono
 * chiusi (`knownTo`), non cancellati: sapere che un arco c'era e non c'è più è
 * informazione, e serve a spiegare perché una segnalazione è scomparsa.
 */
export async function writeRelations(
  sourceUrn: string,
  relations: IngestBundle['relations'],
  knownAt: Date,
  knownActs: ReadonlySet<string>,
  stats: WriteStats = emptyStats(),
): Promise<WriteStats> {
  const prisma = getPrisma();

  // Un arco può puntare a un atto che non abbiamo ingerito (il corpus è
  // parziale per costruzione). Quegli archi vengono scartati qui, e il fatto che
  // il bersaglio sia fuori corpus è esso stesso un dato: lo registra il motore
  // come «bersaglio non nel corpus», non come «nessuna anomalia».
  const usable = relations.filter((r) => knownActs.has(r.targetUrn));

  const existing = await prisma.relation.findMany({
    where: { sourceUrn, knownTo: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((r) => r.id));
  const nextIds = new Set(usable.map((r) => r.id));

  const removed = [...existingIds].filter((id) => !nextIds.has(id));
  if (removed.length > 0) {
    await prisma.relation.updateMany({
      where: { id: { in: removed } },
      data: { knownTo: knownAt },
    });
    stats.relationsSuperseded += removed.length;
  }

  const added = usable.filter((r) => !existingIds.has(r.id));
  if (added.length > 0) {
    await prisma.relation.createMany({
      data: added.map((r) => ({
        id: r.id,
        type: r.type as Prisma.RelationCreateManyInput['type'],
        sourceUrn: r.sourceUrn,
        sourceArticle: r.sourceArticle,
        sourceParagraph: r.sourceParagraph,
        targetUrn: r.targetUrn,
        targetArticle: r.targetArticle,
        targetParagraphs: r.targetParagraphs,
        targetLetters: r.targetLetters,
        targetAnnex: r.targetAnnex,
        wholeAct: r.wholeAct,
        effectiveFrom: r.effectiveFrom,
        evidence: r.evidence,
        confidence: r.confidence,
        origin: r.origin,
        knownFrom: knownAt,
      })),
      skipDuplicates: true,
    });
    stats.relationsInserted += added.length;
  }

  return stats;
}

/**
 * Propaga sugli atti lo stato di abrogazione che risulta dal grafo.
 *
 * Non è ridondanza: «questo atto è abrogato» è il predicato più interrogato
 * dell'intero motore di livello 1, e ricalcolarlo con una join a ogni controllo
 * su un corpus da centinaia di migliaia di atti è lo spreco che rende una
 * pipeline quotidiana una pipeline settimanale.
 */
export async function refreshAbrogationFlags(): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.$executeRaw`
    WITH abrogazioni AS (
      SELECT DISTINCT ON (r."targetUrn")
             r."targetUrn"   AS urn,
             r."effectiveFrom" AS effective_from,
             r."sourceUrn"   AS by_urn
      FROM "Relation" r
      WHERE r."type" = 'ABROGA'
        AND r."wholeAct" = true
        AND r."confidence" = 'alta'
        AND r."knownTo" IS NULL
      ORDER BY r."targetUrn", r."effectiveFrom" ASC NULLS LAST
    )
    UPDATE "Act" a
    SET "abrogated"     = true,
        "abrogatedFrom" = abrogazioni.effective_from,
        "abrogatedBy"   = abrogazioni.by_urn
    FROM abrogazioni
    WHERE a."urn" = abrogazioni.urn
      AND (a."abrogated" = false OR a."abrogatedFrom" IS DISTINCT FROM abrogazioni.effective_from)
  `;
  return result;
}
