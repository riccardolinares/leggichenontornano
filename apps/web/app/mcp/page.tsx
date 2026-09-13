import Link from 'next/link';
import { REPO_URL, SITE_URL, dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import { numero } from '@/lib/testo';

/*
 * La pagina che spiega il server MCP a chi non sa cosa sia un server MCP.
 *
 * Il server esiste da tempo e la sua documentazione sta nel README del
 * pacchetto: cioè in un posto che trova chi già sa di doverlo cercare. Questa
 * pagina serve all'altro novanta per cento — il giornalista che usa Claude
 * tutti i giorni e non ha mai aperto una repository.
 *
 * Per questo comincia da cosa ci si fa, non da cos'è. «Puoi chiedere al tuo
 * assistente cosa dice una legge, e risponde leggendola davvero» è una frase
 * che si capisce; «server MCP su trasporto stdio» non lo è.
 *
 * L'indirizzo però è `/mcp`, e non più `/assistente`: la sigla era un termine
 * da iniziati quando la pagina è nata, oggi è la parola con cui la si cerca, e
 * un indirizzo che nessuno digita non serve a niente. Il vecchio indirizzo
 * resta vivo con un reindirizzamento permanente (ADR 0008: un URL pubblicato
 * non si rompe). Che la sigla sia diffusa non vuol dire che sia nota: la prima
 * volta che compare nel testo, qui sotto, va sciolta.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'MCP: il progetto dentro il tuo assistente',
  descrizione:
    'Il server MCP del progetto collega Claude, Codex o un altro assistente al corpus normativo e alle segnalazioni: risponde leggendo i testi, non a memoria. Tre righe di configurazione, nessun account.',
  percorso: '/mcp',
});

const CONFIG_JSON = `{
  "mcpServers": {
    "leggichenontornano": {
      "command": "npx",
      "args": ["-y", "@leggichenontornano/mcp"]
    }
  }
}`;

const CONFIG_CODEX = `[mcp_servers.leggichenontornano]
command = "npx"
args = ["-y", "@leggichenontornano/mcp"]`;

const DOMANDE = [
  'Cosa dice l’articolo 5 del codice dei contratti pubblici del 2006, e com’è cambiato nel tempo?',
  'Quali norme ancora in vigore rinviano a un atto abrogato?',
  'Prendi questa segnalazione e prova a demolirla: dove non regge?',
  'Sto per scrivere che una certa norma è ancora in vigore. È vero, a che data?',
  'Quali pronunce della Corte costituzionale hanno colpito questo decreto?',
];

export default function PaginaMcp() {
  const reader = dataset();
  const manifest = reader.data.manifest;

  return (
    <div className="contenitore stretto">
      <h1>MCP: il progetto dentro il tuo assistente</h1>
      <p className="apertura">
        Puoi collegare Claude, Codex o un altro assistente a questo progetto, con un server{' '}
        <strong>MCP</strong> — <em>Model Context Protocol</em>, la convenzione con cui un assistente
        si collega a una fonte di dati e la interroga mentre risponde, invece di andare a memoria.
        Da quel momento, quando gli chiedi cosa dice una legge, la legge davvero: il testo vigente a
        una data, come è cambiato nel tempo, e le segnalazioni che lo riguardano.
      </p>

      <p className="riga-corpus">
        Non serve un account, non serve una chiave, non serve clonare niente. Al primo avvio scarica
        il dataset pubblico — {manifest ? `${numero(manifest.counts.acts)} atti` : 'il corpus'} — e
        lo tiene da parte.
      </p>

      <section className="sezione" aria-labelledby="perche">
        <h2 id="perche" className="sezione__titolo">
          Perché non basta chiederlo e basta
        </h2>
        <p>
          Un assistente che risponde a memoria su una legge sbaglia in un modo particolarmente
          insidioso: risponde bene. Cita un articolo che esiste, con parole plausibili, e sbaglia la
          versione — perché la norma è cambiata quattro volte e lui ha in testa una media di tutte.
          Su una legge, la data di vigenza <em>è</em> il contenuto.
        </p>
        <p>
          Collegato a questo server, invece, ogni risposta parte da un testo che ha letto adesso,
          con il suo URN e la sua data. E quando non c’è, dice che non c’è: il corpus è parziale per
          costruzione, e il server lo dichiara a ogni avvio.
        </p>
      </section>

      <section className="sezione" aria-labelledby="come">
        <h2 id="come" className="sezione__titolo">
          Come si collega
        </h2>

        <h3>Claude Desktop</h3>
        <p>
          Apri il file di configurazione — su macOS{' '}
          <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>, su Windows{' '}
          <code>%APPDATA%\Claude\claude_desktop_config.json</code> — e incolla questo. Poi riavvia.
        </p>
        <pre
          className="regola"
          tabIndex={0}
          role="region"
          aria-label="Configurazione per Claude Desktop"
        >
          <code>{CONFIG_JSON}</code>
        </pre>

        <h3>Claude Code</h3>
        <p>Un comando, e basta.</p>
        <pre className="regola" tabIndex={0} role="region" aria-label="Comando per Claude Code">
          <code>claude mcp add leggichenontornano -- npx -y @leggichenontornano/mcp</code>
        </pre>

        <h3>Codex</h3>
        <p>
          In <code>~/.codex/config.toml</code>.
        </p>
        <pre className="regola" tabIndex={0} role="region" aria-label="Configurazione per Codex">
          <code>{CONFIG_CODEX}</code>
        </pre>

        <h3>Qualunque altro client</h3>
        <p>
          Il trasporto è <strong>stdio</strong> e il comando è{' '}
          <code>npx -y @leggichenontornano/mcp</code>. Niente porte da aprire, niente processi da
          tenere vivi, niente autenticazione.
        </p>
      </section>

      <section className="sezione" aria-labelledby="domande">
        <h2 id="domande" className="sezione__titolo">
          Cosa puoi chiedere
        </h2>
        <p>
          In parole tue. Non serve conoscere gli URN, e non serve sapere quali strumenti esistono.
        </p>
        <ul className="elenco-domande">
          {DOMANDE.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section className="sezione" aria-labelledby="regole">
        <h2 id="regole" className="sezione__titolo">
          Le tre regole che il server impone al tuo assistente
        </h2>
        <p>
          Non sono suggerimenti: arrivano insieme agli strumenti, e servono a impedire l’errore più
          probabile, cioè che una segnalazione venga riferita come un verdetto.
        </p>
        <ol className="elenco-domande">
          <li>
            <strong>Citare sempre l’URN e la data di vigenza.</strong> La stessa norma dice cose
            diverse a date diverse: «l’art. 3 della legge X» senza una data è un riferimento
            ambiguo.
          </li>
          <li>
            <strong>Riportare il testo originale prima della sintesi.</strong> Se una segnalazione è
            sbagliata, l’errore si vede nel testo, non nel riassunto.
          </li>
          <li>
            <strong>Non presentare una segnalazione come un verdetto.</strong> Sono indizi prodotti
            da una query, con una precisione misurata che il server dichiara.
          </li>
        </ol>
      </section>

      <p className="azioni">
        <a className="bottone bottone--primario" href={`${REPO_URL}/tree/main/packages/mcp`}>
          Documentazione completa
        </a>
        <Link className="bottone" href="/dati">
          Cosa copre il dataset
        </Link>
        <a className="bottone" href={`${SITE_URL}/come-funziona`}>
          Come funziona il progetto
        </a>
      </p>
    </div>
  );
}
