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
import { SnapshotReader } from '@leggichenontornano/corpus';
import { join } from 'node:path';

const DIR = process.env['LCNT_SNAPSHOT'] ?? join(process.cwd(), '..', '..', 'data', 'snapshot');

let cached: SnapshotReader | null = null;

export function dataset(): SnapshotReader {
  if (!cached) cached = SnapshotReader.fromDirectory(DIR);
  return cached;
}

/** Base pubblica del sito, per gli URL assoluti nei metadati social. */
export const SITE_URL = (process.env['LCNT_SITE_URL'] ?? 'https://leggichenontornano.it').replace(
  /\/+$/,
  '',
);

/** Repository pubblica: il pulsante «Non è un conflitto» apre una issue qui. */
export const REPO_URL =
  process.env['LCNT_REPO_URL'] ?? 'https://github.com/riccardolinares/leggichenontornano';

/** Indirizzo di contatto pubblico, unico per stampa, correzioni e sicurezza. */
export const EMAIL = 'info@leggichenontornano.it';

/**
 * Dove si sostiene il progetto.
 *
 * Sta qui e non sparso nelle pagine perché è un indirizzo che cambia: il
 * giorno che cambia deve cambiare in un posto solo, non in quattro.
 */
export const SOSTIENI_URL =
  process.env['LCNT_SOSTIENI_URL'] ?? 'https://buymeacoffee.com/leggichenontornano';

/**
 * Chi c'è dietro il progetto.
 *
 * Un progetto che chiede agli altri di dichiarare da dove vengono i propri
 * numeri dice anche chi lo fa. E l'idea non è di chi scrive il codice: se ne
 * dà atto qui, dove si vede, non in una riga di ringraziamenti in fondo a un
 * file che non apre nessuno.
 *
 * Gli indirizzi sono senza parametri di tracciamento: un `?s=11` incollato da
 * un telefono dice a X da quale app arriva chi clicca, ed è una cosa che
 * questo sito non fa fare a nessuno.
 */
export const PERSONE = [
  { nome: 'Riccardo Linares', ruolo: 'fondatore', x: 'riccardolinares' },
  { nome: '@dom_gag_96', ruolo: 'co-fondatore', x: 'dom_gag_96' },
  { nome: '@antoniodongu', ruolo: 'l’idea di partenza', x: 'antoniodongu' },
] as const;

/** L'account del progetto su X, per l'attribuzione delle anteprime. */
export const X_PROGETTO = '@riccardolinares';
