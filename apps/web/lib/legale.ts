/**
 * Le pagine legali, dichiarate una volta sola.
 *
 * L'indice, la mappa del sito, la sitemap e l'intestazione di ogni pagina
 * leggono da qui. Un elenco ricopiato in quattro file diverge al primo
 * ritocco, e la pagina che resta indietro è sempre quella che nessuno ha
 * riletto — che in un testo legale è il difetto peggiore.
 *
 * Le date stanno qui e non nella prosa delle pagine per lo stesso motivo: si
 * cambiano dove si cambia il testo, e chi legge le trova sempre nello stesso
 * posto.
 */

export interface PaginaLegale {
  /** Percorso assoluto, con la barra iniziale. */
  percorso: string;
  titolo: string;
  /** Cosa ci si trova, in una riga: serve all'indice, alla mappa e ai metadati. */
  sommario: string;
  /**
   * Data dell'ultima revisione **del testo**, in ISO.
   *
   * Non è la data della build né quella dell'ultimo commit sul file: un
   * deploy che cambia un margine non è una revisione dell'informativa, e
   * scrivere che lo è farebbe sembrare riletto un testo che nessuno ha
   * riletto. Si aggiorna a mano quando si cambia quello che la pagina dice,
   * ed è l'unico dato di queste pagine che dipende da una persona.
   */
  aggiornataIl: string;
}

export const PAGINE_LEGALI: readonly PaginaLegale[] = [
  {
    percorso: '/legal/privacy',
    titolo: 'Informativa privacy',
    sommario:
      'Quali dati il sito può ricevere — solo quelli che scrivete nel modulo — dove finiscono e come si chiede di cancellarli.',
    aggiornataIl: '2026-09-13',
  },
  {
    percorso: '/legal/termini',
    titolo: 'Termini di servizio',
    sommario:
      'Cosa potete fare con questo sito e con i suoi dati, a quali condizioni, e cosa vi garantiamo.',
    aggiornataIl: '2026-09-13',
  },
  {
    percorso: '/legal/cookie',
    titolo: 'Cookie',
    sommario: 'Il sito non ne pone nessuno, e c’è un test che lo verifica a ogni build.',
    aggiornataIl: '2026-09-13',
  },
  {
    percorso: '/legal/disclaimer',
    titolo: 'Limitazione di responsabilità',
    sommario:
      'Quanto vale quello che leggete qui: il testo che fa fede, i limiti dei controlli automatici e come contestarli.',
    aggiornataIl: '2026-09-13',
  },
];

export function paginaLegale(percorso: string): PaginaLegale {
  const trovata = PAGINE_LEGALI.find((p) => p.percorso === percorso);
  if (!trovata) throw new Error(`Pagina legale non dichiarata: ${percorso}`);
  return trovata;
}

/** Tutti i percorsi legali, indice compreso: sitemap e mappa del sito. */
export const PERCORSI_LEGALI: readonly string[] = [
  '/legal',
  ...PAGINE_LEGALI.map((p) => p.percorso),
];

/*
 * I segnaposto.
 *
 * Stanno qui in chiaro, con le parentesi quadre, perché un segnaposto che
 * somiglia a un dato vero è peggio di un campo vuoto: un'informativa che
 * dichiara un titolare inventato non informa nessuno e dice il falso. Finché
 * sono così si vedono in pagina, e chi le legge capisce che quella riga non è
 * ancora stata compilata.
 *
 * Da riempire prima di pubblicare il sito.
 */
export const TITOLARE = '[Nome e cognome o ragione sociale del titolare del trattamento]';
export const INDIRIZZO_TITOLARE = '[Indirizzo del titolare]';
export const BASE_TRASFERIMENTO =
  '[Base del trasferimento fuori dall’Unione europea dichiarata nei contratti con Vercel e GitHub]';
