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
import { join } from 'node:path';
import { getPrisma } from '../store/client.js';
import { verificaDichiarazioni } from '../consulta/verifica.js';
import { snapshotPath, writeJson, writeJsonl } from './io.js';
import { scriviParquet } from './parquet.js';
import {
  ATTRIBUTION,
  DISCLAIMER,
  type SnapshotAct,
  type SnapshotAnomaly,
  type SnapshotArticle,
  type SnapshotCheckMetric,
  type SnapshotManifest,
  type SnapshotConcordanza,
  type SnapshotPronuncia,
  type SnapshotVerifica,
  type SnapshotVertical,
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
  /**
   * Se `true`, scrive anche le tabelle in Parquet sotto `parquet/`.
   *
   * Non è il formato primario: il JSONL si legge con `grep` e senza installare
   * niente, e per un dataset civico quella proprietà vale più della
   * compressione. Il Parquet serve a chi gli strumenti li ha già.
   */
  parquet?: boolean;
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
    // Il campo viaggia nel dataset come sta nel database: chi lo rilegge deve
    // poter distinguere una segnalazione assistita da una deterministica senza
    // dedurlo dal livello.
    ...(a.assistita ? { assistita: a.assistita as never } : {}),
  }));

  // Gli atti citati da qualunque anomalia, anche da quelle in coda: la pagina
  // «Dati» conta le segnalazioni non pubblicate, e per contarle onestamente
  // servono nel dataset.
  const anomalyUrns = new Set(anomalies.flatMap((a) => a.urns).map((u) => u.split('~')[0]!));

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
      //
      // Con un'eccezione: gli archi che nascono da una pronuncia della Corte
      // costituzionale. La loro sorgente è un ECLI, non un atto, e non sarà mai
      // fra gli URN esportati — ma la pronuncia viaggia con il dataset, quindi
      // l'arco è navigabile eccome. Senza questa eccezione le declaratorie di
      // illegittimità sparivano dal dataset in silenzio.
      ...(opts.onlyAnomalyActs
        ? {
            OR: [
              { AND: [{ sourceUrn: { in: actUrns } }, { targetUrn: { in: actUrns } }] },
              { AND: [{ type: 'DICHIARA_ILLEGITTIMO' as const }, { targetUrn: { in: actUrns } }] },
            ],
          }
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

  // Le pronunce che colpiscono un atto esportato: senza di esse gli archi
  // `DICHIARA_ILLEGITTIMO` sarebbero un ECLI nudo, e il sito non potrebbe
  // mostrare le parole con cui la Corte ha deciso — che sono la prova.
  const ecliCitati = new Set(
    relations.filter((r) => r.type === 'DICHIARA_ILLEGITTIMO').map((r) => r.sourceUrn),
  );
  const pronunce: SnapshotPronuncia[] = (
    ecliCitati.size > 0
      ? await prisma.pronuncia.findMany({ where: { ecli: { in: [...ecliCitati] } } })
      : []
  ).map((p) => ({
    ecli: p.ecli,
    numero: p.numero,
    anno: p.anno,
    tipologia: p.tipologia,
    dataDeposito: p.dataDeposito,
    dispositivo: p.dispositivo,
    url: p.url,
  }));

  // La verifica incrociata viaggia con il dataset: è una misura di precisione,
  // e una misura che resta in un terminale non serve a chi deve decidere se
  // fidarsi di quello che legge.
  const concordanza: SnapshotConcordanza[] =
    pronunce.length > 0 ? (await verificaDichiarazioni()).perConfidenza : [];

  // I verticali escono da qui come tutto il resto, così un dataset esportato
  // altrove non è mai privo del confine che il livello 3 si è dato.
  const verticali: SnapshotVertical[] = (
    await prisma.verticale.findMany({ orderBy: { vertical: 'asc' } })
  ).map((v) => ({
    vertical: v.vertical,
    label: v.label,
    roots: v.roots,
    missingRoots: v.missingRoots,
    acts: v.acts,
    expansion: v.expansion,
    concepts: v.concepts,
    propositions: v.propositions,
    propositionsWithConcept: v.propositionsWithConcept,
    extractor: v.extractor,
    computedAt: v.computedAt,
  }));

  // Le verifiche in Gazzetta Ufficiale escono **tutte**, compresi i
  // `non-verificabile`, e anche in modalità ridotta. Due ragioni, e la seconda
  // è quella che ha fatto togliere il filtro per atto che c'era qui: sapere
  // dove la verifica non arriva è un'informazione, e nasconderla farebbe
  // sembrare la copertura migliore di com'è; e questo file è il registro che la
  // campagna notturna rilegge per sapere cosa ha già guardato — un'esportazione
  // che ne tiene solo una parte le farebbe rifare il lavoro già fatto.
  const verifiche: SnapshotVerifica[] = (
    await prisma.verificaAttuazione.findMany({
      orderBy: [{ actUrn: 'asc' }, { id: 'asc' }],
    })
  ).map((v) => ({
    id: v.id,
    actUrn: v.actUrn,
    articleNumber: v.articleNumber,
    provisionNumber: v.provisionNumber,
    strumento: v.strumento,
    deadlineDays: v.deadlineDays,
    dueBy: v.dueBy,
    mandato: v.mandato,
    esito: v.esito,
    motivo: v.motivo,
    query: v.query,
    url: v.url,
    fonte: v.fonte,
    finestraDa: v.finestraDa,
    finestraA: v.finestraA,
    risultati: v.risultati,
    verificatoIl: v.verificatoIl.toISOString(),
    provvedimentoTipo: v.provvedimentoTipo,
    provvedimentoTitolo: v.provvedimentoTitolo,
    gazzetta: v.gazzetta,
    gazzettaData: v.gazzettaData,
    codiceRedazionale: v.codiceRedazionale,
    provvedimentoUrl: v.provvedimentoUrl,
    citazione: v.citazione,
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
      pronunce: pronunce.length,
      verifiche: verifiche.length,
    },
    sources: opts.sources ?? [
      { name: 'Normattiva open data', licence: 'CC BY 4.0', retrievedAt: knownAt.toISOString() },
      ...(pronunce.length > 0
        ? [
            {
              name: 'Corte costituzionale open data',
              licence: 'CC BY-SA 3.0',
              retrievedAt: knownAt.toISOString(),
            },
          ]
        : []),
      ...(verifiche.length > 0
        ? [
            {
              name: 'Gazzetta Ufficiale della Repubblica Italiana — Serie Generale',
              licence: 'Consultazione pubblica, www.gazzettaufficiale.it',
              retrievedAt: knownAt.toISOString(),
            },
          ]
        : []),
    ],
    ...(concordanza.length > 0 ? { concordanzaPronunce: concordanza } : {}),
    publicationThreshold: opts.publicationThreshold ?? { minPrecision: 0.85, minSample: 30 },
    disclaimer: `${DISCLAIMER} ${ATTRIBUTION}`,
  };

  writeJsonl(snapshotPath(opts.dir, 'acts'), acts);
  writeJsonl(snapshotPath(opts.dir, 'versions'), versions);
  writeJsonl(snapshotPath(opts.dir, 'articles'), articles);
  writeJsonl(snapshotPath(opts.dir, 'relations'), relations);
  writeJsonl(snapshotPath(opts.dir, 'anomalies'), anomalies);
  writeJsonl(snapshotPath(opts.dir, 'pronunce'), pronunce);
  writeJsonl(snapshotPath(opts.dir, 'verifiche'), verifiche);
  writeJson(snapshotPath(opts.dir, 'verticals'), verticali);

  // Parquet accanto al JSONL, dalla stessa esportazione: le due forme non
  // possono divergere perché sono la stessa cosa scritta due volte.
  if (opts.parquet) {
    scriviParquet(join(opts.dir, 'parquet'), {
      acts,
      versions,
      articles,
      relations,
      anomalies,
      pronunce,
    });
  }
  writeJson(snapshotPath(opts.dir, 'metrics'), opts.metrics ?? []);
  writeJson(snapshotPath(opts.dir, 'manifest'), manifest);

  return manifest;
}
