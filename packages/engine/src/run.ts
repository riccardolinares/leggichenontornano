/**
 * Esecuzione del motore: dal database alle segnalazioni, e ritorno.
 *
 * Il flusso è deliberatamente lineare e ispezionabile:
 *
 *   corpus → proiezione → controlli → cancello di pubblicazione → store
 *
 * Ogni segnalazione registra `knownAt`, cioè lo stato di conoscenza del corpus
 * al momento del calcolo, perché una segnalazione pubblicata deve restare
 * riproducibile anche dopo un aggiornamento del corpus (ADR 0007).
 */
import { getPrisma } from '@antinomia/corpus';
import { CorpusView, type ActView, type ProvisionView } from './corpus-view.js';
import { applyGate, evaluateGate, type GateDecision, type ReviewTally } from './publication-gate.js';
import {
  ATTUAZIONE_MANCANTE,
  CHECK_DEFINITIONS,
  FONTE_SECONDARIA_SU_PRIMARIA,
  MODIFICA_AD_ATTO_ABROGATO,
  RINVIO_AD_ARTICOLO_INESISTENTE,
  RINVIO_AD_ATTO_ABROGATO,
} from './registry.js';
import type { AnomalyFinding } from './types.js';

export interface RunOptions {
  /** Data di riferimento per «oggi». Esplicita, così i giri sono riproducibili. */
  today?: string;
  /** Limite di segnalazioni per controllo. */
  limitPerCheck?: number;
  /** Se `false`, calcola senza scrivere nel database. */
  persist?: boolean;
  /** Se `true`, carica anche i commi (servono ai controlli di livello 3). */
  withProvisions?: boolean;
  onProgress?: (message: string) => void;
}

export interface RunReport {
  findings: AnomalyFinding[];
  published: AnomalyFinding[];
  queued: AnomalyFinding[];
  decisions: GateDecision[];
  byCheck: Record<string, number>;
  durationMs: number;
}

/** Costruisce la proiezione del corpus leggendo dal database. */
export async function buildViewFromDatabase(withProvisions = false): Promise<CorpusView> {
  const prisma = getPrisma();

  const [actRows, versionRows, relationRows] = await Promise.all([
    prisma.act.findMany({
      select: {
        urn: true,
        title: true,
        actType: true,
        sourceRank: true,
        publicationDate: true,
        abrogated: true,
        abrogatedFrom: true,
        abrogatedBy: true,
      },
    }),
    prisma.actVersion.findMany({
      where: { knownTo: null },
      select: {
        id: true,
        actUrn: true,
        inForceFrom: true,
        inForceTo: true,
        consolidated: true,
      },
      orderBy: [{ actUrn: 'asc' }, { inForceFrom: 'asc' }],
    }),
    prisma.relation.findMany({ where: { knownTo: null } }),
  ]);

  const firstInForce = new Map<string, string>();
  for (const v of versionRows) {
    if (!firstInForce.has(v.actUrn)) firstInForce.set(v.actUrn, v.inForceFrom);
  }

  const acts: ActView[] = actRows.map((a) => ({
    urn: a.urn,
    title: a.title,
    actType: a.actType,
    sourceRank: a.sourceRank,
    publicationDate: a.publicationDate,
    inForceFrom: firstInForce.get(a.urn) ?? null,
    abrogated: a.abrogated,
    abrogatedFrom: a.abrogatedFrom,
    abrogatedBy: a.abrogatedBy,
  }));

  const versionIds = versionRows.map((v) => v.id);
  const actUrnByVersion = new Map(versionRows.map((v) => [v.id, v.actUrn]));

  const articleRows = await prisma.article.findMany({
    where: { versionId: { in: versionIds } },
    select: { versionId: true, number: true, heading: true, text: true, principal: true },
  });

  let provisions: ProvisionView[] = [];
  if (withProvisions) {
    const windowByVersion = new Map(
      versionRows.map((v) => [v.id, { from: v.inForceFrom, to: v.inForceTo }]),
    );
    const rows = await prisma.provision.findMany({
      select: {
        id: true,
        kind: true,
        number: true,
        text: true,
        article: { select: { versionId: true, number: true } },
      },
    });
    provisions = rows.map((p) => {
      const window = windowByVersion.get(p.article.versionId);
      return {
        id: p.id,
        actUrn: actUrnByVersion.get(p.article.versionId) ?? '',
        articleNumber: p.article.number,
        number: p.number,
        kind: p.kind,
        text: p.text,
        inForceFrom: window?.from ?? '',
        inForceTo: window?.to ?? null,
      };
    });
  }

  return new CorpusView({
    acts,
    versions: versionRows.map((v) => ({
      id: v.id,
      actUrn: v.actUrn,
      inForceFrom: v.inForceFrom,
      inForceTo: v.inForceTo,
    })),
    consolidatedActs: [
      ...new Set(versionRows.filter((v) => v.consolidated).map((v) => v.actUrn)),
    ],
    articles: articleRows.map((a) => ({
      versionId: a.versionId,
      actUrn: actUrnByVersion.get(a.versionId) ?? '',
      number: a.number,
      heading: a.heading,
      text: a.text,
      principal: a.principal,
    })),
    relations: relationRows.map((r) => ({
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
    })),
    provisions,
  });
}

/** Conteggi delle revisioni umane per controllo: sono l'input del cancello. */
export async function loadReviewTallies(): Promise<Map<string, ReviewTally>> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<
    Array<{ checkId: string; reviewed: bigint; confirmed: bigint }>
  >`
    SELECT a."checkId"                                        AS "checkId",
           COUNT(r."id")                                      AS reviewed,
           COUNT(r."id") FILTER (WHERE r."verdict" = 'CONFERMATA') AS confirmed
    FROM "Anomaly" a
    JOIN "Review" r ON r."anomalyId" = a."id"
    GROUP BY a."checkId"
  `;
  return new Map(
    rows.map((r) => [
      r.checkId,
      { checkId: r.checkId, reviewed: Number(r.reviewed), confirmed: Number(r.confirmed) },
    ]),
  );
}

export async function runEngine(opts: RunOptions = {}): Promise<RunReport> {
  const startedAt = Date.now();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const log = opts.onProgress ?? (() => undefined);

  log('costruzione della proiezione del corpus');
  const view = await buildViewFromDatabase(opts.withProvisions ?? false);
  log(`${view.acts.size} atti, ${view.relations.length} relazioni`);

  const ctx = { today, ...(opts.limitPerCheck ? { limit: opts.limitPerCheck } : {}) };
  const findings: AnomalyFinding[] = [];
  const byCheck: Record<string, number> = {};

  const graphChecks = [
    MODIFICA_AD_ATTO_ABROGATO,
    RINVIO_AD_ATTO_ABROGATO,
    RINVIO_AD_ARTICOLO_INESISTENTE,
    FONTE_SECONDARIA_SU_PRIMARIA,
  ];
  for (const check of graphChecks) {
    const produced = deduplica(check.run(view, ctx));
    byCheck[check.definition.id] = produced.length;
    findings.push(...produced);
    log(`${check.definition.id}: ${produced.length}`);
  }

  // Il controllo sulle attuazioni mancanti riceve la copertura verificata in
  // Gazzetta Ufficiale. Finché quella verifica non è stata fatta, l'insieme è
  // vuoto e il controllo non produce segnalazioni pubbliche: l'estrazione dei
  // mandati resta comunque disponibile per il contatore nazionale.
  const attuazione = ATTUAZIONE_MANCANTE.run(
    {
      view,
      implementationCoverage: await loadImplementationCoverage(),
      implementations: new Map(),
    },
    ctx,
  );
  byCheck[ATTUAZIONE_MANCANTE.definition.id] = attuazione.length;
  findings.push(...attuazione);
  log(`${ATTUAZIONE_MANCANTE.definition.id}: ${attuazione.length}`);

  const uniche = deduplica(findings);
  if (uniche.length !== findings.length) {
    log(`${findings.length - uniche.length} segnalazioni duplicate accorpate`);
  }
  findings.length = 0;
  findings.push(...uniche);

  const tallies = await loadReviewTallies();
  const decisions = CHECK_DEFINITIONS.map((d) => evaluateGate(d, tallies.get(d.id)));
  const decisionByCheck = new Map(decisions.map((d) => [d.checkId, d]));
  const { published, queued } = applyGate(findings, decisionByCheck);
  log(`${published.length} pubblicabili, ${queued.length} in coda interna`);

  if (opts.persist !== false) {
    await persistFindings(findings, decisionByCheck);
    log('segnalazioni scritte nel database');
  }

  return {
    findings,
    published,
    queued,
    decisions,
    byCheck,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Accorpa le segnalazioni con lo stesso identificatore.
 *
 * Un controllo può arrivare allo stesso `id` da strade diverse — lo stesso
 * rinvio dichiarato in più articoli dell'atto, per esempio. Senza accorpamento
 * i conteggi mostrati nel log raccontano più segnalazioni di quante ne esistano,
 * e un numero gonfiato in una riga di log è il primo passo verso un numero
 * gonfiato in una pagina.
 *
 * Fra due duplicati vince quello con una prova testuale: la citazione del comma
 * vale più di un rimando al grafo.
 */
function deduplica(findings: readonly AnomalyFinding[]): AnomalyFinding[] {
  const perId = new Map<string, AnomalyFinding>();
  const conTesto = (f: AnomalyFinding): boolean => f.evidence.some((e) => e.kind === 'testo');
  for (const finding of findings) {
    const presente = perId.get(finding.id);
    if (!presente || (!conTesto(presente) && conTesto(finding))) {
      perId.set(finding.id, finding);
    }
  }
  return [...perId.values()];
}

/**
 * Copertura della verifica in Gazzetta Ufficiale per le attuazioni mancanti.
 *
 * Legge la tabella del gold standard: un atto è «coperto» quando esiste
 * un'annotazione che certifica l'assenza del provvedimento attuativo. Finché
 * nessuno ha fatto quella verifica, l'insieme è vuoto — ed è giusto che lo sia.
 */
async function loadImplementationCoverage(): Promise<Set<string>> {
  const prisma = getPrisma();
  const rows = await prisma.goldItem.findMany({
    where: { expectCheck: 'attuazione-mancante' },
    select: { urns: true },
  });
  return new Set(rows.flatMap((r) => r.urns));
}

/**
 * Scrive le segnalazioni.
 *
 * Le segnalazioni che non si riproducono più vengono **chiuse** (`resolvedAt`),
 * non cancellate: «questa anomalia c'era ed è stata sanata» è una notizia, e
 * cancellarla la butterebbe via.
 */
export async function persistFindings(
  findings: readonly AnomalyFinding[],
  decisions: ReadonlyMap<string, GateDecision>,
): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();
  const currentIds = new Set(findings.map((f) => f.id));

  for (const finding of findings) {
    const published = decisions.get(finding.checkId)?.published ?? false;
    const data = {
      checkId: finding.checkId,
      level: finding.level,
      title: finding.title,
      plainLanguage: finding.plainLanguage,
      urns: finding.urns,
      windowFrom: finding.windowFrom,
      windowTo: finding.windowTo,
      rule: finding.rule,
      evidence: finding.evidence as unknown as object,
      resolutions: finding.resolutions as unknown as object,
      severity: finding.severity,
      published,
      lastSeenAt: now,
      resolvedAt: null,
    };
    await prisma.anomaly.upsert({
      where: { id: finding.id },
      create: { id: finding.id, ...data, computedAt: now, knownAt: now },
      update: { ...data, computedAt: now, knownAt: now },
    });
  }

  const stale = await prisma.anomaly.findMany({
    where: { resolvedAt: null },
    select: { id: true },
  });
  const toResolve = stale.filter((a) => !currentIds.has(a.id)).map((a) => a.id);
  if (toResolve.length > 0) {
    await prisma.anomaly.updateMany({
      where: { id: { in: toResolve } },
      data: { resolvedAt: now, published: false },
    });
  }
}
