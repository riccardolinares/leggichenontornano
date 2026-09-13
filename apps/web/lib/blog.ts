/**
 * Gli articoli del blog, letti dai file versionati.
 *
 * Stessa scelta del dataset: il sito legge file, non un database. Un articolo
 * sbagliato si corregge con una pull request, e la cronologia di chi ha
 * scritto cosa la tiene git.
 */
import { leggiArticoli, type Articolo, type Sezione } from '@leggichenontornano/redazione';
import { join } from 'node:path';

const CARTELLA = process.env['LCNT_BLOG'] ?? join(process.cwd(), '..', '..', 'data', 'blog');

let cache: Articolo[] | null = null;

export function articoli(): Articolo[] {
  if (cache === null) cache = leggiArticoli(CARTELLA);
  return cache;
}

export function articolo(slug: string): Articolo | null {
  return articoli().find((a) => a.slug === slug) ?? null;
}

export type { Articolo, Sezione };
