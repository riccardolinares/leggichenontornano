/**
 * Esportazione del dataset derivato dal database.
 *
 * Due modalità:
 *
 *  - **completa**, per la release: tutto il corpus ingerito;
 *  - **ridotta** (`onlyAnomalyActs`), per il repository: solo gli atti toccati da
 *    un'anomalia pubblicata, con i loro articoli. Serve perché il sito deve poter
 *    essere generato da un `git clone` senza scaricare 70 MB di XML, e perché un
 *    dataset di esempio che sta nel repository è un dataset che qualcuno guarda.
 */
import { getPrisma } from '../store/client.js';
import { snapshotPath, writeJson, writeJsonl } from './io.js';
import {
  ATTRIBUTION,
  DISCLAIMER,
  type SnapshotAct,
  type SnapshotAnomaly,
  type SnapshotArticle,
  type SnapshotCheckMetric,
  type SnapshotManifest,
  type SnapshotRelation,
  type SnapshotVersion,
} from './types.js';

export interface ExportOptions {
  /** Cartella di destinazione. */
  dir: string;
  /**
   * Se `true`, esporta solo gli atti coinvolti in un'anomalia — pubblicata o in
   * coda — più il campione indicato da `sampleActs`.
   */
  onlyAnomalyActs?: boolean;
  /**
   * Quanti atti aggiungere oltre a quelli delle anomalie. Serve perché il
   * dataset di esempio nel repository non sia vuoto quando nessun controllo
   * pubblica: il lettore norma deve avere qualcosa da leggere.
   */
  sampleActs?: number;
  /** Metriche per controllo, calcolate dal motore. */
  metrics?: SnapshotCheckMetric[];
  /** Soglia di pubblicazione vigente, ripetuta nel manifesto. */
  publicationThreshold?: { minPrecision: number; minSample: number };
  sources?: SnapshotManifest['sources'];
  /** Tetto al numero di articoli esportati, per tenere piccolo il dataset di esempio. */
  maxArticles?: number;
}

export async function exportSnapshot(opts: ExportOptions): Promise<SnapshotManifest> {
  const prisma = getPrisma();
  const knownAt = new Date();

  const anomalyRows = await prisma.anomaly.findMany({ orderBy: { computedAt: 'desc' } });
  const anomalies: SnapshotAnomaly[] = anomalyRows.map((a) => ({
    id: a.id,
    checkId: a.checkId,
    level: a.level,
    title: a.title,
    plainLanguage: a.plainLanguage,
    urns: a.urns,
    windowFrom: a.windowFrom,
    windowTo: a.windowTo,
    rule: a.rule,
    evidence: a.evidence,
    resolutions: a.resolutions,
    severity: a.severity,
    published: a.published,
    computedAt: a.computedAt.toISOString(),
  }));

  // Gli atti citati da qualunque anomalia, anche da quelle in coda: la pagina
  // «Dati» conta le segnalazioni non pubblicate, e per contarle onestamente
  // servono nel dataset.
  const anomalyUrns = new Set(
    anomalies.flatMap((a) => a.urns).map((u) => u.split('~')[0]!),
  );

  const actRows = opts.onlyAnomalyActs
    ? [
        ...(await prisma.act.findMany({
          where: { urn: { in: [...anomalyUrns] } },
          include: { _count: { select: { versions: true } } },
          orderBy: { urn: 'asc' },
        })),
        ...(opts.sampleActs
          ? await prisma.act.findMany({
              where: { urn: { notIn: [...anomalyUrns] } },
              include: { _count: { select: { versions: true } } },
              orderBy: [{ publicationDate: 'desc' }, { urn: 'asc' }],
              take: opts.sampleActs,
            })
          : []),
      ]
    : await prisma.act.findMany({
        include: { _count: { select: { versions: true } } },
        orderBy: { urn: 'asc' },
      });
  const acts: SnapshotAct[] = actRows.map((a) => ({
    urn: a.urn,
    title: a.title,
    actType: a.actType,
    authority: a.authority,
    sourceRank: a.sourceRank,
    publicationDate: a.publicationDate,
    gazzettaNumber: a.gazzettaNumber,
    abrogated: a.abrogated,
    abrogatedFrom: a.abrogatedFrom,
    abrogatedBy: a.abrogatedBy,
    versionCount: a._count.versions,
  }));
  const actUrns = acts.map((a) => a.urn);

  const versionRows = await prisma.actVersion.findMany({
    where: { knownTo: null, ...(opts.onlyAnomalyActs ? { actUrn: { in: actUrns } } : {}) },
    orderBy: [{ actUrn: 'asc' }, { inForceFrom: 'asc' }],
  });
  const versions: SnapshotVersion[] = versionRows.map((v) => ({
    id: v.id,
    actUrn: v.actUrn,
    ordinal: v.ordinal,
    inForceFrom: v.inForceFrom,
    inForceTo: v.inForceTo,
    consolidated: v.consolidated,
    dateConflict: v.dateConflict,
  }));

  const actUrnByVersion = new Map(versions.map((v) => [v.id, v.actUrn]));

  // Il tetto agli articoli si applica **per atto intero**, non troncando a metà.
  // Un atto esportato per tre quarti è peggio di un atto assente: il lettore
  // norma mostrerebbe un testo incompleto senza dirlo, e la modalità confronto
  // segnalerebbe come «cambiato» un articolo che semplicemente non è stato
  // esportato. Si includono atti finché c'è budget, e di ciascuno tutto.
  const versionIdsByAct = new Map<string, string[]>();
  for (const v of versions) {
    const list = versionIdsByAct.get(v.actUrn);
    if (list) list.push(v.id);
    else versionIdsByAct.set(v.actUrn, [v.id]);
  }

  const conteggi = await prisma.article.groupBy({
    by: ['versionId'],
    where: { versionId: { in: versions.map((v) => v.id) } },
    _count: { _all: true },
  });
  const articoliPerVersione = new Map(conteggi.map((c) => [c.versionId, c._count._all]));

  const versionIds: string[] = [];
  let budget = opts.maxArticles ?? Number.POSITIVE_INFINITY;
  for (const urn of actUrns) {
    const ids = versionIdsByAct.get(urn) ?? [];
    const costo = ids.reduce((sum, id) => sum + (articoliPerVersione.get(id) ?? 0), 0);
    if (costo === 0) continue;
    if (costo > budget) continue;
    versionIds.push(...ids);
    budget -= costo;
  }

  const articleRows = await prisma.article.findMany({
    where: { versionId: { in: versionIds } },
    orderBy: [{ versionId: 'asc' }, { position: 'asc' }],
  });
  const articles: SnapshotArticle[] = articleRows.map((a) => ({
    id: a.id,
    versionId: a.versionId,
    actUrn: actUrnByVersion.get(a.versionId) ?? '',
    eId: a.eId,
    number: a.number,
    num: a.num,
    heading: a.heading,
    container: a.container,
    principal: a.principal,
    text: a.text,
    position: a.position,
  }));

  const relationRows = await prisma.relation.findMany({
    where: {
      knownTo: null,
      // In modalità ridotta si tengono solo gli archi i cui **due** estremi sono
      // nel dataset: un arco che punta fuori non è navigabile e gonfierebbe il
      // file senza aggiungere nulla di verificabile.
      ...(opts.onlyAnomalyActs
        ? { AND: [{ sourceUrn: { in: actUrns } }, { targetUrn: { in: actUrns } }] }
        : {}),
    },
    orderBy: { id: 'asc' },
  });
  const relations: SnapshotRelation[] = relationRows.map((r) => ({
    id: r.id,
    type: r.type,
    sourceUrn: r.sourceUrn,
    sourceArticle: r.sourceArticle,
    targetUrn: r.targetUrn,
    targetArticle: r.targetArticle,
    targetParagraphs: r.targetParagraphs,
    wholeAct: r.wholeAct,
    effectiveFrom: r.effectiveFrom,
    evidence: r.evidence,
    confidence: r.confidence,
    origin: r.origin,
  }));

  const manifest: SnapshotManifest = {
    formatVersion: 1,
    generatedAt: knownAt.toISOString(),
    knownAt: knownAt.toISOString(),
    counts: {
      acts: acts.length,
      versions: versions.length,
      articles: articles.length,
      relations: relations.length,
      anomalies: anomalies.length,
      publishedAnomalies: anomalies.filter((a) => a.published).length,
    },
    sources: opts.sources ?? [
      { name: 'Normattiva open data', licence: 'CC BY 4.0', retrievedAt: knownAt.toISOString() },
    ],
    publicationThreshold: opts.publicationThreshold ?? { minPrecision: 0.85, minSample: 30 },
    disclaimer: `${DISCLAIMER} ${ATTRIBUTION}`,
  };

  writeJsonl(snapshotPath(opts.dir, 'acts'), acts);
  writeJsonl(snapshotPath(opts.dir, 'versions'), versions);
  writeJsonl(snapshotPath(opts.dir, 'articles'), articles);
  writeJsonl(snapshotPath(opts.dir, 'relations'), relations);
  writeJsonl(snapshotPath(opts.dir, 'anomalies'), anomalies);
  writeJson(snapshotPath(opts.dir, 'metrics'), opts.metrics ?? []);
  writeJson(snapshotPath(opts.dir, 'manifest'), manifest);

  return manifest;
}
