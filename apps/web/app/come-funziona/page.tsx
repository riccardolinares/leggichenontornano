import Link from 'next/link';
import { CHECK_DEFINITIONS, THRESHOLD } from '@antinomia/engine';
import { REPO_URL } from '@/lib/dataset';
import { Tabella } from '@/components/tabella';
import { metadatiPagina } from '@/lib/seo';

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Come funziona',
  descrizione:
    'Cosa questo progetto non fa, come nasce una segnalazione, e a quali condizioni viene pubblicata.',
  percorso: '/come-funziona',
});

export default function ComeFunziona() {
  return (
    <div className="contenitore stretto">
      <h1>Come funziona</h1>

      {/* Si dice per prima cosa cosa il progetto NON fa. È la parte che
          qualifica tutto il resto, e metterla in fondo significherebbe non
          dirla. */}
      <section aria-labelledby="non-fa">
        <h2 id="non-fa">Cosa questo sito non fa</h2>
        <ul>
          <li>
            <strong>Non dà consulenza legale.</strong> Nessuna segnalazione è un parere, e nessuna
            può essere usata al posto di uno.
          </li>
          <li>
            <strong>Non dichiara illegittima o incostituzionale alcuna norma.</strong> L’unico
            soggetto che può farlo è la Corte costituzionale. Quando una pronuncia esiste la
            citiamo; non ne produciamo di nuove.
          </li>
          <li>
            <strong>
              Non usa un modello linguistico per decidere se due norme si contraddicono.
            </strong>{' '}
            Il modello, dove viene usato, estrae campi da un comma alla volta e non vede mai due
            norme insieme. La contraddizione è una query su quei campi.
          </li>
          <li>
            <strong>Non assegna punteggi di qualità legislativa</strong>, non produce classifiche
            politiche, non attribuisce responsabilità a partiti, governi o singoli.
          </li>
          <li>
            <strong>Non raccoglie voti.</strong> Trasformerebbe un osservatore in un attore
            politico, e renderebbe ogni segnalazione contestabile per motivi estranei ai dati.
          </li>
          <li>
            <strong>Non promette che il silenzio sia una buona notizia.</strong> Che una norma non
            compaia qui significa che i controlli attivi, sulla porzione di corpus che abbiamo, non
            hanno trovato nulla. Non significa che la norma sia coerente.
          </li>
        </ul>
      </section>

      <section className="sezione" aria-labelledby="metodo">
        <h2 id="metodo">Il modello estrae, il codice giudica</h2>
        <p>
          Il modo ovvio di cercare contraddizioni fra norme è dare due testi a un modello
          linguistico e chiedergli se si contraddicono. È anche il modo che rende un progetto come
          questo indifendibile: la risposta è plausibile, non riproducibile, non verificabile, e la
          sua accuratezza non è misurabile.
        </p>
        <p>Qui funziona al contrario. Per ogni comma si estrae una proposizione normalizzata:</p>
        <ul>
          <li>soggetto e fattispecie — chi, in quali circostanze;</li>
          <li>modalità deontica — obbligo, divieto, permesso, potere, onere;</li>
          <li>oggetto della condotta;</li>
          <li>termine, se presente;</li>
          <li>conseguenza o sanzione;</li>
          <li>condizioni ed eccezioni;</li>
          <li>ambito di applicazione;</li>
          <li>URN, comma e finestra di vigenza.</li>
        </ul>
        <p>
          A questo punto la contraddizione non è un giudizio, è un <code>JOIN</code>: stessa
          modalità deontica, stesso soggetto, fattispecie sovrapposta, vigenze che si intersecano,
          valore divergente. L’errore del modello resta confinato all’estrazione, dove si misura a
          campione; e ogni segnalazione mostra i due testi originali sopra ai campi estratti, così
          chi legge può dirci se abbiamo sbagliato l’estrazione o se il conflitto è reale. Sono due
          errori diversi.
        </p>
        <p>
          <strong>Il filtro temporale non è opzionale.</strong> Due norme mai vigenti
          contemporaneamente non sono in contraddizione. Il motore scarta ogni coppia la cui
          intersezione di vigenza è vuota prima di qualunque altro confronto.
        </p>
      </section>

      <section className="sezione" aria-labelledby="controlli">
        <h2 id="controlli">I controlli attivi</h2>
        <p>
          Ogni controllo ha una regola scritta, che compare in chiaro nella scheda di ogni
          segnalazione che produce. Non è documentazione: è la cosa che il codice esegue.
        </p>
        <Tabella didascalia="I controlli implementati, con il livello della tassonomia e la precisione attesa.">
          <thead>
            <tr>
              <th scope="col">Controllo</th>
              <th scope="col">Livello</th>
              <th scope="col">Cosa cerca</th>
              <th scope="col">Precisione attesa</th>
            </tr>
          </thead>
          <tbody>
            {CHECK_DEFINITIONS.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.label}</th>
                <td>{c.level}</td>
                <td>{c.description}</td>
                <td>{c.expectedPrecision}</td>
              </tr>
            ))}
          </tbody>
        </Tabella>
        <p style={{ marginTop: '1rem' }}>
          I controlli di livello 1 sono puramente deterministici: attraversano il grafo delle
          relazioni fra norme e confrontano date. Nessuna intelligenza artificiale è coinvolta. Il
          livello 2 applica regole sui metadati di fonte e competenza. Il livello 3 si attiva
          soltanto sui domini dotati di un vocabolario controllato.
        </p>
        <p>
          E non su tutta la legislazione di quei domini: ogni dominio dichiara{' '}
          <strong>l’elenco degli atti</strong> su cui il confronto lavora, perché le parole non
          bastano a delimitare una materia. «Concessione» sta nel codice dei contratti pubblici e
          nel codice della navigazione del 1942; «collaudo» negli appalti e nel collaudo dei
          veicoli. Finché abbiamo attivato il confronto su ogni norma che contenesse una di quelle
          parole, ha accostato materie che non c’entrano niente. L’elenco degli atti di ciascun
          dominio è pubblicato nella pagina <Link href="/dati">Dati</Link>: si può contare.
        </p>
      </section>

      <section className="sezione" aria-labelledby="soglia">
        <h2 id="soglia">La soglia di pubblicazione</h2>
        <div className="niente-segnale">
          <p style={{ marginBottom: 0 }}>
            Un tipo di controllo viene pubblicato soltanto quando la revisione umana su campione
            supera l’<strong>{Math.round(THRESHOLD.minPrecision * 100)}% di precisione</strong>, con
            almeno <strong>{THRESHOLD.minSample} revisioni</strong>. Sotto soglia, o sotto la
            dimensione minima di campione, le sue segnalazioni restano nella coda interna e non
            compaiono su questo sito.
          </p>
        </div>
        <p style={{ marginTop: '1.2rem' }}>
          La regola è codificata, non dichiarata: il gate è applicato nel punto di esportazione dei
          dati, non lasciato alla disciplina di chi pubblica. Una precisione del 100% su tre casi
          non è una precisione, ed è il motivo del campione minimo.{' '}
          <Link href="/dati">La pagina Dati</Link> mostra la precisione corrente di ogni controllo,
          compresi quelli che non pubblicano e il perché.
        </p>
      </section>

      <section className="sezione" aria-labelledby="dati">
        <h2 id="dati">Da dove vengono i dati</h2>
        <p>
          Il corpus proviene dagli open data di <a href="https://dati.normattiva.it">Normattiva</a>,
          in formato Akoma Ntoso, con licenza CC BY 4.0. Usiamo le API di export e le collezioni
          predefinite previste dal portale: non c’è nel nostro codice un percorso che faccia
          scraping del sito di consultazione.
        </p>
        <p>
          Il corpus di legittimità della Corte di cassazione non è disponibile in blocco: il livello
          giurisprudenziale è quindi trattato per citazione — linkiamo gli estremi, non ospitiamo il
          testo.
        </p>
        <p>
          Le fonti hanno errori, e alcuni li abbiamo trovati. In più di un caso un riferimento negli
          open data risulta ancorato a un atto diverso da quello che il testo nomina: se lo
          prendessimo per buono produrremmo una segnalazione che sembra un errore del legislatore ed
          è un errore di marcatura. Per questo gli archi in cui il testo e l’ancoraggio non
          concordano nascono a bassa confidenza e i controlli di livello 1 li ignorano.{' '}
          <a href={`${REPO_URL}/blob/main/docs/qualita-fonti.md`}>
            I casi trovati sono documentati
          </a>
          .
        </p>
      </section>

      <section className="sezione" aria-labelledby="contraddittorio">
        <h2 id="contraddittorio">Se pensi che una segnalazione sia sbagliata</h2>
        <p>
          Ogni scheda ha un pulsante <strong>«Non è un conflitto»</strong>. Apre una issue pubblica
          sul repository, senza registrazione. Le risposte alimentano il gold standard e cambiano la
          precisione misurata del controllo che ha prodotto la segnalazione: possono farlo scendere
          sotto soglia e toglierlo dal sito.
        </p>
        <p>
          Il pulsante non si chiama «segnala un falso positivo» di proposito. «Non è un conflitto» è
          una valutazione giuridica, che un professionista dà volentieri; l’altra è un bug report, e
          presuppone che qualcuno lavori gratis per noi.
        </p>
        <p>
          <a className="bottone" href={REPO_URL}>
            Il codice è pubblico: verificate anche noi
          </a>
        </p>
      </section>
    </div>
  );
}
