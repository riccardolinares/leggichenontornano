/**
 * `@leggichenontornano/engine`
 *
 * Il motore delle anomalie: tre livelli di controlli sopra il grafo del corpus,
 * il cancello di pubblicazione all'85% di precisione e la coda di revisione
 * umana che quella percentuale la misura.
 *
 * Due proprietà del pacchetto sono architetturali, non stilistiche:
 *
 *  1. `AnomalyFinding` non ha un campo in cui possa entrare una spiegazione
 *     generata da un modello. I titoli e le spiegazioni in lingua comune vengono
 *     da template di proprietà di ciascun controllo.
 *  2. Nessun percorso di codice invia due norme a un modello chiedendo se si
 *     contraddicono. Il modello, dove è usato, estrae campi da un comma alla
 *     volta; la contraddizione è una query su quei campi.
 */
export * from './types.js';
export * from './corpus-view.js';
export * from './resolution.js';
export * from './publication-gate.js';
export * from './registry.js';
export * from './run.js';
export * from './metrics.js';
export * from './review/queue.js';
export * from './estrazione.js';
export * from './gold.js';
export * from './checks/helpers.js';
export {
  extractMandates,
  allMandates,
  daysLate,
  type Mandate,
  type AttuazioneInput,
} from './checks/level1/attuazione-mancante.js';
export { type TerminiInput } from './checks/level3/termini-divergenti.js';
export * from './deontic/types.js';
export * from './deontic/vocabulary.js';
export * from './deontic/rule-based.js';
export { LlmExtractor, LLM_SYSTEM_PROMPT, LLM_EXTRACTION_TOOL } from './deontic/llm.js';
export type { LlmExtractorOptions, AnthropicLike } from './deontic/llm.js';
