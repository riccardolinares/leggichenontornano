import Link from 'next/link';
import { REPO_URL, SITE_URL, dataset } from '@/lib/dataset';
import { data, numero } from '@/lib/testo';
import { Tabella } from '@/components/tabella';
import { ContatoreNazionale } from '@/components/contatore';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Per la stampa',
  description: 'Dataset scaricabile, frase citabile, contatti e cosa possiamo e non possiamo dire.',
};

export default function Stampa() {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const pubblicate = reader.publishedAnomalies();
  const inCoda = reader.data.anomalies.filter((a) => !a.published).length;
  const contatore = reader.counter();

  return (
    <div className="contenitore stretto">
      <h1>Per la stampa</h1>
      <p className="apertura">
        Tutto quello che serve per scrivere di questo progetto senza doverci chiedere niente. Se poi
        volete chiedercelo comunque, i contatti sono in fondo.
      </p>

      <section className="sezione" aria-labelledby="frase">
        <h2 id="frase" className="sezione__titolo">
          Una frase citabile
        </h2>
        <blockquote
          style={{
            borderLeft: '4px solid var(--verderame)',
            margin: 0,
            padding: '1rem 1.4rem',
            background: 'var(--carta-alta)',
            fontFamily: 'var(--serif)',
            fontSize: '1.15rem',
            lineHeight: 1.5,
          }}
        >
          «Non cerchiamo leggi ingiuste: cerchiamo leggi che non tornano. Una norma modificata dopo
          essere stata abrogata, un rinvio che non trova destinazione, due scadenze diverse per lo
          stesso adempimento. Sono errori verificabili, e li pubblichiamo solo quando la regola che
          li trova ha superato l’85% di precisione su revisione umana.»
        </blockquote>
      </section>

      {contatore ? (
        <section className="sezione" aria-labelledby="contatore">
          <h2 id="contatore" className="sezione__titolo">
            Il numero da citare, con quello che va citato insieme
          </h2>
          <ContatoreNazionale contatore={contatore} />
        </section>
      ) : null}

      <section className="sezione" aria-labelledby="numeri">
        <h2 id="numeri" className="sezione__titolo">
          I numeri, con i loro limiti
        </h2>
        {manifest ? (
          <Tabella didascalia={`Stato al ${data(manifest.generatedAt.slice(0, 10))}.`}>
            <tbody>
              <tr>
                <th scope="row">Atti nel corpus</th>
                <td>{numero(manifest.counts.acts)}</td>
              </tr>
              <tr>
                <th scope="row">Relazioni fra norme ricostruite</th>
                <td>{numero(manifest.counts.relations)}</td>
              </tr>
              <tr>
                <th scope="row">Segnalazioni pubblicate</th>
                <td>{numero(pubblicate.length)}</td>
              </tr>
              <tr>
                <th scope="row">Segnalazioni in coda interna</th>
                <td>{numero(inCoda)}</td>
              </tr>
            </tbody>
          </Tabella>
        ) : null}

        <div className="niente-segnale" style={{ marginTop: '1.2rem' }}>
          <h3 style={{ marginTop: 0 }}>Tre cose da non scrivere</h3>
          <ol>
            <li>
              <strong>«Il sito dice che questa legge è incostituzionale».</strong> Non lo diciamo
              mai. Non possiamo e non vogliamo.
            </li>
            <li>
              <strong>«Un’intelligenza artificiale ha trovato le contraddizioni».</strong> I
              controlli pubblicati sono attraversamenti di un grafo e confronti fra date. Dove un
              modello viene usato, estrae campi da un comma alla volta e non vede mai due norme
              insieme.
            </li>
            <li>
              <strong>«Ci sono N contraddizioni nella legislazione italiana».</strong> Ci sono N
              segnalazioni prodotte dai controlli attivi sulla porzione di corpus che abbiamo. È un
              numero che cresce quando ingeriamo più dati, non una misura dell’ordinamento.
            </li>
          </ol>
        </div>
      </section>

      <section className="sezione" aria-labelledby="materiali">
        <h2 id="materiali" className="sezione__titolo">
          Materiali
        </h2>
        <ul>
          <li>
            <a href={`${REPO_URL}/releases`}>Dataset completo in JSONL</a> — una riga per record,
            licenza CC BY 4.0.
          </li>
          <li>
            <Link href="/dati">Precisione misurata di ogni controllo</Link>, compresi quelli che non
            pubblichiamo e il perché.
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/METODO.md`}>Il metodo</a> — come nasce una segnalazione
            e a quali condizioni esce.
          </li>
          <li>
            <a href={`${REPO_URL}/tree/main/docs/adr`}>Le decisioni di progetto</a> — perché non c’è
            un grafo interattivo, perché non c’è un voto, perché la soglia è all’85%.
          </li>
          <li>
            Ogni segnalazione ha un’immagine di anteprima pronta per i social:{' '}
            <code>{SITE_URL}/anomalia/&#123;id&#125;/opengraph-image</code>
          </li>
        </ul>
      </section>

      <section className="sezione" aria-labelledby="grafici">
        <h2 id="grafici" className="sezione__titolo">
          Grafici incorporabili
        </h2>
        <p>
          Le pagine delle singole segnalazioni contengono la barra delle vigenze e il diagramma
          delle relazioni come SVG statici, senza JavaScript: si possono incorporare in un articolo
          con un <code>&lt;iframe&gt;</code> o salvare come immagine dalla pagina. Il layout è
          precalcolato e deterministico, quindi la stessa pagina produce sempre lo stesso disegno.
        </p>
      </section>

      <section className="sezione" aria-labelledby="contatti">
        <h2 id="contatti" className="sezione__titolo">
          Contatti
        </h2>
        <p>
          Il modo più rapido è aprire una issue sul repository: è pubblica e la vede chiunque lavori
          al progetto.
        </p>
        <p className="azioni">
          <a className="bottone bottone--primario" href={`${REPO_URL}/issues/new`}>
            Apri una issue
          </a>
          <a className="bottone" href={REPO_URL}>
            Codice sorgente
          </a>
        </p>
      </section>
    </div>
  );
}
