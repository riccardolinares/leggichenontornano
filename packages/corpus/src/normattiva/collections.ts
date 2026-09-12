/**
 * Scarico ed estrazione delle collezioni predefinite di Normattiva.
 *
 * Struttura dell'archivio, verificata sulle collezioni reali:
 *
 *   LEGGE COSTITUZIONALE_19630131_1/
 *     1963-02-01_063C0001_ORIGINALE_V0.xml
 *     1963-02-01_063C0001_VIGENZA_1972-03-22_V1.xml
 *     ...
 *
 * cioè una cartella per atto e un file per versione, con la data di vigenza nel
 * nome del file. È da lì che viene la multivigenza.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import { NormattivaClient, type CollectionFormat } from './client.js';

export interface DownloadOptions {
  /** Cartella in cui estrarre. */
  destDir: string;
  format?: CollectionFormat;
  client?: NormattivaClient;
  /** Chiamata per ogni file estratto, per il log di avanzamento. */
  onFile?: (path: string, index: number, total: number) => void;
}

export interface DownloadResult {
  collection: string;
  format: CollectionFormat;
  files: string[];
  bytes: number;
  sha256: string;
}

/**
 * Scarica una collezione ed estrae i file XML sul disco, restituendo anche
 * l'impronta dell'archivio: serve a dire, in una release del dataset, esattamente
 * da quale byte di origine deriva.
 */
export async function downloadCollection(
  name: string,
  opts: DownloadOptions,
): Promise<DownloadResult> {
  const client = opts.client ?? new NormattivaClient();
  const format = opts.format ?? 'M';
  const zip = await client.downloadCollection(name, format);
  const sha256 = createHash('sha256').update(zip).digest('hex');
  const entries = unzipSync(zip);
  const names = Object.keys(entries).filter((n) => n.toLowerCase().endsWith('.xml'));
  const written: string[] = [];
  names.forEach((entryName, i) => {
    const target = join(opts.destDir, entryName);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entries[entryName]!);
    written.push(target);
    opts.onFile?.(target, i + 1, names.length);
  });
  return { collection: name, format, files: written, bytes: zip.byteLength, sha256 };
}

/** Estrae un archivio già scaricato. Usata dai test, che non toccano la rete. */
export function extractArchive(zip: Uint8Array, destDir: string): string[] {
  const entries = unzipSync(zip);
  const written: string[] = [];
  for (const [entryName, data] of Object.entries(entries)) {
    if (!entryName.toLowerCase().endsWith('.xml')) continue;
    const target = join(destDir, entryName);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    written.push(target);
  }
  return written;
}
