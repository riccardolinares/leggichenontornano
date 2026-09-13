/**
 * Il testo del messaggio quotidiano.
 *
 * Vale la stessa regola del sito: **niente prosa generata**. Il messaggio è un
 * template riempito con i campi della segnalazione. Se un giorno il bot dicesse
 * qualcosa che non è nel dataset, quella frase sarebbe indifendibile — e
 * arriverebbe a più persone della pagina da cui viene.
 *
 * I limiti di lunghezza sono quelli reali delle piattaforme: 500 caratteri su
 * Mastodon, 280 su X, nessun limite pratico su Telegram. Il messaggio si
 * accorcia togliendo dalla fine, mai riscrivendo.
 */
import type { SnapshotAnomaly } from '@leggichenontornano/corpus';

export type Piattaforma = 'mastodon' | 'telegram' | 'x';

const LIMITI: Readonly<Record<Piattaforma, number>> = {
  mastodon: 500,
  x: 280,
  telegram: 4000,
};

export interface Messaggio {
  piattaforma: Piattaforma;
  testo: string;
  url: string;
  /** Testo alternativo dell'immagine di anteprima, per chi non la vede. */
  testoAlternativo: string;
}

export function componiMessaggio(
  anomalia: SnapshotAnomaly,
  piattaforma: Piattaforma,
  siteUrl: string,
): Messaggio {
  const url = `${siteUrl.replace(/\/+$/, '')}/anomalia/${encodeURIComponent(anomalia.id)}`;
  const limite = LIMITI[piattaforma];

  // Il corpo è il titolo, che è già scritto come frase leggibile ad alta voce.
  // L'URL non si accorcia mai: è la parte che rende la segnalazione verificabile.
  const coda = `\n\n${url}`;
  const spazio = limite - coda.length - 4;

  let corpo = anomalia.title;
  if (corpo.length > spazio) {
    corpo = `${corpo.slice(0, Math.max(0, spazio - 1)).trimEnd()}…`;
  } else if (corpo.length + 2 + anomalia.plainLanguage.length <= spazio) {
    // C'è posto anche per la spiegazione in lingua comune: su Telegram e
    // Mastodon di solito sì, su X quasi mai.
    corpo = `${corpo}\n\n${anomalia.plainLanguage}`;
    if (corpo.length > spazio) corpo = `${corpo.slice(0, spazio - 1).trimEnd()}…`;
  }

  return {
    piattaforma,
    url,
    testo: `${corpo}${coda}`,
    testoAlternativo: `Anteprima della segnalazione: ${anomalia.title}`,
  };
}

/**
 * Il messaggio per il contatore nazionale, pubblicato periodicamente.
 *
 * Il numero è deterministico e crescente, e ha un referente concreto: giorni di
 * ritardo accumulati dai provvedimenti attuativi previsti e non adottati. La
 * riga sul limite non è una postilla da togliere quando serve spazio: senza,
 * il numero diventa una cosa che non abbiamo misurato.
 */
export function componiContatore(
  contatore: { totalDaysLate: number; mandates: number; acts: number; caveat: string },
  siteUrl: string,
): string {
  return [
    `${new Intl.NumberFormat('it-IT').format(contatore.totalDaysLate)} giorni trascorsi dalla scadenza`,
    `dei termini fissati per ${contatore.mandates} provvedimenti attuativi previsti da ${contatore.acts} atti.`,
    '',
    'Contiamo solo gli atti che abbiamo ingerito e i soli mandati con un termine scritto nel testo: da questo lato è una sottostima.',
    'Dall’altro, misura termini scaduti e non attuazioni mancate: che il provvedimento sia arrivato dopo non lo verifichiamo ancora.',
    '',
    `${siteUrl.replace(/\/+$/, '')}/dati`,
  ].join(' ');
}
