import type { ReactNode } from 'react';
import Link from 'next/link';
import { Tabella } from '@/components/tabella';

/**
 * I grafici del sito: barre orizzontali e istogrammi.
 *
 * Un grafico qui serve a una cosa sola — far vedere in un colpo d'occhio
 * un'informazione che in una tabella si trova solo contando. Tutto il resto di
 * questo file discende da tre vincoli, e nessuno dei tre è estetico.
 *
 * **Niente librerie.** Caricare un motore di grafici da una CDN significa
 * mettere il codice di qualcun altro su una pagina che dice quali leggi una
 * persona sta leggendo (DESIGN.md §5). Le barre qui sono `<rect>` calcolati
 * server-side: il disegno è già nell'HTML che arriva, si vede senza
 * JavaScript ed è identico a ogni caricamento.
 *
 * **Il testo non sta dentro l'SVG.** Un SVG che si adatta alla larghezza scala
 * anche il proprio testo: a 360 px le etichette di un grafico disegnato per uno
 * schermo largo diventano illeggibili, e ingrandirle deforma il disegno.
 * Dentro l'SVG restano solo le barre — con `preserveAspectRatio="none"`, così
 * la geometria è in percentuali e si stira quanto serve — mentre le etichette
 * sono testo HTML, che a qualunque larghezza resta della sua dimensione.
 *
 * **Un grafico da solo non è accessibile.** Sotto ogni grafico c'è la stessa
 * informazione in tabella, ed è quella il contenuto: il disegno la illustra.
 * Per questo il contenitore è un'unica immagine (`role="img"`) con un'etichetta
 * che dice **il dato**: «grafico a barre» non è un'informazione, e a chi non
 * vede il disegno non serve sapere che forma aveva.
 */

/**
 * Il tono di una barra, che è una scelta di significato e non di colore.
 *
 * La palette del progetto assegna a ogni colore una cosa sola (DESIGN.md §6):
 * l'ossido è la cifra che allarma, l'ocra l'area grigia e il limite dichiarato.
 * Il verderame non compare qui di proposito — è l'unico colore interattivo del
 * sito, e una barra non è un collegamento.
 */
export type Tono = 'ossido' | 'ocra' | 'neutro';

const COLORE: Readonly<Record<Tono, string>> = {
  ossido: 'var(--ossido)',
  ocra: 'var(--ocra)',
  neutro: 'var(--inchiostro-tenue)',
};

export interface Barra {
  /** Cosa misura questa barra: è l'etichetta accanto al disegno, e la chiave. */
  etichetta: string;
  /**
   * La stessa etichetta per esteso, quando quella accanto al disegno è un
   * numero nudo perché lì lo spazio è quello che è.
   *
   * «3: 47» letto ad alta voce non è un'informazione; «3 anni: 47 rinvii» lo
   * è. Questa versione va nell'etichetta accessibile e nella tabella, dove non
   * c'è nessun asse a dire di cosa siano quei numeri.
   */
  etichettaLunga?: string;
  /** Il valore che decide la lunghezza. */
  valore: number;
  /**
   * Lo stesso valore già formattato all'italiana.
   *
   * La formattazione resta a chi ha i dati: da qui non si sa se un numero sia
   * un conteggio, una percentuale o degli anni, e indovinarlo produrrebbe
   * «16.8%» in una pagina italiana.
   */
  valoreTesto: string;
  /** Dove porta la voce nella tabella, quando c'è una pagina che la spiega. */
  href?: string;
  tono?: Tono;
}

/** Una riga di riferimento verticale: la soglia sopra la quale un dato passa. */
export interface Soglia {
  valore: number;
  /** La frase che spiega cos'è la riga tratteggiata, sotto il disegno. */
  spiegazione: string;
}

export interface Colonne {
  etichetta: string;
  valore: string;
}

/**
 * L'alternativa testuale, che non è opzionale: è opzionale solo chi la scrive.
 *
 * O si passano la didascalia e le intestazioni, e la tabella la costruisce il
 * componente dai dati delle barre; oppure si passa una tabella già fatta,
 * perché quella di default direbbe meno del necessario — per esempio dove
 * servono una colonna in più o i collegamenti alle norme. Il tipo è una
 * scelta obbligata fra le due: un grafico senza equivalente testuale non si
 * può scrivere nemmeno per sbaglio.
 */
type AlternativaTestuale = { didascalia: string; colonne: Colonne } | { alternativa: ReactNode };

export function GraficoBarre(
  proprieta: {
    barre: Barra[];
    /** Cosa mostra il grafico, senza il punto finale: apre l'etichetta accessibile. */
    descrizione: string;
    soglia?: Soglia;
    /** Il fondo scala, quando non è il massimo dei dati: per le percentuali è 100. */
    massimo?: number;
  } & AlternativaTestuale,
) {
  const { barre, descrizione, soglia, massimo } = proprieta;
  if (barre.length === 0) return null;
  const scala = massimo ?? Math.max(...barre.map((b) => b.valore));
  if (!(scala > 0)) return null;

  return (
    <div className="grafico">
      <div className="grafico__disegno" role="img" aria-label={etichettaDati(descrizione, barre)}>
        {barre.map((b) => (
          <div className="grafico__riga" key={b.etichetta}>
            <p className="grafico__nome">
              <span>{b.etichetta}</span>
              <strong className="grafico__valore">{b.valoreTesto}</strong>
            </p>
            <svg
              className="grafico__traccia"
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <rect
                x="0"
                y="0"
                height="6"
                width={lunghezza(b.valore, scala)}
                fill={COLORE[b.tono ?? 'ossido']}
              />
              {soglia ? <RigaSoglia x={lunghezza(soglia.valore, scala)} /> : null}
            </svg>
          </div>
        ))}
      </div>

      {soglia ? <p className="grafico__legenda">{soglia.spiegazione}</p> : null}

      {/* Quando la tabella la costruisce il componente, ripete riga per riga
          quello che le barre hanno già scritto accanto a sé: nome e cifra. A
          chi vede il disegno non aggiunge niente, e raddoppia la lunghezza
          della pagina. Sta in un `details`, che resta nell'albero di
          accessibilità e si apre da tastiera — l'alternativa c'è, non è messa
          davanti a chi non le serve. Un'alternativa passata da fuori invece si
          mostra intera: se qualcuno l'ha scritta a mano è perché dice qualcosa
          in più, come le colonne in più della pagina Dati. */}
      {'alternativa' in proprieta ? (
        proprieta.alternativa
      ) : (
        <details className="grafico__numeri">
          <summary>I numeri del grafico</summary>
          <Tabella didascalia={proprieta.didascalia}>
            <thead>
              <tr>
                <th scope="col">{proprieta.colonne.etichetta}</th>
                <th scope="col">{proprieta.colonne.valore}</th>
              </tr>
            </thead>
            <tbody>
              {barre.map((b) => (
                <tr key={b.etichetta}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {b.href ? (
                      <Link href={b.href}>{b.etichettaLunga ?? b.etichetta}</Link>
                    ) : (
                      (b.etichettaLunga ?? b.etichetta)
                    )}
                  </th>
                  <td>{b.valoreTesto}</td>
                </tr>
              ))}
            </tbody>
          </Tabella>
        </details>
      )}
    </div>
  );
}

function RigaSoglia({ x }: { x: number }) {
  return (
    <>
      <line
        x1={x}
        x2={x}
        y1="0"
        y2="6"
        stroke="var(--carta-alta)"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x}
        x2={x}
        y1="0"
        y2="6"
        stroke="var(--inchiostro)"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** La lunghezza in percentuale, con un minimo visibile per i valori non nulli. */
function lunghezza(valore: number, scala: number): number {
  if (valore <= 0) return 0;
  return Math.max(1.2, Math.min(100, (valore / scala) * 100));
}

/**
 * L'etichetta accessibile: dice il dato, non la forma del disegno.
 *
 * Con poche voci si leggono tutte. Con molte, un elenco letto ad alta voce
 * diventa più lungo della tabella che sta sotto — e la tabella è già il posto
 * dove si leggono tutte: qui restano le due che danno la scala, la prima e
 * l'ultima.
 */
function etichettaDati(
  descrizione: string,
  voci: { etichetta: string; etichettaLunga?: string; valoreTesto: string }[],
): string {
  const estremi = voci.length <= 4 ? voci : [voci[0]!, voci[voci.length - 1]!];
  const elenco = estremi
    .map((v) => `${v.etichettaLunga ?? v.etichetta}: ${v.valoreTesto}`)
    .join('; ');
  const coda = voci.length <= 4 ? '' : '; le altre nella tabella qui sotto';
  return `${descrizione}. ${elenco.charAt(0).toUpperCase()}${elenco.slice(1)}${coda}.`;
}
