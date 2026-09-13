/**
 * L'accesso ai dati del sito.
 *
 * Il sito legge il **dataset**, non il database. Tre conseguenze volute:
 *
 *  1. la generazione statica non richiede un PostgreSQL in piedi;
 *  2. chi scarica il dataset può rigenerare il sito e verificare che dica le
 *     stesse cose, il che è il senso di pubblicare un dataset;
 *  3. sito e dataset non possono divergere, perché sono la stessa cosa letta due
 *     volte.
 */
import { SnapshotReader } from '@antinomia/corpus';
import { join } from 'node:path';

const DIR =
  process.env['ANTINOMIA_SNAPSHOT'] ?? join(process.cwd(), '..', '..', 'data', 'snapshot');

let cached: SnapshotReader | null = null;

export function dataset(): SnapshotReader {
  if (!cached) cached = SnapshotReader.fromDirectory(DIR);
  return cached;
}

/** Base pubblica del sito, per gli URL assoluti nei metadati social. */
export const SITE_URL = (process.env['ANTINOMIA_SITE_URL'] ?? 'https://leleggichenontornano.it').replace(
  /\/+$/,
  '',
);

/** Repository pubblica: il pulsante «Non è un conflitto» apre una issue qui. */
export const REPO_URL =
  process.env['ANTINOMIA_REPO_URL'] ?? 'https://github.com/riccardolinares/leggichenontornano';
