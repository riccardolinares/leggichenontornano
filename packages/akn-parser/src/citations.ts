/**
 * Riconoscimento delle citazioni di atti nel testo redazionale.
 *
 * Serve a una cosa precisa, e vale la pena dire quale perché è nata da un caso
 * reale. Negli open data esiste una `<textualMod>` il cui testo dice
 *
 *   «ha disposto (con l'art. 1, comma 2) l'abrogazione del D.L. 8 marzo 2020, n. 11»
 *
 * mentre il suo `<destination href>` punta al d.lgs. 104/2010, cioè al codice
 * del processo amministrativo. Preso per buono, quell'unico arco marca come
 * abrogato il codice del processo amministrativo e, a cascata, fa sembrare
 * sbagliate sette modifiche successive perfettamente regolari. Un arco
 * sbagliato, sette segnalazioni false su leggi vere.
 *
 * Con questo modulo la narrativa e l'ancoraggio si possono confrontare: quando
 * dicono due cose diverse, l'arco nasce a bassa confidenza e i controlli di
 * livello 1 lo ignorano.
 */
import { formatUrn, type UrnNir } from './urn.js';

/** Abbreviazioni e forme estese, dalla più specifica alla più generica. */
const TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\blegge\s+costituzionale\b|\bl\.\s*cost\.?\b/i, 'legge.costituzionale'],
  [/\bdecreto[-\s]legge\b|\bd\.?\s*l\.\s*(?=\d)/i, 'decreto.legge'],
  [/\bdecreto\s+legislativo\b|\bd\.?\s*lgs\.?\b|\bd\.?\s*l\.?gs\.?\b/i, 'decreto.legislativo'],
  [
    /\bdecreto\s+del\s+presidente\s+della\s+repubblica\b|\bd\.?\s*p\.?\s*r\.?\b/i,
    'decreto.del.presidente.della.repubblica',
  ],
  [
    /\bdecreto\s+del\s+presidente\s+del\s+consiglio(?:\s+dei\s+ministri)?\b|\bd\.?\s*p\.?\s*c\.?\s*m\.?\b/i,
    'decreto.del.presidente.del.consiglio.dei.ministri',
  ],
  [/\bregio\s+decreto\b|\br\.?\s*d\.?\s*(?=\d)/i, 'regio.decreto'],
  [/\bdecreto\s+ministeriale\b|\bd\.?\s*m\.?\s*(?=\d)/i, 'decreto.ministeriale'],
  [/\blegge\b|\bl\.\s*(?=\d)/i, 'legge'],
  [/\bdecreto\b/i, 'decreto'],
];

const MESI: Readonly<Record<string, string>> = {
  gennaio: '01',
  febbraio: '02',
  marzo: '03',
  aprile: '04',
  maggio: '05',
  giugno: '06',
  luglio: '07',
  agosto: '08',
  settembre: '09',
  ottobre: '10',
  novembre: '11',
  dicembre: '12',
};

/**
 * La parte datata della citazione: «8 marzo 2020, n. 11».
 *
 * Il tipo di atto **non** è dentro questa espressione. Il motivo è pratico: le
 * abbreviazioni contengono punti («D.L.», «D.Lgs.») e qualunque classe di
 * caratteri che escluda il punto per non scavalcare la frase precedente
 * escluderebbe anche l'abbreviazione che stiamo cercando. Si trova prima la
 * data, poi si guardano i 60 caratteri che la precedono.
 */
const DATED_RE = new RegExp(
  // Il giorno può portare il marcatore ordinale: «1° ottobre 2007» è la grafia
  // corrente nei testi normativi italiani per il primo del mese, e senza
  // questo carattere nell'espressione quelle citazioni sparivano in silenzio.
  // Nel corpus ingerito la forma compare in oltre quattromila articoli, e su
  // una pronuncia della Corte costituzionale saltare la prima citazione voleva
  // dire attribuire la declaratoria di illegittimità alla legge di conversione
  // invece che al decreto-legge.
  String.raw`(\d{1,2})\s*[°º]?\s+(${Object.keys(MESI).join('|')})\s+(\d{4})\s*,?\s*n\.\s*(\d+(?:[-\s]?(?:bis|ter|quater))?)`,
  'gi',
);

/** Quanti caratteri prima della data si cerca il tipo di atto. */
const LOOKBEHIND = 60;

export interface ActCitation {
  /** URN:NIR ricostruito dalla citazione. */
  urn: string;
  measureType: string;
  date: string;
  number: string;
  /** Testo da cui la citazione è stata letta. */
  raw: string;
}

/** Tutte le citazioni di atti presenti in un testo, in ordine di comparsa. */
export function parseActCitations(text: string, authority = 'stato'): ActCitation[] {
  const out: ActCitation[] = [];
  const re = new RegExp(DATED_RE.source, DATED_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [matched, day, month, year, number] = m;
    const start = Math.max(0, m.index - LOOKBEHIND);
    // Il contesto si interrompe al punto e virgola e alle parentesi chiuse: sono
    // i separatori che in queste narrative dividono una disposizione dall'altra.
    const prefix = lastSegment(text.slice(start, m.index));
    // Il tipo si cerca su prefisso **e** data insieme: le abbreviazioni come
    // «D.L.» si riconoscono solo guardando la cifra che le segue, che sta nella
    // parte datata («D.L. 8 marzo 2020»).
    const measureType = detectType(`${prefix}${matched}`);
    if (!measureType) continue;
    const raw = `${prefix.trim()} ${matched}`.trim();
    const urn: UrnNir = {
      authority,
      measureType,
      date: `${year}-${MESI[month!.toLowerCase()]}-${day!.padStart(2, '0')}`,
      number: number!.replace(/\s+/g, '-').toLowerCase(),
    };
    out.push({
      urn: formatUrn(urn),
      measureType,
      date: urn.date,
      number: urn.number,
      raw: raw.trim(),
    });
  }
  return out;
}

/** La prima citazione di atto in un testo, se c'è. */
export function parseActCitation(text: string, authority = 'stato'): ActCitation | null {
  return parseActCitations(text, authority)[0] ?? null;
}

/** L'ultimo segmento di contesto prima della data, senza la disposizione precedente. */
function lastSegment(context: string): string {
  const cut = Math.max(context.lastIndexOf(';'), context.lastIndexOf(')'));
  return cut >= 0 ? context.slice(cut + 1) : context;
}

function detectType(prefix: string): string | null {
  for (const [re, type] of TYPES) {
    if (re.test(prefix)) return type;
  }
  return null;
}

/**
 * La narrativa e l'ancoraggio indicano lo stesso atto?
 *
 * `null` quando la narrativa non nomina alcun atto: in quel caso non c'è
 * disaccordo, c'è silenzio, e il silenzio non è un motivo per declassare un arco.
 */
export function citationAgreesWith(narrative: string, destinationUrn: string): boolean | null {
  const citation = parseActCitation(narrative);
  if (!citation) return null;
  return sameActUrn(citation.urn, destinationUrn);
}

function sameActUrn(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(urn: string): string {
  return urn.split(/[~@$]/)[0]!.toLowerCase();
}
