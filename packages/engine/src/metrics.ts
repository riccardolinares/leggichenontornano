/**
 * Metriche di precisione per tipo di controllo.
 *
 * Sono la cosa che il sito mostra nella pagina «Dati», compresi i controlli
 * sotto soglia e il perché non pubblicano. Una metrica che si mostra solo quando
 * è buona non è una metrica: è marketing.
 */
import { getPrisma } from '@leggichenontornano/corpus';
import type { SnapshotCheckMetric } from '@leggichenontornano/corpus';
import { evaluateGate, type ReviewTally } from './publication-gate.js';
import { CHECK_DEFINITIONS } from './registry.js';
import { mandateKey } from './checks/level1/attuazione-mancante.js';

export interface CheckMetric extends SnapshotCheckMetric {
  description: string;
  rule: string;
  expectedPrecision: string;
  deterministic: boolean;
}

/**
 * Calcola le metriche di ogni controllo dal database.
 *
 * Include i controlli che non hanno prodotto nulla: «questo controllo esiste e
 * non ha trovato niente» e «questo controllo non esiste» sono informazioni
 * diverse, e il sito deve poterle distinguere.
 */
export async function computeMetrics(): Promise<CheckMetric[]> {
  const prisma = getPrisma();

  const [counts, tallyRows] = await Promise.all([
    prisma.anomaly.groupBy({
      by: ['checkId'],
      where: { resolvedAt: null },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ checkId: string; reviewed: bigint; confirmed: bigint }>>`
      SELECT a."checkId"                                            AS "checkId",
             COUNT(r."id")                                          AS reviewed,
             COUNT(r."id") FILTER (WHERE r."verdict" = 'CONFERMATA') AS confirmed
      FROM "Anomaly" a
      JOIN "Review" r ON r."anomalyId" = a."id"
      GROUP BY a."checkId"
    `,
  ]);

  const foundByCheck = new Map(counts.map((c) => [c.checkId, c._count._all]));
  const tallies = new Map<string, ReviewTally>(
    tallyRows.map((r) => [
      r.checkId,
      { checkId: r.checkId, reviewed: Number(r.reviewed), confirmed: Number(r.confirmed) },
    ]),
  );

  return CHECK_DEFINITIONS.map((definition) => {
    const gate = evaluateGate(definition, tallies.get(definition.id));
    return {
      checkId: definition.id,
      label: definition.label,
      level: definition.level,
      found: foundByCheck.get(definition.id) ?? 0,
      reviewed: gate.reviewed,
      confirmed: gate.confirmed,
      precision: gate.precision,
      published: gate.published,
      reason: gate.reason,
      description: definition.description,
      rule: definition.rule,
      expectedPrecision: definition.expectedPrecision,
      deterministic: definition.deterministic,
    };
  });
}

/**
 * Il contatore nazionale.
 *
 * Deve essere **deterministico e crescente**, e deve avere un referente
 * concreto: «giorni trascorsi dalla scadenza dei termini fissati per i
 * provvedimenti attuativi previsti» è una frase che si può verificare riga per
 * riga, «indice di disfunzione normativa» non lo è.
 *
 * Il numero **sottostima** da un lato: conta solo i mandati estratti dagli atti
 * che abbiamo ingerito. Sottostimare è l'errore innocuo.
 *
 * Dall'altro lato misura una cosa più stretta di quella che verrebbe voglia di
 * annunciare: sappiamo che un termine di legge è passato, non che il decreto
 * non sia mai arrivato. Da quando esiste la verifica in Gazzetta Ufficiale
 * (ADR 0013) quella distanza si può **misurare** invece che soltanto
 * dichiarare, e il contatore se la porta dietro: quanti mandati sono stati
 * verificati, per quanti il decreto è arrivato in ritardo, per quanti non
 * risulta pubblicato.
 *
 * Finché la copertura è zero il caveat resta quello di prima, parola per
 * parola. Un avvertimento che cambia forma senza che sia cambiato niente
 * insegna al lettore che quella riga è decorativa.
 */
export interface NationalCounter {
  label: string;
  /** Giorni di ritardo accumulati, sommati su tutti i mandati scaduti. */
  totalDaysLate: number;
  /** Numero di mandati scaduti considerati. */
  mandates: number;
  /** Atti coinvolti. */
  acts: number;
  /** Quanti di questi mandati sono stati verificati in Gazzetta Ufficiale. */
  verified: number;
  /** Dei verificati, quelli il cui decreto è arrivato dopo la scadenza. */
  adottatiInRitardo: number;
  /** Dei verificati, quelli per cui il decreto non risulta pubblicato. */
  nonAdottati: number;
  computedAt: string;
  caveat: string;
}

/** Il minimo che serve al contatore per identificare e datare un mandato. */
export interface CounterMandate {
  actUrn: string;
  articleNumber?: string | null;
  provisionNumber?: string | null;
  deadlineDays?: number;
  dueBy: string | null;
}

/**
 * Gli esiti della verifica in Gazzetta, per chiave di mandato.
 *
 * `inRitardo` sono i mandati `adottato` il cui provvedimento è stato pubblicato
 * **dopo** la scadenza del termine. È la quota di giorni che il contatore somma
 * e che però un decreto, arrivando tardi, ha già chiuso: è l'informazione che
 * rende il numero citabile senza note a piè di pagina.
 */
export interface CounterCoverage {
  esiti: ReadonlyMap<string, string>;
  inRitardo: ReadonlySet<string>;
}

export function buildNationalCounter(
  mandates: ReadonlyArray<CounterMandate>,
  today: string,
  coverage: CounterCoverage = { esiti: new Map(), inRitardo: new Set() },
): NationalCounter {
  let totalDaysLate = 0;
  let count = 0;
  let verified = 0;
  let adottatiInRitardo = 0;
  let nonAdottati = 0;
  const acts = new Set<string>();
  for (const m of mandates) {
    if (!m.dueBy || m.dueBy >= today) continue;
    totalDaysLate += Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${m.dueBy}T00:00:00Z`)) / 86_400_000,
    );
    count++;
    acts.add(m.actUrn);

    const chiave = mandateKey({
      actUrn: m.actUrn,
      articleNumber: m.articleNumber ?? null,
      provisionNumber: m.provisionNumber ?? null,
      deadlineDays: m.deadlineDays ?? 0,
    });
    const esito = coverage.esiti.get(chiave);
    // «Verificato» vuol dire che qualcuno è andato a guardare e ne è uscita una
    // risposta. `non-verificabile` è una risposta onesta, ma non è una verifica
    // riuscita: contarla fra le verifiche gonfierebbe la copertura, che è
    // esattamente il numero che questo progetto non deve gonfiare.
    if (esito === 'adottato' || esito === 'non-adottato') verified++;
    if (esito === 'adottato' && coverage.inRitardo.has(chiave)) adottatiInRitardo++;
    if (esito === 'non-adottato') nonAdottati++;
  }
  return {
    // L'etichetta dice **quello che abbiamo misurato**, non quello che sarebbe
    // più efficace dire. Misuriamo che un termine di legge è scaduto; per la
    // quota verificata sappiamo anche se il provvedimento sia poi arrivato.
    // Chiamare tutti questi «provvedimenti mai adottati» sarebbe un titolo
    // migliore e un'affermazione che non possiamo sostenere — e una sola
    // affermazione falsa su una legge distrugge più di quanto dieci corrette
    // costruiscano.
    label:
      'Giorni trascorsi dalla scadenza dei termini fissati per i provvedimenti attuativi previsti',
    totalDaysLate,
    mandates: count,
    acts: acts.size,
    verified,
    adottatiInRitardo,
    nonAdottati,
    computedAt: today,
    caveat: caveat(verified, adottatiInRitardo, nonAdottati),
  };
}

const SOTTOSTIMA =
  'Il conteggio riguarda i soli atti presenti nel corpus ingerito e i soli mandati con un termine espresso nel testo: da questo lato è una sottostima.';
const SOPRASTIMA =
  'Dall’altro lato parte dalla scadenza del termine: se il decreto è poi arrivato con cinque anni di ritardo, quei cinque anni li conta lo stesso, ma il provvedimento c’è.';

function caveat(verificati: number, adottatiInRitardo: number, nonAdottati: number): string {
  if (verificati === 0) {
    return `${SOTTOSTIMA} ${SOPRASTIMA} Misura termini scaduti, non attuazioni mancate — l’adozione dopo la scadenza non la verifichiamo ancora in Gazzetta Ufficiale, se non per la quota indicata come verificata.`;
  }
  return [
    SOTTOSTIMA,
    SOPRASTIMA,
    `Su ${verificati} di questi mandati siamo andati a guardare in Gazzetta Ufficiale, uno per uno:`,
    `per ${adottatiInRitardo} il decreto è arrivato dopo la scadenza — il ritardo è reale, il buco no — e per ${nonAdottati} non risulta pubblicato.`,
    'Sugli altri non lo sappiamo, e per quelli il numero misura termini scaduti, non attuazioni mancate.',
  ].join(' ');
}
