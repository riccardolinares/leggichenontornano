/**
 * Estrattore deontico di riferimento, a regole.
 *
 * Non è il sostituto del modello linguistico: è la **base di confronto**. Ogni
 * estrattore, modello incluso, si misura contro questo, e la differenza fra le
 * due precisioni è ciò che dice se il modello sta aggiungendo valore o solo
 * varianza. Un progetto che introduce un modello senza una base contro cui
 * misurarlo non sa mai se ne ha bisogno.
 *
 * È anche l'estrattore predefinito: il layer semantico funziona senza chiamare
 * alcun servizio esterno, con recall basso e precisione dichiarata. Chi clona il
 * repository ottiene un sistema che gira.
 */
import type {
  DeonticExtractor,
  DeonticMode,
  DeonticProposition,
  ExtractionInput,
} from './types.js';
import { VocabularyIndex } from './vocabulary.js';

/**
 * Marcatori deontici dell'italiano normativo, in ordine di precedenza.
 *
 * L'ordine conta: «non può» è un divieto, non un potere, e va intercettato prima
 * del marcatore di potere che contiene.
 */
// Attenzione ai confini di parola: in JavaScript `\b` usa l'alfabeto ASCII, e
// `/\bpuò\b/` non corrisponde mai perché fra `ò` e lo spazio non c'è alcun
// confine. Dopo una vocale accentata si usa un lookahead esplicito.
const FINE = '(?![a-zà-ù])';
const MODE_MARKERS: Array<[RegExp, DeonticMode]> = [
  [
    new RegExp(
      `\\bè\\s+vietat[oa]${FINE}|\\bnon\\s+(?:può|possono)${FINE}|\\bsono\\s+vietat[ei]${FINE}|\\bè\\s+fatto\\s+divieto${FINE}|\\bnon\\s+è\\s+consentit[oa]${FINE}`,
      'i',
    ),
    'DIVIETO',
  ],
  [
    new RegExp(
      `\\bdeve${FINE}|\\bdevono${FINE}|\\bè\\s+tenut[oa]${FINE}|\\bsono\\s+tenut[ei]${FINE}|\\bè\\s+obbligat[oa]${FINE}|\\bha\\s+l['’]obbligo${FINE}|\\bè\\s+fatto\\s+obbligo${FINE}|\\bsono\\s+obbligat[ei]${FINE}`,
      'i',
    ),
    'OBBLIGO',
  ],
  [new RegExp(`\\bè\\s+onere${FINE}|\\ba\\s+pena\\s+di\\s+decadenza${FINE}`, 'i'), 'ONERE'],
  [
    new RegExp(`\\bpuò${FINE}|\\bpossono${FINE}|\\b(?:è|ha)\\s+facoltà${FINE}`, 'i'),
    'POTERE',
  ],
  [
    new RegExp(
      `\\bè\\s+consentit[oa]${FINE}|\\bè\\s+ammess[oa]${FINE}|\\bsono\\s+ammess[ei]${FINE}|\\bè\\s+permess[oa]${FINE}`,
      'i',
    ),
    'PERMESSO',
  ],
];

const DEADLINE_RE =
  /entro\s+(?:il\s+termine\s+di\s+)?([a-zà-ù]+|\d+)\s+(giorni|giorno|mesi|mese|anni|anno)/i;

const NUMBER_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7,
  otto: 8, nove: 9, dieci: 10, dodici: 12, quindici: 15, venti: 20, trenta: 30,
  quaranta: 40, quarantacinque: 45, cinquanta: 50, sessanta: 60, novanta: 90,
  centoventi: 120, centottanta: 180,
};

const CONSEQUENCE_RE =
  /\b(?:a\s+pena\s+di\s+[^.;]+|si\s+applica\s+(?:la|una)\s+sanzione[^.;]*|è\s+punit[oa][^.;]*|comporta\s+[^.;]*decadenz[^.;]*)/i;

const CONDITION_RE = /\b(?:qualora|nel\s+caso\s+in\s+cui|se\s+(?!non\b)|quando|previa|a\s+condizione\s+che)\b[^.;]*/gi;

const EXCEPTION_RE = /\b(?:salvo|fatt[oa]\s+salv[oa]|ad\s+eccezione\s+di|fatta\s+eccezione\s+per|tranne)\b[^.;]*/gi;

export interface RuleBasedOptions {
  /** Lunghezza minima di una frase perché valga la pena analizzarla. */
  minSentenceLength?: number;
}

export class RuleBasedExtractor implements DeonticExtractor {
  readonly name = 'regole/1.0';
  private readonly minSentenceLength: number;

  constructor(opts: RuleBasedOptions = {}) {
    this.minSentenceLength = opts.minSentenceLength ?? 30;
  }

  extract(input: ExtractionInput): DeonticProposition[] {
    const index = new VocabularyIndex(input.vocabulary);
    const out: DeonticProposition[] = [];

    for (const sentence of splitSentences(input.text)) {
      if (sentence.length < this.minSentenceLength) continue;
      const mode = detectMode(sentence);
      if (!mode) continue;

      const subject = extractSubject(sentence, mode);
      const concept = index.resolve(subject) ?? index.resolve(sentence);
      const deadline = DEADLINE_RE.exec(sentence);
      const consequence = CONSEQUENCE_RE.exec(sentence);

      out.push({
        urn: input.urn,
        provisionId: input.provisionId,
        mode,
        subject: subject.slice(0, 200),
        subjectConcept: concept?.id ?? null,
        object: extractObject(sentence, mode).slice(0, 300),
        deadlineDays: deadline ? toDays(deadline[1]!, deadline[2]!) : null,
        deadlineText: deadline ? deadline[0] : null,
        consequence: consequence ? consequence[0].trim() : null,
        conditions: matchAll(sentence, CONDITION_RE),
        exceptions: matchAll(sentence, EXCEPTION_RE),
        scope: index.resolveAll(sentence)[0]?.id ?? null,
        vertical: input.vertical,
        inForceFrom: input.inForceFrom,
        inForceTo: input.inForceTo,
        extractor: this.name,
        quote: sentence,
      });
    }

    return out;
  }
}

export function detectMode(sentence: string): DeonticMode | null {
  for (const [re, mode] of MODE_MARKERS) {
    if (re.test(sentence)) return mode;
  }
  return null;
}

/**
 * Soggetto: la porzione di frase che precede il marcatore deontico.
 *
 * È un'approssimazione dichiarata, ed è precisamente la ragione per cui esiste
 * l'interfaccia `DeonticExtractor`: un modello linguistico fa questo lavoro
 * molto meglio. Quello che il modello **non** deve fare è il passo successivo.
 */
export function extractSubject(sentence: string, mode: DeonticMode): string {
  for (const [re, m] of MODE_MARKERS) {
    if (m !== mode) continue;
    const match = re.exec(sentence);
    if (match && match.index > 0) {
      return sentence.slice(0, match.index).replace(/^[\s,;:]+/, '').trim();
    }
  }
  return sentence.slice(0, 120).trim();
}

/** Oggetto: la porzione che segue il marcatore deontico. */
export function extractObject(sentence: string, mode: DeonticMode): string {
  for (const [re, m] of MODE_MARKERS) {
    if (m !== mode) continue;
    const match = re.exec(sentence);
    if (match) {
      return sentence.slice(match.index + match[0].length).replace(/^[\s,;:]+/, '').trim();
    }
  }
  return '';
}

export function toDays(value: string, unit: string): number | null {
  const n = /^\d+$/.test(value) ? Number(value) : NUMBER_WORDS[value.toLowerCase()];
  if (!n) return null;
  const u = unit.toLowerCase();
  if (u.startsWith('giorn')) return n;
  if (u.startsWith('mes')) return Math.round(n * 30.44);
  if (u.startsWith('ann')) return Math.round(n * 365.25);
  return null;
}

/** Le frasi del testo normativo, separate su punto e punto e virgola. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function matchAll(text: string, re: RegExp): string[] {
  const local = new RegExp(re.source, re.flags);
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = local.exec(text)) !== null) {
    out.push(m[0].trim());
    if (out.length >= 5) break;
  }
  return out;
}
