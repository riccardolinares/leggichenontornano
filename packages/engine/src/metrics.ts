/**
 * Metriche di precisione per tipo di controllo.
 *
 * Sono la cosa che il sito mostra nella pagina «Dati», compresi i controlli
 * sotto soglia e il perché non pubblicano. Una metrica che si mostra solo quando
 * è buona non è una metrica: è marketing.
 */
import { getPrisma } from '@antinomia/corpus';
import type { SnapshotCheckMetric } from '@antinomia/corpus';
import { evaluateGate, type ReviewTally } from './publication-gate.js';
import { CHECK_DEFINITIONS } from './registry.js';

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
 * annunciare. Sappiamo che un termine di legge è passato; non sappiamo ancora
 * se il provvedimento sia arrivato dopo la scadenza, perché la verifica in
 * Gazzetta Ufficiale non c'è. «Provvedimenti mai adottati» sarebbe un titolo
 * migliore e un'affermazione che non possiamo sostenere. Il controllo che
 * quell'affermazione la farebbe — `attuazione-mancante` — si rifiuta infatti di
 * produrre segnalazioni finché la copertura in Gazzetta non esiste, e oggi
 * produce zero.
 */
export interface NationalCounter {
  label: string;
  /** Giorni di ritardo accumulati, sommati su tutti i mandati scaduti. */
  totalDaysLate: number;
  /** Numero di mandati scaduti considerati. */
  mandates: number;
  /** Atti coinvolti. */
  acts: number;
  /** Quanti di questi hanno l'assenza verificata in Gazzetta Ufficiale. */
  verified: number;
  computedAt: string;
  caveat: string;
}

export function buildNationalCounter(
  mandates: ReadonlyArray<{ actUrn: string; dueBy: string | null }>,
  today: string,
  verifiedActs: ReadonlySet<string>,
): NationalCounter {
  let totalDaysLate = 0;
  let count = 0;
  const acts = new Set<string>();
  for (const m of mandates) {
    if (!m.dueBy || m.dueBy >= today) continue;
    totalDaysLate += Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${m.dueBy}T00:00:00Z`)) / 86_400_000,
    );
    count++;
    acts.add(m.actUrn);
  }
  return {
    // L'etichetta dice **quello che abbiamo misurato**, non quello che sarebbe
    // più efficace dire. Misuriamo che un termine di legge è scaduto; non
    // verifichiamo, oggi, se il provvedimento sia poi stato adottato. Chiamare
    // questi «provvedimenti mai adottati» sarebbe un titolo migliore e
    // un'affermazione che non possiamo sostenere — e una sola affermazione
    // falsa su una legge distrugge più di quanto dieci corrette costruiscano.
    label:
      'Giorni trascorsi dalla scadenza dei termini fissati per i provvedimenti attuativi previsti',
    totalDaysLate,
    mandates: count,
    acts: acts.size,
    verified: [...acts].filter((a) => verifiedActs.has(a)).length,
    computedAt: today,
    caveat:
      'Il conteggio riguarda i soli atti presenti nel corpus ingerito e i soli mandati con un termine espresso nel testo: da questo lato è una sottostima. Dall’altro lato misura termini scaduti, non attuazioni mancate — che il provvedimento sia stato adottato dopo la scadenza non lo verifichiamo ancora in Gazzetta Ufficiale, se non per la quota indicata come verificata.',
  };
}
