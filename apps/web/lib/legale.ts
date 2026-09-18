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
      'Quali dati il sito può ricevere — solo quelli che scrivi nel modulo — dove finiscono e come si chiede di cancellarli.',
    aggiornataIl: '2026-09-13',
  },
  {
    percorso: '/legal/termini',
    titolo: 'Termini di servizio',
    sommario:
      'Cosa puoi fare con questo sito e con i suoi dati, a quali condizioni, e cosa ti garantiamo.',
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
      'Quanto vale quello che leggi qui: il testo che fa fede, i limiti dei controlli automatici e come contestarli.',
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
 * Quello che l'informativa non dice ancora.
 *
 * La versione precedente teneva qui tre segnaposto fra parentesi quadre, con
 * un ragionamento giusto: un segnaposto che somiglia a un dato vero è peggio
 * di un campo vuoto, perché un'informativa che dichiara un titolare inventato
 * dice il falso a chi si fida. Accanto c'era la condizione: «da riempire prima
 * di pubblicare il sito».
 *
 * Il sito è stato pubblicato lo stesso, e per giorni l'informativa ha mostrato
 * le parentesi quadre del modello. Chi arrivava lì non leggeva «questo dato
 * manca»: leggeva una pagina che sembrava un modello mai finito, e da lì non
 * sapeva più cosa credere del resto.
 *
 * Adesso la lacuna è scritta a parole, come il progetto fa dappertutto con le
 * cose che non sa: il contatore dice di misurare termini scaduti e non
 * attuazioni mancate, la pagina dei dati elenca i controlli che restano sotto
 * soglia con il motivo. Una lacuna dichiarata è un'informazione; un segnaposto
 * è un lavoro non finito lasciato in vetrina.
 *
 * Resta una lacuna, e va colmata: finché queste righe sono così, l'informativa
 * non identifica il titolare come il Regolamento richiede. Il canale di
 * contatto però funziona davvero, ed è quello che serve a chi scrive.
 * `test/legale.test.ts` impedisce che le parentesi quadre tornino.
 */
export const TITOLARE = 'non ancora dichiarato su questa pagina';
export const INDIRIZZO_TITOLARE =
  'e per questo l’unico recapito che questa informativa può indicare è quello qui sotto';
export const BASE_TRASFERIMENTO =
  'la base specifica dichiarata nei contratti con Vercel e GitHub non è ancora riportata su questa pagina';
