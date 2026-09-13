/**
 * Un albero XML minimale, costruito sopra `fast-xml-parser` in modalità
 * `preserveOrder`.
 *
 * L'ordine dei figli conta: il testo normativo è contenuto misto
 * (`<p>ai sensi dell'<ref>art. 76</ref> della Costituzione</p>`) e un parser che
 * separa attributi, elementi e testo in tre insiemi distinti restituisce frasi
 * mescolate. Qui si conserva l'ordine di documento e basta.
 */
import { XMLParser } from 'fast-xml-parser';

export interface XmlElement {
  readonly kind: 'element';
  readonly name: string;
  /** Nome senza prefisso di namespace, es. `text` per `nakn:text`. */
  readonly localName: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly XmlNode[];
}

export interface XmlText {
  readonly kind: 'text';
  readonly value: string;
}

export type XmlNode = XmlElement | XmlText;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  textNodeName: '#text',
  // Le difese contro l'espansione di entità restano attive, ma vanno tarate sul
  // corpus reale: un codice come il d.lgs. 50/2016 è un file da 3 MB con decine
  // di migliaia di entità legittime, e il tetto predefinito di 1000 espansioni
  // totali lo rifiuta. Il numero di espansioni è comunque limitato
  // linearmente dalla dimensione del file, mentre l'attacco «billion laughs»
  // sfrutta la *profondità* di annidamento: è quella che teniamo bassa, insieme
  // alla lunghezza massima di una singola espansione.
  processEntities: {
    enabled: true,
    maxExpansionDepth: 4,
    maxTotalExpansions: 5_000_000,
    maxEntitySize: 10_000,
    maxExpandedLength: 100_000,
  } as unknown as boolean,
});

type RawNode = Record<string, unknown> & { ':@'?: Record<string, string> };

export function parseXml(xml: string): XmlElement {
  const raw = parser.parse(xml) as RawNode[];
  const nodes = convertMany(raw);
  const root = nodes.find((n): n is XmlElement => n.kind === 'element' && n.localName !== '?xml');
  if (!root) throw new Error('XML privo di elemento radice');
  return root;
}

function convertMany(raw: RawNode[]): XmlNode[] {
  const out: XmlNode[] = [];
  for (const item of raw) {
    const node = convert(item);
    if (node) out.push(node);
  }
  return out;
}

function convert(item: RawNode): XmlNode | null {
  const attrsRaw = item[':@'] as Record<string, string> | undefined;
  const entries = Object.entries(item).filter(([k]) => k !== ':@');
  const first = entries[0];
  if (!first) return null;
  const [name, value] = first;
  if (name === '#text') {
    const text = String(value ?? '');
    return text.length === 0 ? null : { kind: 'text', value: text };
  }
  const attrs: Record<string, string> = {};
  if (attrsRaw) {
    for (const [k, v] of Object.entries(attrsRaw)) {
      attrs[k.startsWith('@_') ? k.slice(2) : k] = String(v);
    }
  }
  const children = Array.isArray(value) ? convertMany(value as RawNode[]) : [];
  const colon = name.indexOf(':');
  return {
    kind: 'element',
    name,
    localName: colon >= 0 ? name.slice(colon + 1) : name,
    attrs,
    children,
  };
}

export function isElement(node: XmlNode): node is XmlElement {
  return node.kind === 'element';
}

/** Figli diretti con il nome locale indicato. */
export function childrenNamed(el: XmlElement, localName: string): XmlElement[] {
  return el.children.filter(
    (c): c is XmlElement => c.kind === 'element' && c.localName === localName,
  );
}

/** Primo figlio diretto con il nome locale indicato. */
export function childNamed(el: XmlElement, localName: string): XmlElement | undefined {
  return childrenNamed(el, localName)[0];
}

/** Tutti i discendenti con il nome locale indicato, in ordine di documento. */
export function descendants(el: XmlElement, localName: string): XmlElement[] {
  const out: XmlElement[] = [];
  walk(el, (node) => {
    if (node.localName === localName) out.push(node);
  });
  return out;
}

/** Primo discendente con il nome locale indicato. */
export function firstDescendant(el: XmlElement, localName: string): XmlElement | undefined {
  let found: XmlElement | undefined;
  walk(el, (node) => {
    if (!found && node.localName === localName) found = node;
  });
  return found;
}

export function walk(el: XmlElement, visit: (el: XmlElement) => void): void {
  for (const child of el.children) {
    if (child.kind === 'element') {
      visit(child);
      walk(child, visit);
    }
  }
}

/**
 * Testo di un elemento, con gli spazi normalizzati.
 *
 * Gli `authorialNote` (le note a piè di pagina redazionali) sono esclusi: non
 * fanno parte del dispositivo e inquinerebbero sia l'estrazione sia il confronto
 * fra versioni.
 */
export function textContent(node: XmlNode, opts: { skipNotes?: boolean } = {}): string {
  const skipNotes = opts.skipNotes ?? true;
  const parts: string[] = [];
  const collect = (n: XmlNode): void => {
    if (n.kind === 'text') {
      parts.push(n.value);
      return;
    }
    if (skipNotes && n.localName === 'authorialNote') return;
    for (const c of n.children) collect(c);
  };
  collect(node);
  return normalizeSpace(parts.join(''));
}

/** Comprime gli spazi e le interruzioni di riga interne al testo normativo. */
export function normalizeSpace(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/[ \t]*\r?\n[ \t]*/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}
