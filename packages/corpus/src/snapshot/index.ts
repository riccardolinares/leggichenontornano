/**
 * `@leggichenontornano/corpus/snapshot`
 *
 * Il dataset derivato: come si scrive dal database e come si rilegge senza.
 * Il sito pubblico consuma **questo**, non il database: in questo modo la
 * generazione statica non ha bisogno di un PostgreSQL in piedi, e chiunque
 * scarichi il dataset può ricostruire il sito e verificare che dica le stesse
 * cose.
 */
export * from './types.js';
export * from './io.js';
export * from './reader.js';
