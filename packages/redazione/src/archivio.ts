/**
 * Gli articoli su disco.
 *
 * Una cartella, un file JSON per articolo, il nome del file è lo slug. Non è
 * elegante ed è esattamente il punto: si legge con `cat`, si corregge con un
 * editor, e la cronologia la tiene git.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Articolo } from './articolo.js';

export const CARTELLA_PREDEFINITA = 'data/blog';

export function leggiArticoli(cartella = CARTELLA_PREDEFINITA): Articolo[] {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(cartella, f), 'utf8')) as Articolo)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.slug < b.slug ? 1 : -1));
}

export function scriviArticolo(articolo: Articolo, cartella = CARTELLA_PREDEFINITA): string {
  mkdirSync(cartella, { recursive: true });
  const percorso = join(cartella, `${articolo.slug}.json`);
  writeFileSync(percorso, `${JSON.stringify(articolo, null, 2)}\n`, 'utf8');
  return percorso;
}

/** Le segnalazioni già raccontate: non si scrive due volte della stessa. */
export function giaRaccontate(cartella = CARTELLA_PREDEFINITA): Set<string> {
  return new Set(leggiArticoli(cartella).map((a) => a.anomaliaId));
}

/** C'è già un articolo per questo giorno? Serve a non pubblicarne due. */
export function articoloDelGiorno(
  giorno: string,
  cartella = CARTELLA_PREDEFINITA,
): Articolo | null {
  return leggiArticoli(cartella).find((a) => a.data === giorno) ?? null;
}
