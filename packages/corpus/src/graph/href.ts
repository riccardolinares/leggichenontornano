/**
 * Normalizzazione dei riferimenti che compaiono negli open data.
 *
 * Negli stessi file convivono almeno tre forme di `href`, e vanno ricondotte a
 * una chiave sola perché il grafo funzioni:
 *
 *   /akn/it/act/legge/stato/1988-08-23/400/!main#art_14
 *   urn:nir:stato:decreto.legislativo:2010-07-02;104#Allegato 1 ...-art. 120
 *   /akn/it/act/direttivaUe/eu/2014/23/!main
 *
 * La terza non è normativa statale: è un rinvio sovranazionale e va tenuto
 * distinto, non forzato dentro un URN:NIR che non gli appartiene.
 */
import { actUrn, tryParseUrn } from '@antinomia/akn-parser';

export type NormalizedRefKind = 'nir' | 'eu' | 'sconosciuto';

export interface NormalizedRef {
  kind: NormalizedRefKind;
  /** URN:NIR dell'atto, per `kind: 'nir'`. */
  urn: string | null;
  /** Articolo referenziato, quando deducibile dal frammento. */
  article: string | null;
  /** Comma referenziato, quando deducibile. */
  paragraph: string | null;
  /** Allegato referenziato, quando deducibile. */
  annex: string | null;
  /** Identificatore dell'atto UE, per `kind: 'eu'`. */
  euId: string | null;
  /** `href` originale, conservato come prova. */
  raw: string;
}

const EMPTY: Omit<NormalizedRef, 'raw' | 'kind'> = {
  urn: null,
  article: null,
  paragraph: null,
  annex: null,
  euId: null,
};

export function normalizeHref(href: string): NormalizedRef {
  const raw = href.trim();
  if (raw.length === 0 || raw === '#') {
    return { kind: 'sconosciuto', ...EMPTY, raw: href };
  }

  const hash = raw.indexOf('#');
  const base = hash >= 0 ? raw.slice(0, hash) : raw;
  const fragment = hash >= 0 ? raw.slice(hash + 1) : '';

  if (base.toLowerCase().startsWith('urn:nir:')) {
    const parsed = tryParseUrn(base);
    if (!parsed) return { kind: 'sconosciuto', ...EMPTY, raw };
    const frag = readFragment(fragment);
    return {
      kind: 'nir',
      urn: actUrn(parsed),
      article: parsed.partition ? articleFromPartition(parsed.partition) : frag.article,
      paragraph: frag.paragraph,
      annex: frag.annex,
      euId: null,
      raw,
    };
  }

  if (base.startsWith('/akn/')) {
    const fromPath = fromAknPath(base);
    if (fromPath === null) return { kind: 'sconosciuto', ...EMPTY, raw };
    if (fromPath.kind === 'eu') {
      return { kind: 'eu', ...EMPTY, euId: fromPath.euId, raw };
    }
    const frag = readFragment(fragment);
    return {
      kind: 'nir',
      urn: fromPath.urn,
      article: frag.article,
      paragraph: frag.paragraph,
      annex: frag.annex,
      euId: null,
      raw,
    };
  }

  return { kind: 'sconosciuto', ...EMPTY, raw };
}

type AknPathResult = { kind: 'nir'; urn: string } | { kind: 'eu'; euId: string };

/** `/akn/it/act/legge/stato/1988-08-23/400/!main` → `urn:nir:stato:legge:1988-08-23;400` */
export function fromAknPath(path: string): AknPathResult | null {
  const segs = path.split('/').filter(Boolean);
  const actIdx = segs.indexOf('act');
  if (actIdx < 0) return null;
  const type = segs[actIdx + 1];
  const authority = segs[actIdx + 2];
  const date = segs[actIdx + 3];
  const number = segs[actIdx + 4];
  if (!type || !authority || !date || !number) return null;

  if (authority === 'eu') {
    return { kind: 'eu', euId: `eu:${type}:${date};${number}` };
  }
  return { kind: 'nir', urn: `urn:nir:${authority}:${normalizeActType(type)}:${date};${number}` };
}

/**
 * Il tipo di atto nei path AKN arriva in due grafie, a volte nello stesso file:
 * `decreto_legislativo` con gli underscore e `decretoLegislativo` in camelCase.
 * L'URN:NIR ne vuole una sola, con i punti. Trattarne una e ignorare l'altra
 * significa perdere in silenzio tutti gli archi scritti nella grafia ignorata —
 * ed è successo: i riferimenti del preambolo, che usano il camelCase, non
 * trovavano mai l'atto citato.
 */
export function normalizeActType(type: string): string {
  return type
    .replace(/_/g, '.')
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .toLowerCase();
}

interface FragmentInfo {
  article: string | null;
  paragraph: string | null;
  annex: string | null;
}

/**
 * I frammenti hanno due dialetti: gli eId Akoma Ntoso (`art_14`, `art_1__para_2`)
 * e il testo redazionale che Normattiva infila negli URN
 * (`Allegato 1 Codice del processo amministrativo-art. 120`).
 */
export function readFragment(fragment: string): FragmentInfo {
  if (!fragment) return { article: null, paragraph: null, annex: null };
  const decoded = safeDecode(fragment);
  const article =
    matchOne(decoded, /art[_.\s]*(\d+(?:[-\s](?:bis|ter|quater|quinquies|sexies|septies|octies))?)/i) ??
    null;
  const paragraph =
    matchOne(decoded, /(?:para|comma|com)[_.\s]*(\d+(?:[-\s](?:bis|ter|quater|quinquies))?)/i) ?? null;
  const annex = matchOne(decoded, /allegato\s+([A-Za-z0-9]+)/i) ?? null;
  return {
    article: article ? normalize(article) : null,
    paragraph: paragraph ? normalize(paragraph) : null,
    annex,
  };
}

function articleFromPartition(partition: string): string | null {
  return matchOne(partition, /art[-.]?(\d+(?:-(?:bis|ter|quater|quinquies))?)/i);
}

function matchOne(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m?.[1] ? normalize(m[1]) : null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
