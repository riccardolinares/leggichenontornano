/**
 * Interpretazione delle modifiche dichiarate negli open data di Normattiva.
 *
 * Nel formato Akoma Ntoso di Normattiva l'elemento `<textualMod>` porta sempre
 * `type="insertion"` — l'attributo non distingue un'abrogazione da una proroga —
 * mentre la natura reale della modifica sta nel testo redazionale di
 * `<nakn:text>`, che è però scritto in un formato fisso e quindi analizzabile
 * in modo deterministico:
 *
 *   ha disposto (con l'art. 217, comma 1, lettera ff)) l'abrogazione del comma 1 dell'art. 6.
 *   ha disposto (con l'art. 204, comma 1, lettera a)) la modifica dell'art. 120, comma 1;
 *     (con l'art. 204, comma 1, lettera b)) l'introduzione del comma 2-bis all'art. 120.
 *   ha disposto (con l'art. 2269, comma 1) l'abrogazione dell'intero provvedimento.
 *
 * Questo modulo non indovina: quello che non rientra nella grammatica sopra
 * viene marcato `action: 'altro'` con `confidence: 'bassa'` e il motore delle
 * anomalie di livello 1 lo ignora. Un arco del grafo incerto vale meno di un
 * arco assente, perché è un arco assente che sembra presente.
 */
import type { AknTextualMod, ModificationKind } from './akn.js';

export interface ModificationTarget {
  /** Numero di articolo modificato, es. `120` o `3-bis`. */
  article: string | null;
  /** Commi interessati, es. `['1', '2-bis']`. */
  paragraphs: string[];
  /** Lettere interessate, es. `['d', 'e']`. */
  letters: string[];
  /** Allegato in cui si trova la partizione modificata, se indicato. */
  annex: string | null;
  /** `true` quando la modifica riguarda l'intero provvedimento. */
  wholeAct: boolean;
}

export interface ParsedModification {
  action: ModificationKind;
  /** Partizione dell'atto modificante che dispone la modifica. */
  by: ModificationTarget;
  /** Partizione dell'atto modificato su cui la modifica incide. */
  target: ModificationTarget;
  /** Frammento di testo redazionale da cui questa modifica è stata letta. */
  evidence: string;
  /**
   * `alta` quando la frase rientra pienamente nella grammatica nota,
   * `bassa` quando il verbo non è riconosciuto o manca il bersaglio.
   * Il livello 1 usa solo le modifiche ad alta confidenza.
   */
  confidence: 'alta' | 'bassa';
}

const EMPTY_TARGET: ModificationTarget = {
  article: null,
  paragraphs: [],
  letters: [],
  annex: null,
  wholeAct: false,
};

const ACTION_WORDS: Array<[RegExp, ModificationKind]> = [
  [/\babrogazion\w*/i, 'abrogazione'],
  [/\bsoppressio\w*/i, 'abrogazione'],
  [/\bsostituzion\w*/i, 'sostituzione'],
  [/\bintroduzion\w*|\baggiunt\w*|\binserimento\b/i, 'introduzione'],
  [/\bproroga\w*|\bdifferimento\b/i, 'proroga'],
  [/\bmodific\w*|\brettific\w*/i, 'modifica'],
];

// I suffissi ordinali compaiono sia attaccati con il trattino (`3-bis`) sia
// staccati da uno spazio (`3 bis`), e possono accumularsi (`3-bis-ter`).
const ORDINAL_SUFFIX =
  '(?:[-\\s]?(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies))*';
const ARTICLE_RE = new RegExp(`\\bart(?:icolo|\\.)?\\s*(\\d+${ORDINAL_SUFFIX})`, 'gi');
const PARAGRAPH_RE = new RegExp(`\\bcomm[ai]\\s*((?:\\d+${ORDINAL_SUFFIX})(?:\\s*(?:,|e|ed)\\s*\\d+${ORDINAL_SUFFIX})*)`, 'gi');
const LETTER_RE =
  /\blettere?\s+((?:[a-z]{1,3}(?:-(?:bis|ter|quater|quinquies))?\)(?:\s*(?:,|ed|e)\s*)?)+)/gi;
const ANNEX_RE = /\ballegato\s+([A-Z0-9]+(?:-[A-Z0-9]+)?)/i;
const WHOLE_ACT_RE = /\bintero\s+provvedimento\b|\bintero\s+atto\b|\bpresente\s+provvedimento\b/i;
/**
 * «l'abrogazione della legge 20 giugno 1966, n. 579»: la modifica non colpisce
 * una partizione ma un intero atto, che è quello già identificato dall'URN in
 * `<destination>`. Vale come bersaglio a tutti gli effetti.
 */
const WHOLE_NAMED_ACT_RE =
  /\b(?:legge(?:\s+costituzionale)?|decreto[-\s]legge|decreto\s+legislativo|decreto\s+del\s+presidente\s+della\s+repubblica|regio\s+decreto|testo\s+unico|r\.?d\.?|d\.?p\.?r\.?|d\.?lgs\.?|d\.?l\.?)\s+(?:\d{1,2}\s+\w+\s+)?\d{4},?\s*n\.\s*\d+/i;

/** Marcatore che apre la parte dispositiva: `(con l'art. 217, comma 1, lettera a))`. */
const BY_MARKER_RE = /\(\s*con\s+l['’]\s*art[^)]*\)\s*\)?/gi;

/**
 * Analizza il testo redazionale di una `<textualMod>` e restituisce zero o più
 * modifiche strutturate. Una singola `<textualMod>` può dichiararne molte.
 */
export function parseModificationNarrative(narrative: string | null | undefined): ParsedModification[] {
  if (!narrative) return [];
  const text = narrative.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return [];

  const markers = [...text.matchAll(BY_MARKER_RE)];
  if (markers.length === 0) {
    // Nessun marcatore `(con l'art. ...)`: si prova comunque a leggere la frase
    // intera come una sola modifica, ma a bassa confidenza.
    const single = readFragment(text, EMPTY_TARGET, text, false);
    return single ? [single] : [];
  }

  const out: ParsedModification[] = [];
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    const start = marker.index! + marker[0].length;
    const end = i + 1 < markers.length ? markers[i + 1]!.index! : text.length;
    const by = readTarget(marker[0]);
    const fragment = text.slice(start, end).trim();
    // Un frammento preceduto dal marcatore viene sempre emesso, anche quando la
    // grammatica non lo copre: resta a bassa confidenza e il livello 1 lo ignora,
    // ma non sparisce in silenzio dal grafo.
    const parsed = readFragment(fragment, by, `${marker[0]} ${fragment}`.trim(), true);
    if (parsed) out.push(parsed);
  }
  return out;
}

function readFragment(
  fragment: string,
  by: ModificationTarget,
  evidence: string,
  force: boolean,
): ParsedModification | null {
  const action = detectAction(fragment);
  const target = readTarget(fragment);
  const hasTarget =
    target.article !== null ||
    target.wholeAct ||
    target.paragraphs.length > 0 ||
    target.annex !== null;
  if (action === null && !hasTarget && !force) return null;
  return {
    action: action ?? 'altro',
    by,
    target,
    evidence: evidence.replace(/\s+/g, ' ').trim(),
    confidence: action !== null && hasTarget ? 'alta' : 'bassa',
  };
}

function detectAction(fragment: string): ModificationKind | null {
  for (const [re, kind] of ACTION_WORDS) {
    if (re.test(fragment)) return kind;
  }
  return null;
}

function readTarget(fragment: string): ModificationTarget {
  const articles = matchAll(fragment, ARTICLE_RE).map(normalizeOrdinal);
  const paragraphs = matchAll(fragment, PARAGRAPH_RE).flatMap(splitList).map(normalizeOrdinal);
  const letters = matchAll(fragment, LETTER_RE)
    .flatMap(splitLetters)
    .map((s) => s.toLowerCase());
  const annexMatch = ANNEX_RE.exec(fragment);
  return {
    // Quando compaiono più articoli (es. «del comma 1 dell'art. 6») quello
    // modificato è l'ultimo citato: il primo, se c'è, appartiene alla
    // preposizione che introduce la partizione.
    article: articles.length > 0 ? articles[articles.length - 1]! : null,
    paragraphs: unique(paragraphs),
    letters: unique(letters),
    annex: annexMatch ? annexMatch[1]!.trim() : null,
    wholeAct: WHOLE_ACT_RE.test(fragment) || WHOLE_NAMED_ACT_RE.test(fragment),
  };
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const local = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = local.exec(text)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

/**
 * Separa un elenco come «1, 2 e 3». La congiunzione va riconosciuta solo quando
 * è circondata da spazi: in «lettere d) ed e)» una `e` isolata fa parte del
 * token, non è il separatore.
 */
function splitList(value: string): string[] {
  return value
    .split(/\s*,\s*|\s+ed?\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Estrae i singoli token lettera da un elenco come «d) ed e)». */
function splitLetters(value: string): string[] {
  const out: string[] = [];
  const re = /([a-z]{1,3}(?:-(?:bis|ter|quater|quinquies))?)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) out.push(m[1]!);
  return out;
}

function normalizeOrdinal(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(
      /(\d)(bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|undecies|duodecies)/g,
      '$1-$2',
    );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Comodità: analizza tutte le `<textualMod>` di un atto in un colpo solo. */
export function parseModifications(
  mods: readonly AknTextualMod[],
): Array<ParsedModification & { source: string | null; destination: string | null; eId: string }> {
  const out: Array<
    ParsedModification & { source: string | null; destination: string | null; eId: string }
  > = [];
  for (const mod of mods) {
    for (const parsed of parseModificationNarrative(mod.narrative)) {
      out.push({ ...parsed, source: mod.source, destination: mod.destination, eId: mod.eId });
    }
  }
  return out;
}
