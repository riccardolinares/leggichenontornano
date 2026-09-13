import Link from 'next/link';
import { EMAIL, REPO_URL, SITE_URL, SOSTIENI_URL, dataset } from '@/lib/dataset';
import { data, numero } from '@/lib/testo';
import { Tabella } from '@/components/tabella';
import { ContatoreNazionale } from '@/components/contatore';
import { metadatiPagina } from '@/lib/seo';

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Per la stampa',
  descrizione: 'Dataset scaricabile, frase citabile, contatti e cosa possiamo e non possiamo dire.',
  percorso: '/stampa',
});

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
        Qui ci sono i numeri, il metodo e i dati grezzi da cui vengono: potete verificare ogni
        affermazione senza passare da noi, ed è il motivo per cui potete citarla. E poi scriveteci
        comunque — una domanda che ci obbliga a spiegarci meglio è la cosa più utile che possiate
        farci.
      </p>
      <p className="azioni">
        <a className="bottone" href={REPO_URL}>
          Il progetto su GitHub
        </a>
        <a className="bottone" href={`${REPO_URL}/releases`}>
          Scarica il dataset
        </a>
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
          I numeri, e cosa misurano esattamente
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
          Il modo più rapido è aprire una issue su GitHub: è pubblica, la vede chiunque lavori al
          progetto, e resta come traccia di cosa vi abbiamo risposto. Non serve registrarsi per
          leggerla.
        </p>
        <p>
          Se la domanda riguarda una singola segnalazione, il pulsante{' '}
          <strong>«Non è un conflitto»</strong> sulla scheda apre una issue con i riferimenti già
          dentro. Se pensate che un numero di questa pagina sia sbagliato, ditecelo: le risposte
          cambiano la precisione misurata, e possono togliere un controllo dal sito.
        </p>
        <p>
          Se preferite scrivere in privato — una domanda che non volete lasciare pubblica, una
          richiesta di intervista, una correzione che riguarda un caso delicato — l’indirizzo è{' '}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
        <p className="azioni">
          <a className="bottone bottone--primario" href={`${REPO_URL}/issues/new`}>
            Apri una issue
          </a>
          <a className="bottone" href={`mailto:${EMAIL}`}>
            Scrivi una mail
          </a>
          <a className="bottone" href={REPO_URL}>
            Il progetto su GitHub
          </a>
        </p>
      </section>

      <section className="sezione" aria-labelledby="sostegno">
        <h2 id="sostegno" className="sezione__titolo">
          Sostenere il progetto
        </h2>
        <p>
          Il progetto non ha un modello di business e non ne vuole uno: nessuna pubblicità, nessun
          abbonamento, nessun dato di chi legge rivenduto a qualcuno. I costi sono quelli veri di
          una cosa che gira tutti i giorni — il dominio, l’hosting, le chiamate a un modello per le
          estrazioni.
        </p>
        <p className="azioni">
          <a className="bottone" href={SOSTIENI_URL}>
            Offri un caffè al progetto
          </a>
        </p>
      </section>
    </div>
  );
}
