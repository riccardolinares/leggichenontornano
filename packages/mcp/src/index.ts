/**
 * `@antinomia/mcp`
 *
 * Un server MCP che mette «Le leggi che non tornano» dentro un assistente.
 *
 * Il progetto esiste perché una segnalazione falsa su una legge fa più danno di
 * quanto dieci corrette costruiscano. Un assistente che riassume è il posto in
 * cui quel rischio aumenta, non diminuisce: taglia le cautele per primo, perché
 * sono la parte meno interessante da riassumere.
 *
 * Perciò questo server non espone un'API più comoda. Espone gli stessi dati con
 * le stesse avvertenze attaccate al testo — testo originale prima dei campi
 * estratti, regola in chiaro invece di una motivazione inventata, non
 * ufficialità in ogni risposta — e nessuno strumento a cui si possa chiedere un
 * giudizio.
 */
export * from './sorgente.js';
export * from './strumenti.js';
export { creaServer, STRUMENTI } from './server.js';
export { registraEsempi, NOMI_ESEMPI } from './esempi.js';
