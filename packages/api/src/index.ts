/**
 * `@leggichenontornano/api`
 *
 * L'API pubblica del progetto. È stata scritta **prima** del frontend, e il
 * frontend ne è il primo consumatore: se il sito avesse una via d'accesso
 * privilegiata al database, l'API pubblica sarebbe documentazione invece di un
 * prodotto, e si accorgerebbe di essere rotta solo quando se ne lamenta qualcuno.
 */
export * from './router.js';
export * from './source.js';
export { openApiDocument } from './openapi.js';
