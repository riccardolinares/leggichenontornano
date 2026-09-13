/**
 * `@leggichenontornano/consumi`
 *
 * Quanto costa far girare questo progetto, misurato invece che stimato a occhio.
 *
 * Due proprietà del pacchetto sono architetturali, non stilistiche:
 *
 *  1. **Il prezzo sta in un file solo** (`prezzi.ts`), con la data da cui vale.
 *     Un prezzo sparso nel codice è un prezzo che nessuno aggiorna.
 *  2. **La misura non si può dimenticare**: si avvolge il client del modello
 *     (`clienteModello`), non i chiamanti. Chi aggiunge un uso nuovo scrive una
 *     riga in più e il registro si riempie da solo; chi non la scrive non ha
 *     nessun client con cui chiamare.
 */
export * from './prezzi.js';
export * from './registro.js';
export * from './cliente.js';
export * from './sessione.js';
