/**
 * URN:NIR — la chiave primaria del corpus.
 *
 * Sintassi di riferimento (AIPA, circolare 6/2001 e successive note tecniche):
 *
 *   urn:nir:<autorità>:<tipo.provvedimento>:<data>;<numero>[:<allegato>][~<partizione>][@<versione>][$<lingua>]
 *
 * Esempi reali presenti negli open data di Normattiva:
 *
 *   urn:nir:stato:legge:1990-08-07;241
 *   urn:nir:stato:decreto.legislativo:2016-04-18;50
 *   urn:nir:stato:decreto.legislativo:2010-07-02;104#Allegato 1 Codice del processo amministrativo-art. 120
 *
 * Le funzioni di questo modulo non normalizzano silenziosamente: un URN che non
 * rispetta la sintassi produce un errore, perché un URN sbagliato che passa
 * inosservato diventa una segnalazione su una norma che non esiste.
 */

export interface UrnNir {
  /** Autorità emanante, es. `stato`, `regione.lombardia`, `corte.costituzionale`. */
  authority: string;
  /** Tipo di provvedimento normalizzato, es. `legge`, `decreto.legislativo`. */
  measureType: string;
  /** Data del provvedimento in formato ISO `YYYY-MM-DD`. */
  date: string;
  /** Numero del provvedimento come stringa (può contenere `bis`, `ter`, ...). */
  number: string;
  /** Allegato, quando l'URN punta a un allegato dell'atto. */
  annex?: string;
  /** Partizione interna, es. `art3`, `art3-com2`, `art3-com2-let-a`. */
  partition?: string;
  /** Data di vigenza richiesta, formato ISO. */
  version?: string;
  /** Lingua, es. `it`. */
  language?: string;
}

export class UrnParseError extends Error {
  constructor(
    readonly input: string,
    reason: string,
  ) {
    super(`URN:NIR non valido (${reason}): ${input}`);
    this.name = 'UrnParseError';
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parte "atto" dell'URN, prima di qualunque partizione/versione/lingua. */
const ACT_RE =
  /^urn:nir:(?<authority>[^:]+):(?<measureType>[^:]+):(?<date>[^;:]+);(?<number>[^:~@$]+)(?::(?<annex>[^~@$]+))?$/;

/**
 * Analizza un URN:NIR. Solleva `UrnParseError` se la stringa non è un URN NIR
 * sintatticamente valido.
 */
export function parseUrn(input: string): UrnNir {
  if (typeof input !== 'string' || input.length === 0) {
    throw new UrnParseError(String(input), 'stringa vuota');
  }
  const trimmed = input.trim();
  if (!trimmed.toLowerCase().startsWith('urn:nir:')) {
    throw new UrnParseError(input, 'prefisso `urn:nir:` mancante');
  }

  // Si stacca prima la lingua, poi la versione, poi la partizione: l'ordine è
  // quello inverso rispetto alla concatenazione, così i separatori che possono
  // comparire dentro un allegato non confondono lo split.
  let rest = trimmed;
  let language: string | undefined;
  let version: string | undefined;
  let partition: string | undefined;

  const dollar = rest.indexOf('$');
  if (dollar >= 0) {
    language = rest.slice(dollar + 1);
    rest = rest.slice(0, dollar);
    if (language.length === 0) throw new UrnParseError(input, 'lingua vuota dopo `$`');
  }

  const at = rest.indexOf('@');
  if (at >= 0) {
    version = rest.slice(at + 1);
    rest = rest.slice(0, at);
    if (!ISO_DATE.test(version)) {
      throw new UrnParseError(input, 'versione non in formato YYYY-MM-DD');
    }
  }

  const tilde = rest.indexOf('~');
  if (tilde >= 0) {
    partition = rest.slice(tilde + 1);
    rest = rest.slice(0, tilde);
    if (partition.length === 0) throw new UrnParseError(input, 'partizione vuota dopo `~`');
  }

  const m = ACT_RE.exec(rest);
  if (!m || !m.groups) {
    throw new UrnParseError(input, 'struttura `autorità:tipo:data;numero` non riconosciuta');
  }
  const { authority, measureType, date, number, annex } = m.groups as Record<string, string>;
  if (!ISO_DATE.test(date!)) {
    throw new UrnParseError(input, 'data non in formato YYYY-MM-DD');
  }

  const urn: UrnNir = {
    authority: authority!.toLowerCase(),
    measureType: measureType!.toLowerCase(),
    date: date!,
    number: number!,
  };
  if (annex) urn.annex = annex;
  if (partition) urn.partition = partition;
  if (version) urn.version = version;
  if (language) urn.language = language;
  return urn;
}

/** Variante non lanciante: restituisce `null` invece di sollevare. */
export function tryParseUrn(input: string): UrnNir | null {
  try {
    return parseUrn(input);
  } catch {
    return null;
  }
}

/** Serializza un URN:NIR nella sua forma canonica. */
export function formatUrn(urn: UrnNir): string {
  let out = `urn:nir:${urn.authority}:${urn.measureType}:${urn.date};${urn.number}`;
  if (urn.annex) out += `:${urn.annex}`;
  if (urn.partition) out += `~${urn.partition}`;
  if (urn.version) out += `@${urn.version}`;
  if (urn.language) out += `$${urn.language}`;
  return out;
}

/**
 * URN dell'atto, privo di partizione, versione e lingua. È la chiave con cui gli
 * atti sono identificati nello store.
 */
export function actUrn(urn: UrnNir | string): string {
  const u = typeof urn === 'string' ? parseUrn(urn) : urn;
  const base: UrnNir = {
    authority: u.authority,
    measureType: u.measureType,
    date: u.date,
    number: u.number,
  };
  if (u.annex) base.annex = u.annex;
  return formatUrn(base);
}

/** Due URN si riferiscono allo stesso atto? (ignora partizione/versione/lingua) */
export function sameAct(a: UrnNir | string, b: UrnNir | string): boolean {
  return actUrn(a) === actUrn(b);
}

/**
 * Codifica un URN per l'uso in un segmento di path.
 *
 * `:` `;` `~` `@` `$` sono tutti caratteri leciti in un segmento di path
 * (RFC 3986 §3.3: pchar include `:` `@` e i sub-delims, fra cui `;` e `$`; `~`
 * è unreserved), quindi non vengono percentificati: l'URN resta leggibile
 * nell'URL, come richiesto dalla ADR 0008. Vengono invece codificati spazi e
 * caratteri non ASCII, che compaiono negli URN di allegato.
 */
export function urnToPathSegment(urn: UrnNir | string): string {
  const s = typeof urn === 'string' ? urn : formatUrn(urn);
  return encodeURIComponent(s)
    .replace(/%3A/gi, ':')
    .replace(/%3B/gi, ';')
    .replace(/%24/gi, '$')
    .replace(/%40/gi, '@')
    .replace(/~/g, '~');
}

/** Inversa di `urnToPathSegment`. */
export function pathSegmentToUrn(segment: string): UrnNir {
  return parseUrn(decodeURIComponent(segment));
}

/**
 * Etichetta leggibile ad alta voce, es. «legge 7 agosto 1990, n. 241».
 * Usata nei titoli e nelle schede: sul sito la forma tecnica non deve mai
 * comparire da sola senza una forma leggibile accanto.
 */
export function humanLabel(urn: UrnNir | string): string {
  const u = typeof urn === 'string' ? parseUrn(urn) : urn;
  const tipo = u.measureType.replace(/\./g, ' ');
  const [y, m, d] = u.date.split('-');
  const mese = MESI[Number(m) - 1] ?? m;
  const base = `${tipo} ${Number(d)} ${mese} ${y}, n. ${u.number}`;
  const label = base.charAt(0).toUpperCase() + base.slice(1);
  if (!u.partition) return label;
  return `${formatPartition(u.partition)} ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

/**
 * Rende leggibile una partizione: `art3-com2-let-a` → «art. 3, comma 2, lett. a)».
 */
export function formatPartition(partition: string): string {
  const parts: string[] = [];
  const re =
    /(art|com|let|num|sez|cap|tit|lib|par)[-.]?([0-9a-z]+(?:-(?:bis|ter|quater|quinquies|sexies|septies|octies))?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(partition)) !== null) {
    const kind = m[1]!.toLowerCase();
    const value = m[2]!;
    switch (kind) {
      case 'art':
        parts.push(`art. ${value}`);
        break;
      case 'com':
        parts.push(`comma ${value}`);
        break;
      case 'let':
        parts.push(`lett. ${value})`);
        break;
      case 'num':
        parts.push(`n. ${value}`);
        break;
      case 'sez':
        parts.push(`sez. ${value}`);
        break;
      case 'cap':
        parts.push(`capo ${value}`);
        break;
      case 'tit':
        parts.push(`titolo ${value}`);
        break;
      case 'lib':
        parts.push(`libro ${value}`);
        break;
      case 'par':
        parts.push(`par. ${value}`);
        break;
    }
  }
  return parts.length > 0 ? parts.join(', ') : partition;
}

/** Estrae il numero di articolo da una partizione, se presente. */
export function articleOf(partition: string | undefined): string | null {
  if (!partition) return null;
  const m =
    /art[-.]?([0-9]+(?:-(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?)/i.exec(
      partition,
    );
  return m ? m[1]!.toLowerCase() : null;
}

/** Estrae il numero di comma da una partizione, se presente. */
export function paragraphOf(partition: string | undefined): string | null {
  if (!partition) return null;
  const m =
    /com[-.]?([0-9]+(?:-(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?)/i.exec(
      partition,
    );
  return m ? m[1]!.toLowerCase() : null;
}
