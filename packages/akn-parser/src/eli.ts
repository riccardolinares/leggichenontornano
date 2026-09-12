/**
 * ELI — European Legislation Identifier, nella declinazione italiana adottata da
 * Normattiva e dalla Gazzetta Ufficiale.
 *
 * Schema dichiarato dagli atti stessi (`eli:uri_schema`):
 *
 *   http://www.normattiva.it/eli/id/{yyyy}/{mm}/{dd}/{codiceRedazionale}/{tipoVersione}
 *
 * Le versioni consolidate aggiungono la data di vigenza come ultimo segmento:
 *
 *   eli/id/1963/02/01/063C0001/CONSOLIDATED/20130303
 */

export type EliVersionKind = 'ORIGINAL' | 'CONSOLIDATED';

export interface EliId {
  /** Anno di pubblicazione in Gazzetta Ufficiale. */
  year: string;
  /** Mese di pubblicazione, due cifre. */
  month: string;
  /** Giorno di pubblicazione, due cifre. */
  day: string;
  /** Codice redazionale della Gazzetta Ufficiale, es. `16G00062`. */
  editorialCode: string;
  /** `ORIGINAL` per il testo originale, `CONSOLIDATED` per una versione vigente. */
  versionKind: EliVersionKind;
  /** Data di vigenza in formato ISO, presente solo sulle versioni consolidate. */
  inForceAt?: string;
}

const ELI_RE =
  /(?:^|\/)eli\/id\/(\d{4})\/(\d{2})\/(\d{2})\/([A-Za-z0-9]+)\/(ORIGINAL|CONSOLIDATED)(?:\/(\d{8}))?\/?$/;

export function parseEli(input: string): EliId | null {
  const m = ELI_RE.exec(input.trim());
  if (!m) return null;
  const [, year, month, day, editorialCode, kind, compact] = m;
  const eli: EliId = {
    year: year!,
    month: month!,
    day: day!,
    editorialCode: editorialCode!,
    versionKind: kind as EliVersionKind,
  };
  if (compact) {
    eli.inForceAt = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return eli;
}

export function formatEli(eli: EliId): string {
  const base = `eli/id/${eli.year}/${eli.month}/${eli.day}/${eli.editorialCode}/${eli.versionKind}`;
  if (eli.versionKind === 'CONSOLIDATED' && eli.inForceAt) {
    return `${base}/${eli.inForceAt.replace(/-/g, '')}`;
  }
  return base;
}

/** URI ELI risolvibile presso Normattiva. */
export function eliUri(eli: EliId): string {
  return `https://www.normattiva.it/${formatEli(eli)}`;
}

/** Data di pubblicazione in Gazzetta Ufficiale, formato ISO. */
export function publicationDate(eli: EliId): string {
  return `${eli.year}-${eli.month}-${eli.day}`;
}
