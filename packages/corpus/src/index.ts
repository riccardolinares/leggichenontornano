/**
 * `@leggichenontornano/corpus`
 *
 * Ingestione dagli open data di Normattiva, store bitemporale su PostgreSQL e
 * grafo tipizzato delle relazioni fra atti.
 *
 * Il grafo è il prodotto: gli archi sono tipizzati (modifica, abroga, rinvia,
 * attua, deroga, sostituisce) e datati. Il motore delle anomalie di livello 1
 * non fa altro che percorrerlo.
 *
 * Fonte dei dati: Normattiva open data (dati.normattiva.it), licenza CC BY 4.0.
 * La banca dati Normattiva non ha carattere di ufficialità: l'unico testo
 * ufficiale è quello pubblicato sulla Gazzetta Ufficiale.
 */
export * from './normattiva/client.js';
export * from './normattiva/collections.js';
export * from './ingest/read-collection.js';
export * from './ingest/records.js';
export * from './graph/href.js';
export * from './graph/build-relations.js';
export * from './graph/preambolo.js';
export * from './source-rank.js';
export * from './store/client.js';
export * from './store/read.js';
export * from './store/write.js';
export * from './store/graph-queries.js';
export * from './pipeline.js';
export * from './consulta/index.js';
export * from './gazzetta/index.js';
export { exportSnapshot, type ExportOptions } from './snapshot/export.js';
export {
  SnapshotReader,
  readJson,
  readJsonl,
  readManifest,
  snapshotPath,
  writeJson,
  writeJsonl,
  SNAPSHOT_FILES,
  DISCLAIMER,
  ATTRIBUTION,
} from './snapshot/index.js';
export type {
  SnapshotAct,
  SnapshotAnalisiAssistita,
  SnapshotAnomaly,
  SnapshotArticle,
  SnapshotCheckMetric,
  SnapshotCounter,
  SnapshotData,
  SnapshotManifest,
  SnapshotRelation,
  SnapshotVersion,
  SnapshotVertical,
  SnapshotPronuncia,
  SnapshotVerifica,
} from './snapshot/index.js';
