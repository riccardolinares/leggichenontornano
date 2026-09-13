/**
 * `@leggichenontornano/corpus/gazzetta`
 *
 * La verifica in Gazzetta Ufficiale dei provvedimenti attuativi.
 *
 * Sta nel pacchetto del corpus, accanto a `consulta/`, e non in un pacchetto
 * suo. La ragione è la direzione delle dipendenze: lo schema Prisma e
 * l'esportazione del dataset vivono qui, e una verifica che scrive una tabella
 * ed esce nello snapshot dovrebbe dipendere dal corpus mentre il corpus
 * dipende da lei. `consulta/` è lo stesso problema già risolto nello stesso
 * modo: una fonte esterna, il suo client, la sua tabella, le sue righe nel
 * dataset.
 *
 * Il confine di questo modulo, come per `consulta/`, è netto: guarda se un
 * provvedimento è stato pubblicato e ne copia gli estremi. Non valuta se sia
 * un buon provvedimento, non decide se il ritardo sia giustificato, non
 * interpreta. Quando non riesce a guardare, lo dice.
 */
export * from './citazione.js';
export * from './pagine.js';
export * from './client.js';
export * from './verifica.js';
export * from './archivio.js';
