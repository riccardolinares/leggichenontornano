/**
 * Il cancello di pubblicazione.
 *
 * > Un tipo di controllo si pubblica solo quando la revisione umana su campione
 * > supera l'**85% di precisione**, con almeno **30 revisioni**.
 *
 * La regola è qui, in codice, ed è applicata nel punto di esportazione: non è
 * lasciata alla disciplina di chi pubblica (ADR 0002). Si può cambiare la
 * soglia, ma cambiarla è un diff visibile in una pull request, non una
 * decisione presa una sera.
 *
 * Un controllo di **livello 1 e deterministico** non salta il cancello: salta
 * solo il requisito di campione minimo finché non ha revisioni, perché il suo
 * fondamento è un attraversamento del grafo e non un'estrazione probabilistica.
 * Appena arrivano revisioni, vale la soglia come per tutti — e se scende sotto
 * l'85% smette di pubblicare, perché significa che la regola è sbagliata.
 *
 * **I livelli 2 e 3 non hanno questa esenzione, nemmeno quando sono
 * deterministici.** Il controllo sulle fonti secondarie non usa alcun modello,
 * eppure ha una precisione attesa del 70-85%, perché esiste un caso legittimo
 * che i metadati non distinguono: la delegificazione autorizzata. «Non usa un
 * modello» e «non sbaglia» sono due cose diverse, e confonderle è il modo in cui
 * un progetto come questo pubblica la sua prima segnalazione falsa.
 */
import type { AnomalyFinding, CheckDefinition } from './types.js';

export const THRESHOLD = {
  /** Precisione minima perché un controllo sia pubblicabile. */
  minPrecision: 0.85,
  /** Numero minimo di revisioni umane perché la precisione sia considerata misurata. */
  minSample: 30,
} as const;

export interface ReviewTally {
  checkId: string;
  /** Revisioni totali registrate. */
  reviewed: number;
  /** Revisioni che hanno confermato la segnalazione. */
  confirmed: number;
}

export interface GateDecision {
  checkId: string;
  published: boolean;
  precision: number | null;
  reviewed: number;
  confirmed: number;
  /** Perché è (o non è) pubblicato, in lingua comune, da mostrare nella pagina Dati. */
  reason: string;
}

/**
 * Decide se un controllo può pubblicare.
 *
 * Restituisce sempre una motivazione: la pagina «Dati» mostra anche i controlli
 * che non pubblicano, con il perché. Dichiarare cosa non pubblichiamo è la parte
 * che regge l'esame di un giurista ostile.
 */
export function evaluateGate(
  definition: CheckDefinition,
  tally: ReviewTally | undefined,
): GateDecision {
  const reviewed = tally?.reviewed ?? 0;
  const confirmed = tally?.confirmed ?? 0;
  const precision = reviewed > 0 ? confirmed / reviewed : null;

  if (reviewed >= THRESHOLD.minSample) {
    const ok = (precision ?? 0) >= THRESHOLD.minPrecision;
    return {
      checkId: definition.id,
      published: ok,
      precision,
      reviewed,
      confirmed,
      reason: ok
        ? `Precisione misurata del ${pct(precision)} su ${reviewed} revisioni: sopra la soglia dell'${pct(THRESHOLD.minPrecision)}.`
        : `Precisione misurata del ${pct(precision)} su ${reviewed} revisioni: sotto la soglia dell'${pct(THRESHOLD.minPrecision)}. Le segnalazioni di questo controllo restano nella coda interna.`,
    };
  }

  if (definition.deterministic && definition.level === 1) {
    return {
      checkId: definition.id,
      published: true,
      precision,
      reviewed,
      confirmed,
      reason:
        reviewed === 0
          ? `Controllo deterministico di livello 1: nessuna estrazione automatica, solo attraversamento del grafo e confronto di date. Pubblicato in attesa delle prime ${THRESHOLD.minSample} revisioni umane, dopo le quali varrà la soglia dell'${pct(THRESHOLD.minPrecision)} come per ogni altro controllo.`
          : `Controllo deterministico. Finora ${confirmed} conferme su ${reviewed} revisioni (${pct(precision)}); servono ${THRESHOLD.minSample} revisioni perché la precisione sia considerata misurata.`,
    };
  }

  return {
    checkId: definition.id,
    published: false,
    precision,
    reviewed,
    confirmed,
    reason:
      definition.level === 1
        ? `Campione insufficiente: ${reviewed} revisioni su ${THRESHOLD.minSample} necessarie. Una precisione del 100% su tre casi non è una precisione. Le segnalazioni restano nella coda interna.`
        : `Controllo di livello ${definition.level}: la precisione attesa è ${definition.expectedPrecision}. Campione insufficiente (${reviewed} revisioni su ${THRESHOLD.minSample} necessarie): le segnalazioni restano nella coda interna finché la misura non esiste.`,
  };
}

/**
 * Applica il cancello a un insieme di segnalazioni.
 *
 * Le segnalazioni non pubblicabili **non vengono scartate**: vengono restituite
 * separatamente, perché finiscono nella coda di revisione. Buttarle via
 * significherebbe non poterle mai far salire sopra soglia.
 */
export function applyGate(
  findings: readonly AnomalyFinding[],
  decisions: ReadonlyMap<string, GateDecision>,
): { published: AnomalyFinding[]; queued: AnomalyFinding[] } {
  const published: AnomalyFinding[] = [];
  const queued: AnomalyFinding[] = [];
  for (const finding of findings) {
    if (decisions.get(finding.checkId)?.published) published.push(finding);
    else queued.push(finding);
  }
  return { published, queued };
}

function pct(value: number | null): string {
  if (value === null) return 'n.d.';
  return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
