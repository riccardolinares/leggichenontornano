import type { ReactElement } from 'react';

/**
 * Le anteprime social, tutte dalla stessa forma.
 *
 * Un'anteprima è la prima — e spesso l'unica — cosa che qualcuno vede di una
 * segnalazione: arriva in una chat, in un feed, dentro una conversazione che
 * parla d'altro. Ha due secondi e un pollice.
 *
 * Da qui le regole di questo file:
 *
 *  1. **Una cosa sola per immagine.** Una cifra grande e una frase che dice di
 *     cosa è la cifra. Tutto il resto sta nella pagina.
 *  2. **Fondo scuro.** Le anteprime scorrono dentro interfacce chiare: uno
 *     sfondo inchiostro si stacca, uno sfondo carta si confonde con la chat.
 *  3. **Niente font scaricati.** Un `fetch` in fase di generazione è una
 *     dipendenza di rete dentro la build: il giorno che non risponde, la build
 *     fallisce o — peggio — produce immagini senza testo.
 */

/**
 * La palette dell'anteprima.
 *
 * Sono gli stessi colori del sito **riportati su fondo scuro**: `--ossido` e
 * `--verderame` nati per la carta chiara, su inchiostro, scendono sotto il
 * leggibile. Qui valgono 3,6:1 e 5,1:1 sul fondo, e il testo bianco 15:1.
 */
export const OG = {
  fondo: '#14201c',
  carta: '#f5f6f4',
  cartaTenue: 'rgba(245, 246, 244, 0.74)',
  cartaDebole: 'rgba(245, 246, 244, 0.52)',
  verderame: '#4f9b86',
  ossido: '#c2503c',
  ocra: '#c9a227',
} as const;

export const DIMENSIONE = { width: 1200, height: 630 };
export const TIPO_IMMAGINE = 'image/png';

/** L'accento corrisponde alla gravità dichiarata, come nel sito. */
export function accentoGravita(severity: string | undefined): string {
  if (severity === 'alta') return OG.ossido;
  if (severity === 'bassa') return OG.verderame;
  return OG.ocra;
}

/**
 * Taglia un testo a una lunghezza che ci sta davvero, sull'ultimo spazio.
 *
 * Tagliare a metà parola si vede, e si vede come un errore.
 */
export function accorcia(testo: string, massimo: number): string {
  if (testo.length <= massimo) return testo;
  const taglio = testo.slice(0, massimo);
  const spazio = taglio.lastIndexOf(' ');
  return `${(spazio > massimo * 0.6 ? taglio.slice(0, spazio) : taglio).replace(/[ ,;:.]+$/, '')}…`;
}

export interface Anteprima {
  /** L'etichetta in alto: che genere di pagina è. */
  occhiello: string;
  /** Il colore della barra e della cifra. */
  accento?: string;
  /** La cifra, quando la pagina ne ha una che regge da sola. */
  cifra?: string;
  /** L'unità della cifra: «anni», «atti», «giorni». */
  unita?: string;
  /** La frase principale. Con la cifra la spiega, senza la cifra è il titolo. */
  titolo: string;
  /** La riga secondaria: il nome dell'atto, la fonte, la data. */
  nota?: string;
}

/**
 * La cornice condivisa da ogni anteprima.
 *
 * Tutti i nodi con più di un figlio dichiarano `display: flex`: il motore che
 * disegna queste immagini non ha un layout a blocchi, e un nodo senza `flex`
 * non è un errore — è un pezzo di immagine che sparisce in silenzio.
 */
export function cornice({
  occhiello,
  accento,
  cifra,
  unita,
  titolo,
  nota,
}: Anteprima): ReactElement {
  const colore = accento ?? OG.verderame;
  const corpoTitolo = cifra ? (titolo.length > 90 ? 38 : 44) : titolo.length > 120 ? 46 : 58;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: OG.fondo,
        color: OG.carta,
        padding: '64px 76px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', width: 12, height: 48, background: colore }} />
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            letterSpacing: 4,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: OG.cartaTenue,
          }}
        >
          {accorcia(occhiello, 58)}
        </div>
      </div>

      {/* Le distanze qui sono margini espliciti e non `gap`: su una riga
          allineata alla linea di base il motore che disegna queste immagini
          ignora il `gap`, e il numero finisce attaccato alla sua unità —
          «103segnalazioni». Si vede solo guardando il PNG. */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cifra ? (
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div
              style={{
                display: 'flex',
                fontSize: cifra.length > 6 ? 130 : 168,
                lineHeight: 1,
                fontWeight: 700,
                color: colore,
              }}
            >
              {cifra}
            </div>
            {unita ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: 52,
                  fontWeight: 600,
                  color: OG.carta,
                  marginLeft: 22,
                }}
              >
                {unita}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            fontSize: corpoTitolo,
            lineHeight: 1.2,
            fontWeight: 600,
            maxWidth: 1020,
            marginTop: cifra ? 18 : 0,
          }}
        >
          {accorcia(titolo, cifra ? 150 : 190)}
        </div>

        {nota ? (
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              color: OG.cartaTenue,
              maxWidth: 1020,
              marginTop: 16,
            }}
          >
            {accorcia(nota, 110)}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 22,
          color: OG.cartaDebole,
        }}
      >
        <div style={{ display: 'flex', fontWeight: 600, color: OG.cartaTenue }}>
          leggichenontornano.it
        </div>
        <div style={{ display: 'flex' }}>elaborazione su dati Normattiva · CC BY 4.0</div>
      </div>
    </div>
  );
}
