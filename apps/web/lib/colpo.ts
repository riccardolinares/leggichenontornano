import type { SnapshotAnomaly } from '@leggichenontornano/corpus';

/**
 * Il numero che regge da solo, per una singola segnalazione.
 *
 * Serve all'anteprima social: un'anteprima che ripete il titolo non dice niente
 * che il link non dica già, mentre «dieci anni» si legge in un secondo e fa
 * capire di che ordine di problema si tratta.
 *
 * Due vincoli su come si ricava.
 *
 * **Dai campi, non dal titolo.** Il titolo è prosa: una regex che ne estrae un
 * numero funziona finché qualcuno non riscrive la frase, e poi produce
 * un'immagine muta o — peggio — una cifra sbagliata. Qui si parte da
 * `windowFrom` e `windowTo`, che sono date nel dataset.
 *
 * **Da una data del dataset, non da oggi.** «Quanti anni sono passati» dipende
 * da quando lo si chiede: usando l'orologio della build, la stessa
 * segnalazione produrrebbe immagini diverse a seconda del giorno in cui il
 * sito viene ricostruito, e nessuno potrebbe riprodurle. Il riferimento è
 * `knownAt` del manifest: è la data a cui il dataset dichiara di conoscere il
 * mondo, sta nel dataset, e chi lo scarica ottiene le stesse cifre.
 */

export interface Colpo {
  /** La cifra, già formattata. */
  cifra: string;
  /** L'unità: «anni», «giorni». */
  unita: string;
  /** La frase che dice di cosa è la cifra. Non contiene la cifra. */
  frase: string;
}

const GIORNI_ANNO = 365.25;

/** Quello che ogni controllo misura, quando la finestra è ancora aperta. */
const FRASE_APERTA: Record<string, string> = {
  'rinvio-ad-atto-abrogato':
    'che una norma ancora in vigore rinvia a un testo cancellato dall’ordinamento',
  'modifica-ad-atto-abrogato': 'che una norma è stata modificata dopo essere stata abrogata',
  'rinvio-ad-articolo-inesistente': 'che questo rinvio punta a un articolo che non esiste',
  'attuazione-mancante': 'di ritardo sul termine fissato dalla legge per il decreto attuativo',
  'fonte-secondaria-su-primaria': 'che un atto di rango inferiore incide su uno di rango superiore',
};

/** E quando invece la finestra si è chiusa: non «da», ma «per». */
const FRASE_CHIUSA: Record<string, string> = {
  'termini-divergenti':
    'in cui due norme in vigore hanno imposto due termini diversi per lo stesso adempimento',
};

const FRASE_GENERICA_APERTA = 'che questa incongruenza è aperta';
const FRASE_GENERICA_CHIUSA = 'in cui questa incongruenza è rimasta aperta';

function giorniFra(da: string, a: string): number {
  const inizio = Date.parse(`${da}T00:00:00Z`);
  const fine = Date.parse(`${a}T00:00:00Z`);
  if (Number.isNaN(inizio) || Number.isNaN(fine)) return Number.NaN;
  return Math.floor((fine - inizio) / 86_400_000);
}

/**
 * Il colpo di una segnalazione, oppure `null` quando non ce n'è uno onesto.
 *
 * `null` non è un guasto: è il caso in cui la segnalazione non ha una finestra
 * temporale, o ne ha una troppo breve perché un numero aggiunga qualcosa. Chi
 * chiama passa all'anteprima generica, che è sempre corretta.
 */
export function colpoDiSegnalazione(anomalia: SnapshotAnomaly, conosciutoAl: string): Colpo | null {
  const da = anomalia.windowFrom;
  if (!da) return null;

  const chiusa = anomalia.windowTo !== null;
  const a = anomalia.windowTo ?? conosciutoAl.slice(0, 10);
  const giorni = giorniFra(da, a);
  if (!Number.isFinite(giorni) || giorni <= 0) return null;

  const anni = Math.floor(giorni / GIORNI_ANNO);
  if (anni >= 1) {
    const frase = chiusa
      ? (FRASE_CHIUSA[anomalia.checkId] ?? FRASE_GENERICA_CHIUSA)
      : (FRASE_APERTA[anomalia.checkId] ?? FRASE_GENERICA_APERTA);
    return { cifra: String(anni), unita: anni === 1 ? 'anno' : 'anni', frase };
  }

  // Sotto l'anno il numero resta interessante solo se è una finestra chiusa e
  // misurabile in giorni: «da 40 giorni» su un problema tuttora aperto dice
  // meno del titolo, e l'anteprima generica è la scelta migliore.
  if (!chiusa || giorni < 30) return null;
  const frase = FRASE_CHIUSA[anomalia.checkId] ?? FRASE_GENERICA_CHIUSA;
  return { cifra: new Intl.NumberFormat('it-IT').format(giorni), unita: 'giorni', frase };
}
