/**
 * Il registro dei consumi, letto dai file versionati.
 *
 * Stessa scelta del dataset e del blog: il sito legge file, non un servizio.
 * Chi scarica il repository ha in mano le stesse righe da cui la pagina dei
 * costi calcola i suoi totali, e può rifare il conto.
 */
import {
  leggiRegistro,
  riepiloga,
  type Riepilogo,
  type RigaConsumo,
} from '@leggichenontornano/consumi';
import { join } from 'node:path';

const CARTELLA = process.env['LCNT_CONSUMI'] ?? join(process.cwd(), '..', '..', 'data', 'consumi');

let cache: RigaConsumo[] | null = null;

export function consumi(): RigaConsumo[] {
  if (cache === null) cache = leggiRegistro(CARTELLA);
  return cache;
}

export function riepilogoConsumi(): Riepilogo {
  return riepiloga(consumi());
}

export type { Riepilogo, RigaConsumo };
