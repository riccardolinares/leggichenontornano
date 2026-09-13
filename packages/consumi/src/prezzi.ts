/**
 * Il listino: **l'unico posto del progetto in cui compare un prezzo**.
 *
 * Un prezzo scritto dentro il codice che fa la chiamata è un prezzo che nessuno
 * aggiorna: il giorno che cambia, cambia in un file e resta vecchio negli altri
 * tre, e da lì in poi la pagina dei costi dice una cifra che non è mai esistita.
 * Qui invece sta in un elenco, e chi lo aggiorna **aggiunge una riga** invece di
 * modificarne una.
 *
 * Aggiungere invece di modificare è il punto: ogni riga porta la data da cui
 * vale, e il costo di una chiamata si calcola con il listino **in vigore quel
 * giorno**. Riscrivere il prezzo vecchio riscriverebbe anche la storia — la
 * spesa dell'anno scorso ricalcolata ai prezzi di oggi non è la spesa dell'anno
 * scorso, e la pagina che la mostra racconterebbe una bugia ogni volta che un
 * listino cambia.
 *
 * Le cifre sono quelle pubblicate da Anthropic per l'API di prima parte, in
 * dollari per milione di token. Non sono una fattura: il costo che questo
 * progetto pubblica è **stimato**, e la pagina lo dice.
 */

/** La valuta del listino. L'API si paga in dollari, e lo diciamo. */
export const VALUTA = 'USD';

export interface Prezzo {
  /** Identificatore esatto del modello, come arriva nella risposta dell'API. */
  modello: string;
  /** Da quando vale questo prezzo (ISO, `AAAA-MM-GG`). */
  daQuando: string;
  /** Dollari per milione di token in ingresso. */
  ingresso: number;
  /** Dollari per milione di token in uscita. */
  uscita: number;
  /** Dollari per milione di token scritti nella cache del prompt. */
  cacheScrittura: number;
  /** Dollari per milione di token letti dalla cache del prompt. */
  cacheLettura: number;
}

/**
 * Il listino, riga per riga.
 *
 * Ordinato per modello e poi per data: chi aggiunge un prezzo nuovo lo mette in
 * coda al gruppo del suo modello, con la data da cui vale. Non si cancella
 * niente.
 */
export const LISTINO: readonly Prezzo[] = [
  // Famiglia Opus: la usa la redazione del blog e il confronto assistito.
  {
    modello: 'claude-opus-5',
    daQuando: '2026-01-01',
    ingresso: 5,
    uscita: 25,
    cacheScrittura: 6.25,
    cacheLettura: 0.5,
  },
  {
    modello: 'claude-opus-4-8',
    daQuando: '2026-01-01',
    ingresso: 5,
    uscita: 25,
    cacheScrittura: 6.25,
    cacheLettura: 0.5,
  },
  {
    modello: 'claude-opus-4-7',
    daQuando: '2026-01-01',
    ingresso: 5,
    uscita: 25,
    cacheScrittura: 6.25,
    cacheLettura: 0.5,
  },
  {
    modello: 'claude-opus-4-6',
    daQuando: '2026-01-01',
    ingresso: 5,
    uscita: 25,
    cacheScrittura: 6.25,
    cacheLettura: 0.5,
  },
  // Famiglia Sonnet e Haiku: non le usiamo nel percorso principale, ma un
  // contributore che dichiara il proprio consumo può averle usate, e senza il
  // prezzo la sua riga varrebbe zero — che è peggio di non averla.
  {
    modello: 'claude-sonnet-5',
    daQuando: '2026-01-01',
    ingresso: 2,
    uscita: 10,
    cacheScrittura: 2.5,
    cacheLettura: 0.2,
  },
  {
    modello: 'claude-sonnet-4-6',
    daQuando: '2026-01-01',
    ingresso: 3,
    uscita: 15,
    cacheScrittura: 3.75,
    cacheLettura: 0.3,
  },
  {
    modello: 'claude-haiku-4-5',
    daQuando: '2026-01-01',
    ingresso: 1,
    uscita: 5,
    cacheScrittura: 1.25,
    cacheLettura: 0.1,
  },
];

/**
 * Il nome del modello, ridotto alla forma con cui sta a listino.
 *
 * Alcune risposte riportano l'identificatore con un suffisso di data
 * (`claude-opus-5-20260401`) e alcune configurazioni aggiungono la versione del
 * prompt dopo una barra (`claude-opus-5/2026-09-12.1`). Sono lo stesso modello
 * e devono pagare lo stesso prezzo: senza questa riduzione finirebbero fra i
 * modelli «non a listino», e il totale della pagina sarebbe più basso del vero
 * senza che nessuno se ne accorga.
 */
export function normalizzaModello(modello: string): string {
  return (modello.split('/')[0] ?? modello).replace(/-\d{8}$/, '').trim();
}

/**
 * Il prezzo in vigore per quel modello a quella data, o `null` se non è a
 * listino.
 *
 * `null` non è un errore da nascondere: è l'informazione che una riga del
 * registro non si può valutare. La pagina la conta fra le chiamate e la tiene
 * fuori dal totale in dollari, dicendolo.
 */
export function prezzoDi(modello: string, quando: string): Prezzo | null {
  const nome = normalizzaModello(modello);
  const giorno = quando.slice(0, 10);
  const candidati = LISTINO.filter((p) => p.modello === nome && p.daQuando <= giorno);
  if (candidati.length === 0) return null;
  return candidati.reduce((piuRecente, p) => (p.daQuando > piuRecente.daQuando ? p : piuRecente));
}

export interface TokenChiamata {
  ingresso: number;
  uscita: number;
  cacheScrittura: number;
  cacheLettura: number;
}

/**
 * Il costo stimato di una chiamata, in dollari.
 *
 * Restituisce anche la data del listino applicato: è quella che rende il conto
 * rifattibile a mano da chi non si fida, che è l'unico modo in cui una cifra su
 * questo sito ha diritto di esistere.
 */
export function costoChiamata(
  modello: string,
  quando: string,
  token: TokenChiamata,
): { costo: number | null; listino: string | null } {
  const prezzo = prezzoDi(modello, quando);
  if (!prezzo) return { costo: null, listino: null };
  const costo =
    (token.ingresso * prezzo.ingresso +
      token.uscita * prezzo.uscita +
      token.cacheScrittura * prezzo.cacheScrittura +
      token.cacheLettura * prezzo.cacheLettura) /
    1_000_000;
  return { costo, listino: prezzo.daQuando };
}
