/**
 * La pipeline di ingestione.
 *
 * Un'esecuzione = un istante di conoscenza. Tutte le righe scritte in un giro
 * condividono lo stesso `knownAt`, altrimenti le finestre di conoscenza si
 * frastagliano e la domanda «cosa sapevamo il giorno X» smette di avere una
 * risposta netta.
 */
import { randomUUID } from 'node:crypto';
import { buildRecords } from './ingest/records.js';
import { readCollection } from './ingest/read-collection.js';
import { getPrisma } from './store/client.js';
import {
  emptyStats,
  refreshAbrogationFlags,
  writeBundle,
  writeRelations,
  type WriteStats,
} from './store/write.js';

export interface IngestOptions {
  /** Cartella con la collezione Normattiva già estratta. */
  dir: string;
  /** Nome della collezione, registrato sugli atti. */
  collection?: string;
  /** Numero massimo di atti, per i giri di prova. */
  limit?: number;
  /** Se `false`, non genera gli archi `RINVIA` (molti e non sempre necessari). */
  includeReferences?: boolean;
  onProgress?: (message: string) => void;
}

export interface IngestReport {
  runId: string;
  stats: WriteStats;
  timelines: number;
  errors: Array<{ path: string; message: string }>;
  abrogationFlagsUpdated: number;
  durationMs: number;
}

export async function ingestDirectory(opts: IngestOptions): Promise<IngestReport> {
  const prisma = getPrisma();
  const startedAt = Date.now();
  const knownAt = new Date();
  const runId = randomUUID();

  await prisma.pipelineRun.create({
    data: { id: runId, startedAt: knownAt, status: 'in-corso' },
  });

  const log = opts.onProgress ?? (() => undefined);
  log(`lettura di ${opts.dir}`);
  const { timelines, fileByVersion, errors } = readCollection(opts.dir, {
    ...(opts.limit === undefined ? {} : { limit: opts.limit }),
  });
  log(`${timelines.length} atti, ${errors.length} file non leggibili`);

  const stats = emptyStats();
  const bundles = timelines.map((timeline) =>
    buildRecords(timeline, {
      collection: opts.collection ?? null,
      fileByVersion,
      ...(opts.includeReferences === undefined
        ? {}
        : { includeReferences: opts.includeReferences }),
    }),
  );

  // Prima tutti gli atti, poi tutte le relazioni: un arco può puntare a un atto
  // che sta più avanti nell'elenco, e la chiave esterna non perdona l'ordine.
  let done = 0;
  for (const bundle of bundles) {
    await writeBundle(bundle, knownAt, stats);
    done++;
    if (done % 25 === 0) log(`${done}/${bundles.length} atti scritti`);
  }

  const knownActs = new Set((await prisma.act.findMany({ select: { urn: true } })).map((a) => a.urn));
  for (const bundle of bundles) {
    await writeRelations(bundle.act.urn, bundle.relations, knownAt, knownActs, stats);
  }
  log(`${stats.relationsInserted} archi nuovi, ${stats.relationsSuperseded} chiusi`);

  const abrogationFlagsUpdated = await refreshAbrogationFlags();
  log(`${abrogationFlagsUpdated} atti marcati abrogati`);

  const durationMs = Date.now() - startedAt;
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      status: errors.length > 0 ? 'completata-con-errori' : 'completata',
      actsIngested: stats.acts,
      relations: stats.relationsInserted,
      notes:
        errors.length > 0
          ? `${errors.length} file non leggibili; primo: ${errors[0]?.path ?? ''}`
          : null,
    },
  });

  return { runId, stats, timelines: timelines.length, errors, abrogationFlagsUpdated, durationMs };
}

/**
 * Prepara gli indici che Prisma non sa esprimere: la ricerca full-text usa il
 * dizionario italiano di PostgreSQL, e senza un indice GIN su
 * `to_tsvector('italian', text)` ogni ricerca è una scansione completa.
 */
export async function ensureSearchIndexes(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS article_text_it_idx
    ON "Article"
    USING GIN (to_tsvector('italian', "text"))
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS provision_text_it_idx
    ON "Provision"
    USING GIN (to_tsvector('italian', "text"))
  `);
}
