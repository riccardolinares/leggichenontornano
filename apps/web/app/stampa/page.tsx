import Link from 'next/link';
import { THRESHOLD } from '@leggichenontornano/engine';
import { EMAIL, REPO_URL, SITE_URL, SOSTIENI_URL, dataset } from '@/lib/dataset';
import { data, numero, numeroDecimale } from '@/lib/testo';
import { Tabella } from '@/components/tabella';
import { ContatoreNazionale } from '@/components/contatore';
import { metadatiPagina } from '@/lib/seo';

/*
 * La pagina per la stampa, scritta dal lato di quello che si può fare.
 *
 * Prima era un elenco di divieti: «tre cose da non scrivere». Delimitava il
 * perimetro giusto e lo diceva nel modo peggiore — un giornalista che arriva
 * qui ha venti minuti, e un cartello di divieti gli insegna solo che questo è
 * un posto dove si rischia di sbagliare. Il modo più rapido per non far
 * scrivere una cosa è darne una migliore già scritta.
 *
 * Da qui la forma di ogni voce: a cosa serve, la **frase pronta da copiare**,
 * e sotto il perché è quella. Il perimetro non si muove di un millimetro —
 * illegittimità solo dalla Corte, nessuna intelligenza artificiale che trova
 * contraddizioni, il contatore che misura termini scaduti — ma è detto come
 * formula da usare invece che come confine da non superare. È la stessa
 * riscrittura fatta su «Come funziona», dove i divieti in apertura sono
 * diventati «Su cosa puoi contare».
 *
 * Le cifre dentro le formule sono calcolate dal dataset, come ovunque nel
 * sito: una formula pronta con un numero scritto a mano invecchierebbe in una
 * settimana, e la copierebbe qualcuno.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Per la stampa',
  descrizione:
    'Dataset scaricabile, i numeri con le formule già pronte per citarli, i grafici incorporabili e i contatti.',
  percorso: '/stampa',
});

export default function Stampa() {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const pubblicate = reader.publishedAnomalies();
  const inCoda = reader.data.anomalies.filter((a) => !a.published).length;
  const contatore = reader.counter();
  const aggiornatoAl = manifest ? data(manifest.knownAt.slice(0, 10)) : null;

  return (
    <div className="contenitore stretto">
      <h1>Per la stampa</h1>
      <p className="apertura">
        Qui ci sono i numeri, il metodo, i dati grezzi da cui vengono e le frasi già pronte per
        citarli. Ogni affermazione la puoi verificare senza passare da noi, ed è il motivo per cui
        la puoi citare. E poi scrivici comunque — una domanda che ci obbliga a spiegarci meglio è la
        cosa più utile che tu possa farci.
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
      </section>

      <section className="sezione" aria-labelledby="formule">
        <h2 id="formule" className="sezione__titolo">
          Le formule pronte
        </h2>
        <p>
          Una frase già scritta per ciascuna delle cose che di questo sito si citano più spesso.
          Sono le formule che reggono alla prima verifica di chi va a controllare, e sono fatte per
          essere copiate così come sono — anche solo la parte fra virgolette.
        </p>

        <ul className="formule">
          <li className="formula">
            <p className="formula__uso">Per dire che cosa segnala questo sito</p>
            <p className="formula__pronta">
              «Il sito segnala che due testi di legge non tornano fra loro: un rinvio che non trova
              destinazione, una modifica a un atto già abrogato, due scadenze diverse per lo stesso
              adempimento.»
            </p>
            <p className="formula__perche">
              È la formula esatta perché quello che pubblichiamo è un confronto fra testi.
              Dichiarare illegittima una norma spetta alla Corte costituzionale: quando l’ha già
              fatto, la scheda lo riporta con le parole del dispositivo e il collegamento al testo
              integrale, e <Link href="/corte">quella</Link> è la fonte da citare per
              l’illegittimità.
            </p>
          </li>

          <li className="formula">
            <p className="formula__uso">Per dire da chi sono state trovate</p>
            <p className="formula__pronta">
              «Trovate da interrogazioni deterministiche su un grafo di relazioni datate fra norme:
              il confronto lo fa il codice, e la regola che ha prodotto ogni segnalazione è scritta
              in chiaro sulla scheda.»
            </p>
            <p className="formula__perche">
              Dove un modello linguistico è coinvolto, la formula è «il modello estrae, il confronto
              lo fa il codice»: estrae campi da un comma alla volta e non vede mai due norme
              insieme. Al livello 4, dove un modello confronta davvero, la scheda lo dichiara in un
              blocco a parte che si riconosce senza doverlo leggere.
            </p>
          </li>

          <li className="formula">
            <p className="formula__uso">Per citare il totale delle segnalazioni</p>
            <p className="formula__pronta">
              «{numero(pubblicate.length)} segnalazioni prodotte dai controlli attivi sulla porzione
              di corpus ingerita{aggiornatoAl ? `, aggiornata al ${aggiornatoAl}` : ''}.»
            </p>
            <p className="formula__perche">
              Il conteggio dice fin dove siamo arrivati a guardare, e cresce quando ingeriamo altri
              atti: citarlo con la data e con «porzione di corpus» lo rende un numero che resta vero
              anche fra sei mesi. <Link href="/dati">La pagina Dati</Link> tiene il conto di cosa
              c’è dentro il corpus e di cosa manca ancora.
            </p>
          </li>

          {contatore && contatore.mandates > 0 ? (
            <li className="formula">
              <p className="formula__uso">Per citare il contatore dei termini scaduti</p>
              <p className="formula__pronta">
                «{numero(contatore.mandates)} provvedimenti attuativi previsti da{' '}
                {numero(contatore.acts)} atti hanno un termine scaduto, in media da{' '}
                {numeroDecimale(contatore.totalDaysLate / contatore.mandates / 365.25)} anni.»
              </p>
              <p className="formula__perche">
                Il conteggio parte dalla scadenza scritta nella legge: se il decreto è poi arrivato
                in ritardo, quel ritardo lo conta lo stesso. Ogni giorno che conta corrisponde a una
                data che sta in un testo di legge, ed è il motivo per cui questa cifra si verifica
                riga per riga. Misura <em>termini scaduti</em>, che è un’affermazione più forte di
                quanto sembri e regge alla verifica.
              </p>
            </li>
          ) : null}

          <li className="formula">
            <p className="formula__uso">Per citare un articolo di legge</p>
            <p className="formula__pronta">
              «Art. &#123;numero&#125; del &#123;atto&#125;, nel testo in vigore al
              &#123;data&#125;.»
            </p>
            <p className="formula__perche">
              Lo stesso articolo dice cose diverse in momenti diversi, e la data è ciò che rende il
              riferimento verificabile. L’indirizzo <code>/norma/&#123;urn&#125;?v=AAAA-MM-GG</code>{' '}
              apre esattamente quella versione ed è citabile in nota:{' '}
              <Link href="/norme">l’elenco degli atti</Link> porta a tutti.
            </p>
          </li>

          <li className="formula">
            <p className="formula__uso">Per dire quanto vale una singola segnalazione</p>
            <p className="formula__pronta">
              «La regola che l’ha prodotta ha una precisione misurata, pubblicata sul sito insieme
              al numero di revisioni su cui è calcolata; sotto il{' '}
              {Math.round(THRESHOLD.minPrecision * 100)}% di precisione, o sotto{' '}
              {numero(THRESHOLD.minSample)} revisioni, un controllo resta in coda interna e non
              compare.»
            </p>
            <p className="formula__perche">
              Il cancello è codificato nel punto in cui i dati escono, non lasciato alla disciplina
              di chi pubblica, ed è la cosa che rende citabile una singola scheda.{' '}
              <Link href="/dati">La pagina Dati</Link> mostra la precisione corrente di ogni
              controllo, compresi i {numero(inCoda)} casi in coda e il perché ci stanno.
            </p>
          </li>
        </ul>
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
          progetto, e resta come traccia di cosa ti abbiamo risposto. Non serve registrarsi per
          leggerla.
        </p>
        <p>
          Se la domanda riguarda una singola segnalazione, il pulsante{' '}
          <strong>«Non è un conflitto»</strong> sulla scheda apre una issue con i riferimenti già
          dentro. Se pensi che un numero di questa pagina sia sbagliato, diccelo: le risposte
          cambiano la precisione misurata, e possono togliere un controllo dal sito.
        </p>
        <p>
          Se preferisci scrivere in privato — una domanda che non vuoi lasciare pubblica, una
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
