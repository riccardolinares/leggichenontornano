/**
 * Lettura di una collezione Normattiva già estratta su disco.
 *
 * Ogni cartella è un atto, ogni file una versione. Il raggruppamento avviene
 * sull'URN:NIR dichiarato dentro il file, non sul nome della cartella: i nomi di
 * cartella sono derivati dalla denominazione e collidono
 * (`DECRETO LEGISLATIVO_20160418_50` è univoco, `DECRETO_19890930_334` meno).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  buildTimeline,
  parseAkn,
  parseVersionFileName,
  type AknAct,
  type Timeline,
} from '@leggichenontornano/akn-parser';

export interface CollectionFile {
  path: string;
  relativePath: string;
  act: AknAct;
  /** Data di vigenza dichiarata dal nome del file, se riconosciuto. */
  inForceFrom: string | null;
  checksum: string;
}

export interface ReadCollectionResult {
  timelines: Timeline[];
  /** Il file di provenienza di ogni versione, indicizzato per `urn|inForceFrom`. */
  fileByVersion: Map<string, CollectionFile>;
  errors: Array<{ path: string; message: string }>;
}

export interface ReadCollectionOptions {
  /** Numero massimo di atti da leggere; utile per i giri di prova. */
  limit?: number;
  onProgress?: (done: number, total: number, path: string) => void;
}

/** Elenca ricorsivamente i file XML di una cartella. */
export function listXmlFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const p = join(current, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.toLowerCase().endsWith('.xml')) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

export function readCollection(
  dir: string,
  opts: ReadCollectionOptions = {},
): ReadCollectionResult {
  const files = listXmlFiles(dir);
  const errors: Array<{ path: string; message: string }> = [];
  const byUrn = new Map<string, CollectionFile[]>();

  let done = 0;
  for (const path of files) {
    done++;
    opts.onProgress?.(done, files.length, path);
    let entry: CollectionFile;
    try {
      const xml = readFileSync(path, 'utf8');
      const act = parseAkn(xml);
      if (!act.urn) {
        errors.push({ path, message: 'atto privo di URN:NIR' });
        continue;
      }
      entry = {
        path,
        relativePath: relative(dir, path),
        act,
        inForceFrom: parseVersionFileName(path)?.inForceFrom ?? null,
        checksum: createHash('sha256').update(xml).digest('hex'),
      };
    } catch (err) {
      // Un file illeggibile non ferma l'ingestione: viene registrato e saltato.
      // Il conteggio degli errori finisce nel report della pipeline, perché un
      // corpus che perde il 3% dei file in silenzio è peggio di uno che si ferma.
      errors.push({ path, message: err instanceof Error ? err.message : String(err) });
      continue;
    }
    const list = byUrn.get(entry.act.urn);
    if (list) list.push(entry);
    else {
      if (opts.limit !== undefined && byUrn.size >= opts.limit) continue;
      byUrn.set(entry.act.urn, [entry]);
    }
  }

  const timelines: Timeline[] = [];
  const fileByVersion = new Map<string, CollectionFile>();
  for (const [urn, entries] of byUrn) {
    try {
      const timeline = buildTimeline(
        entries.map((e) => ({ act: e.act, inForceFrom: e.inForceFrom })),
      );
      timelines.push(timeline);
      for (const version of timeline.versions) {
        const file = entries.find(
          (e) => (e.inForceFrom ?? e.act.expressionDate) === version.inForceFrom,
        );
        if (file) fileByVersion.set(versionKey(urn, version.inForceFrom), file);
      }
    } catch (err) {
      errors.push({ path: urn, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { timelines, fileByVersion, errors };
}

export function versionKey(urn: string, inForceFrom: string): string {
  return `${urn}|${inForceFrom}`;
}
