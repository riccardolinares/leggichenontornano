/**
 * La coda di revisione umana.
 *
 * È l'infrastruttura che rende la soglia dell'85% una misura e non una
 * dichiarazione. Due ingressi:
 *
 *  - il **campionamento** interno, per cui un revisore riceve segnalazioni da
 *    giudicare in un ordine che non è quello che gli fa più comodo;
 *  - il pulsante **«Non è un conflitto»** del sito, che apre una issue pubblica
 *    e la cui risposta rientra qui.
 *
 * Sul nome del pulsante: «non è un conflitto» è una valutazione giuridica, che
 * un professionista dà volentieri. «Segnala falso positivo» è un bug report, e
 * presuppone che qualcuno lavori gratis per noi. La differenza sta tutta in chi
 * risponde.
 */
import { getPrisma } from '@leggichenontornano/corpus';

export type ReviewVerdict =
  'CONFERMATA' | 'NON_E_UN_CONFLITTO' | 'ESTRAZIONE_ERRATA' | 'DA_APPROFONDIRE';

export interface QueueItem {
  anomalyId: string;
  checkId: string;
  level: number;
  title: string;
  plainLanguage: string;
  urns: string[];
  rule: string;
  evidence: unknown;
  alreadyReviewed: number;
}

export interface SampleOptions {
  checkId?: string;
  /** Quante segnalazioni estrarre. */
  take?: number;
  /**
   * Seme per il campionamento. Un campione riproducibile è verificabile da
   * terzi: chi contesta la nostra metrica può rifare lo stesso campione.
   */
  seed?: number;
}

/**
 * Estrae un campione di segnalazioni da revisionare.
 *
 * Il campionamento è **pseudocasuale con seme**, non «le prime N»: revisionare
 * sempre le prime produce una metrica che misura l'ordinamento, non il
 * controllo.
 */
export async function sampleForReview(opts: SampleOptions = {}): Promise<QueueItem[]> {
  const prisma = getPrisma();
  const take = opts.take ?? 30;
  const seed = opts.seed ?? 1;

  const rows = await prisma.anomaly.findMany({
    where: {
      resolvedAt: null,
      ...(opts.checkId ? { checkId: opts.checkId } : {}),
    },
    include: { _count: { select: { reviews: true } } },
  });

  // Ordinamento deterministico dipendente dal seme: stesso seme, stesso campione.
  const scored = rows
    .map((row) => ({ row, key: hash(`${seed}:${row.id}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, take);

  return scored.map(({ row }) => ({
    anomalyId: row.id,
    checkId: row.checkId,
    level: row.level,
    title: row.title,
    plainLanguage: row.plainLanguage,
    urns: row.urns,
    rule: row.rule,
    evidence: row.evidence,
    alreadyReviewed: row._count.reviews,
  }));
}

export interface RecordReviewInput {
  anomalyId: string;
  verdict: ReviewVerdict;
  /** Pseudonimo o ruolo del revisore. Mai dati personali. */
  reviewer: string;
  note?: string;
  /** Issue GitHub aperta dal pulsante «Non è un conflitto». */
  issueUrl?: string;
}

export async function recordReview(input: RecordReviewInput): Promise<void> {
  const prisma = getPrisma();
  await prisma.review.create({
    data: {
      id: `rev_${hash(`${input.anomalyId}:${input.reviewer}:${Date.now()}`).toString(16)}`,
      anomalyId: input.anomalyId,
      verdict: input.verdict,
      reviewer: input.reviewer,
      note: input.note ?? null,
      issueUrl: input.issueUrl ?? null,
    },
  });
}

/**
 * Quante revisioni mancano a un controllo per avere una precisione misurata.
 * Mostrato nella pagina «Dati»: dire «ne servono altre 18» è più onesto e più
 * utile di un trattino.
 */
export async function reviewsNeeded(checkId: string, minSample = 30): Promise<number> {
  const prisma = getPrisma();
  const count = await prisma.review.count({ where: { anomaly: { checkId } } });
  return Math.max(0, minSample - count);
}

/** Hash deterministico a 32 bit (FNV-1a), per il campionamento riproducibile. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
