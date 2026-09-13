/**
 * Multivigenza: risolvere «cosa diceva questo articolo a questa data».
 *
 * Negli open data di Normattiva ogni atto aggiornato è distribuito come una
 * serie di file, uno per versione, il cui `FRBRExpression/FRBRdate` è la data di
 * inizio vigenza di quella versione. La l. 241/1990 ne ha oltre sessanta.
 *
 * Una versione resta vigente fino al giorno precedente l'inizio della versione
 * successiva. L'ultima versione è aperta a destra (`inForceTo: null`), a meno
 * che l'atto non risulti abrogato: in quel caso la chiusura la mette il grafo
 * delle relazioni, non questo modulo, che si limita a ciò che il singolo atto
 * dichiara di sé.
 */
import type { AknAct, AknArticle } from './akn.js';

/**
 * Una versione così come arriva dall'ingestione: l'atto analizzato e, quando
 * disponibile, la data di vigenza dichiarata dal nome del file di collezione.
 *
 * Le due fonti non sempre coincidono. Negli open data capita che il
 * `FRBRExpression/FRBRdate` di un file `VIGENZA_1989-01-17_V2` riporti
 * `1967-12-10`, cioè la data della versione precedente. Il nome del file è la
 * chiave con cui Normattiva stessa indicizza la versione e va quindi
 * considerato autorevole; il dato FRBR resta come ripiego quando il nome non è
 * disponibile. La discrepanza viene registrata in `dateConflict`, perché è
 * un'informazione sulla qualità della fonte e non va persa in silenzio.
 */
export interface VersionInput {
  act: AknAct;
  /** Data di vigenza dal nome del file, formato ISO. */
  inForceFrom?: string | null;
}

export interface ActVersion {
  /** Data di inizio vigenza, formato ISO. */
  inForceFrom: string;
  /** Ultimo giorno di vigenza, formato ISO; `null` se ancora aperta. */
  inForceTo: string | null;
  /** Progressivo della versione, 0 per il testo originale. */
  ordinal: number;
  act: AknAct;
  /**
   * Presente quando la data dichiarata dal nome del file e quella del
   * `FRBRExpression` divergono. Si è usata la prima.
   */
  dateConflict?: { fromFileName: string; fromExpression: string };
}

export interface Timeline {
  urn: string;
  versions: ActVersion[];
}

export class MultivigenzaError extends Error {}

/**
 * Costruisce la linea temporale di un atto a partire dalle sue versioni.
 * Le versioni possono arrivare in qualunque ordine; vengono ordinate per data.
 */
export function buildTimeline(inputs: readonly (AknAct | VersionInput)[]): Timeline {
  if (inputs.length === 0) throw new MultivigenzaError('nessuna versione fornita');
  const normalized = inputs.map(toVersionInput);
  const urns = new Set(normalized.map((v) => v.act.urn));
  if (urns.size > 1) {
    throw new MultivigenzaError(
      `le versioni appartengono ad atti diversi: ${[...urns].join(', ')}`,
    );
  }

  const dated = normalized.map((input) => ({ input, from: versionDate(input) }));
  dated.sort(
    (a, b) => cmp(a.from, b.from) || a.input.act.articles.length - b.input.act.articles.length,
  );

  // Due file possono dichiarare la stessa data di vigenza: succede quando una
  // versione non viene rinumerata. Si tiene l'ultima, che è quella con il testo
  // aggiornato, e si scarta la precedente invece di produrre una finestra vuota.
  const deduped: typeof dated = [];
  for (const entry of dated) {
    const last = deduped[deduped.length - 1];
    if (last && last.from === entry.from) deduped[deduped.length - 1] = entry;
    else deduped.push(entry);
  }

  const versions: ActVersion[] = deduped.map((entry, i) => {
    const next = deduped[i + 1];
    const version: ActVersion = {
      inForceFrom: entry.from,
      inForceTo: next ? previousDay(next.from) : null,
      ordinal: i,
      act: entry.input.act,
    };
    const declared = entry.input.inForceFrom;
    const expression = entry.input.act.expressionDate;
    if (declared && expression && declared !== expression) {
      version.dateConflict = { fromFileName: declared, fromExpression: expression };
    }
    return version;
  });
  return { urn: deduped[0]!.input.act.urn, versions };
}

function toVersionInput(input: AknAct | VersionInput): VersionInput {
  return 'act' in input ? input : { act: input };
}

function versionDate(input: VersionInput): string {
  const d =
    input.inForceFrom ??
    input.act.expressionDate ??
    input.act.publication?.date ??
    input.act.workDate;
  if (!d) throw new MultivigenzaError(`versione priva di data: ${input.act.urn}`);
  return d;
}

/** La versione vigente alla data indicata, oppure `null` se la data è anteriore all'atto. */
export function versionAt(timeline: Timeline, date: string): ActVersion | null {
  let found: ActVersion | null = null;
  for (const v of timeline.versions) {
    if (cmp(v.inForceFrom, date) <= 0) found = v;
    else break;
  }
  return found;
}

/** Il testo di un articolo alla data indicata. */
export function articleAt(
  timeline: Timeline,
  articleNumber: string,
  date: string,
): { version: ActVersion; article: AknArticle } | null {
  const version = versionAt(timeline, date);
  if (!version) return null;
  const wanted = articleNumber.toLowerCase();
  const article = version.act.articles.find((a) => a.number === wanted);
  return article ? { version, article } : null;
}

/**
 * Tutte le date in cui il testo di un articolo è cambiato, con il testo
 * corrispondente. È la sorgente della barra di multivigenza nel lettore norma.
 */
export function articleHistory(
  timeline: Timeline,
  articleNumber: string,
): Array<{ from: string; to: string | null; article: AknArticle | null }> {
  const wanted = articleNumber.toLowerCase();
  const out: Array<{ from: string; to: string | null; article: AknArticle | null }> = [];
  for (const v of timeline.versions) {
    const article = v.act.articles.find((a) => a.number === wanted) ?? null;
    const previous = out[out.length - 1];
    // Si collassano le versioni consecutive in cui l'articolo non è cambiato:
    // mostrare venti scalini identici sulla timeline è rumore, non informazione.
    if (previous && sameText(previous.article, article)) {
      previous.to = v.inForceTo;
      continue;
    }
    out.push({ from: v.inForceFrom, to: v.inForceTo, article });
  }
  return out;
}

function sameText(a: AknArticle | null, b: AknArticle | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.text === b.text;
}

/** Intersezione di due finestre temporali; `null` se non si sovrappongono. */
export function intersectWindows(
  a: { from: string; to: string | null },
  b: { from: string; to: string | null },
): { from: string; to: string | null } | null {
  const from = cmp(a.from, b.from) >= 0 ? a.from : b.from;
  const to = minOpen(a.to, b.to);
  if (to !== null && cmp(from, to) > 0) return null;
  return { from, to };
}

/**
 * Due finestre di vigenza si sovrappongono?
 *
 * È il filtro che il motore applica **prima** di qualunque altro confronto: due
 * norme mai vigenti contemporaneamente non sono in contraddizione, e senza
 * questo controllo quella categoria di falsi positivi domina l'output.
 */
export function windowsOverlap(
  a: { from: string; to: string | null },
  b: { from: string; to: string | null },
): boolean {
  return intersectWindows(a, b) !== null;
}

function minOpen(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return cmp(a, b) <= 0 ? a : b;
}

/** Confronto fra date ISO; funziona lessicograficamente ed è quindi esatto. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Giorno precedente a una data ISO. */
export function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Giorno successivo a una data ISO. */
export function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Numero di giorni fra due date ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Oggi in formato ISO, in UTC. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
