/**
 * I tipi del grafo, e i nomi dei legami.
 *
 * Stanno in un file loro e non in `grafo.ts` per una ragione precisa: il
 * componente del browser ha bisogno delle **etichette** delle famiglie, non
 * solo dei tipi. Importarle da `grafo.ts` trascinerebbe nel pacchetto del
 * client anche `dataset.ts`, che legge file da disco — e la build si ferma su
 * `node:fs`. Qui dentro non c'è niente che non possa attraversare la rete.
 */

export interface NodoGrafo {
  urn: string;
  nome: string;
  /** Quanti archi tocca: decide il raggio. */
  grado: number;
  /** Quanti archi partono da qui, cioè quante altre norme questa tira in ballo. */
  uscenti: number;
  /** Quanti archi arrivano qui: è la misura di quanto una norma sia un perno. */
  entranti: number;
  /** `true` se l'atto non è più in vigore: sono i buchi verso cui puntano gli altri. */
  abrogato: boolean;
  /**
   * `true` se di questa norma abbiamo solo il nome, perché qualcun altro la
   * cita ma il testo non è ancora stato ingerito.
   *
   * Va distinta a vista dalle altre: un nodo pieno vuol dire «questo testo
   * l'abbiamo letto», e prometterlo per una norma che non abbiamo sarebbe la
   * bugia più facile da fare con un disegno.
   */
  fuoriCorpus: boolean;
  /** Quante segnalazioni pubblicate lo coinvolgono. */
  segnalazioni: number;
  /** `true` se punta ad almeno una norma abrogata. */
  puntaAlVuoto: boolean;
  x: number;
  y: number;
}

/**
 * Le famiglie in cui i tipi di relazione si raggruppano per il disegno.
 *
 * Sette colori diversi sono sette cose da ricordare, e nessuno le ricorda. Le
 * famiglie invece rispondono alla domanda che uno si fa guardando un arco:
 * *che cosa ha fatto questa norma a quell'altra?* La rimanda, la riscrive, la
 * cancella, l'attua, o gliel'ha tolta di mezzo la Corte.
 */
export type Famiglia = 'rinvio' | 'modifica' | 'abrogazione' | 'attuazione' | 'illegittimita';

export const FAMIGLIA_DI: Record<string, Famiglia> = {
  RINVIA: 'rinvio',
  MODIFICA: 'modifica',
  INTRODUCE: 'modifica',
  PROROGA: 'modifica',
  ABROGA: 'abrogazione',
  ATTUA: 'attuazione',
  DICHIARA_ILLEGITTIMO: 'illegittimita',
};

export const ETICHETTA_FAMIGLIA: Record<Famiglia, string> = {
  rinvio: 'rimanda a',
  modifica: 'riscrive',
  abrogazione: 'cancella',
  attuazione: 'attua',
  illegittimita: 'dichiarata illegittima',
};

export interface ArcoGrafo {
  da: string;
  a: string;
  tipo: string;
  famiglia: Famiglia;
  /** Quante relazioni distinte stanno dietro questo arco. */
  peso: number;
  /** `true` se il bersaglio non è più in vigore. */
  rotto: boolean;
}

export interface Grafo {
  nodi: NodoGrafo[];
  archi: ArcoGrafo[];
  tipi: string[];
  famiglie: Famiglia[];
  /** Quante relazioni del dataset stanno dietro gli archi disegnati. */
  relazioni: number;
  /** Dimensioni della tela su cui le coordinate sono calcolate. */
  larghezza: number;
  altezza: number;
  /** Data del dataset da cui il disegno è stato calcolato. */
  conosciutoAl: string;
}
