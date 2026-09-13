import type { Metadata } from 'next';
import { Archivo, Newsreader } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { MarchioGithub } from '@/components/marchio-github';
import { Navigazione } from '@/components/navigazione';
import { FornitoreTema, SelettoreTema } from '@/components/tema';
import { EMAIL, REPO_URL, SITE_URL, SOSTIENI_URL, dataset } from '@/lib/dataset';
import { NOME_SITO, datiStrutturatiSito } from '@/lib/seo';

/*
 * Tipografia: un serif per il testo normativo, un grottesco per l'interfaccia.
 * Il testo di legge deve leggersi come un documento, l'interfaccia come
 * segnaletica.
 */
const serif = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '500', '600'],
});

const grottesco = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-grottesco',
  weight: ['400', '500', '600', '700'],
});

const DESCRIZIONE =
  'Incongruenze, contraddizioni e aree grigie della legislazione italiana, con le prove e la regola che le ha trovate.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: NOME_SITO,
    template: `%s — ${NOME_SITO}`,
  },
  description: DESCRIZIONE,
  applicationName: NOME_SITO,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    siteName: NOME_SITO,
    url: SITE_URL,
    title: NOME_SITO,
    description: DESCRIZIONE,
  },
  twitter: { card: 'summary_large_image', title: NOME_SITO, description: DESCRIZIONE },
  // `max-image-preview: large` è quello che permette all'anteprima di comparire
  // a piena larghezza nei risultati di ricerca invece che come miniatura.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Un numero di legge in una pagina non è un numero di telefono: senza questo,
  // iOS trasforma «n. 207» in un collegamento da chiamare.
  formatDetection: { telephone: false, date: false, address: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const aggiornatoAl = dataset().data.manifest?.knownAt ?? null;

  return (
    /* `suppressHydrationWarning` sta qui perché `next-themes` scrive
       `data-theme` con uno script che gira **prima** di React: il markup del
       server e quello del client differiscono di proposito su questo nodo, e
       su questo soltanto. È il modo in cui si evita il lampo bianco a chi
       legge col tema scuro. */
    <html lang="it" className={`${serif.variable} ${grottesco.variable}`} suppressHydrationWarning>
      <body>
        {/* I dati strutturati dichiarano che qui c'è un dataset con una licenza
            e una fonte, non un commento giuridico. È l'unico modo per dirlo a
            un motore di ricerca in un vocabolario che capisce. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- JSON serializzato da noi, non da input
          dangerouslySetInnerHTML={{ __html: datiStrutturatiSito(REPO_URL, aggiornatoAl) }}
        />

        <FornitoreTema>
          {/* Primo elemento focalizzabile della pagina: chi naviga da tastiera
              non deve attraversare la navigazione a ogni cambio di pagina. */}
          <a className="salta" href="#contenuto">
            Vai al contenuto
          </a>

          <header className="testata">
            <div className="contenitore testata__riga">
              {/* Marchio e strumenti stanno insieme: su un telefono finiscono
                  sulla stessa riga invece di occuparne due, e sopra la piega
                  resta lo spazio per dire cosa abbiamo trovato. Su schermo
                  largo questo contenitore sparisce (`display: contents`) e i
                  tre blocchi tornano in fila. */}
              <div className="testata__marchio">
                <Link href="/" className="marchio">
                  Le leggi che non tornano
                  <span className="marchio__tecnico">le incongruenze della legge italiana</span>
                </Link>

                {/* Non sono voci di menù e non stanno nel menù: una è una
                    preferenza di lettura, l'altra porta fuori dal sito.
                    Mescolarle alle pagine costringerebbe chi cerca «Norme» a
                    scartarle ogni volta. */}
                <div className="testata__strumenti">
                  <SelettoreTema />
                  <a className="testata__codice" href={REPO_URL} rel="noopener">
                    <MarchioGithub />
                    <span className="solo-lettori-schermo">Il codice del progetto su GitHub</span>
                  </a>
                </div>
              </div>

              <Navigazione />
            </div>
          </header>

          <main id="contenuto">{children}</main>

          <footer className="piede">
            <div className="contenitore">
              <div className="piede__griglia">
                <div>
                  <h2>Cosa c’è nel sito</h2>
                  <ul>
                    <li>
                      <Link href="/segnalazioni">Le segnalazioni</Link>
                    </li>
                    <li>
                      <Link href="/blog">Approfondimenti</Link>
                    </li>
                    <li>
                      <Link href="/numeri">I numeri</Link>
                    </li>
                    <li>
                      <Link href="/norme">Le norme del corpus</Link>
                    </li>
                    <li>
                      <Link href="/corte">Pronunce della Consulta</Link>
                    </li>
                    <li>
                      <Link href="/grafo">La mappa delle leggi</Link>
                    </li>
                    <li>
                      <Link href="/mappa">Mappa del sito</Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h2>Usare il progetto</h2>
                  <ul>
                    <li>
                      <Link href="/mcp">MCP: nel tuo assistente</Link>
                    </li>
                    <li>
                      <Link href="/dati">Dati e precisione</Link>
                    </li>
                    <li>
                      <Link href="/stampa">Per la stampa</Link>
                    </li>
                    <li>
                      <Link href="/come-funziona">Come funziona</Link>
                    </li>
                    <li>
                      <a href={REPO_URL}>Codice sorgente su GitHub</a>
                    </li>
                    <li>
                      <a href={`${REPO_URL}/releases`}>Scarica il dataset</a>
                    </li>
                  </ul>
                </div>

                <div>
                  <h2>Scriverci</h2>
                  <ul>
                    <li>
                      <Link href="/segnala">Qualcosa non torna?</Link>
                    </li>
                    <li>
                      <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
                    </li>
                    <li>
                      <Link href="/dicono">Dicono di noi</Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h2>Licenze</h2>
                  <ul>
                    <li>Software: EUPL 1.2</li>
                    <li>Dataset derivato: CC BY 4.0</li>
                    <li>
                      <a href="https://dati.normattiva.it">Fonte: Normattiva open data</a>
                    </li>
                    <li>
                      <a href="https://www.cortecostituzionale.it">Fonte: Corte costituzionale</a>
                    </li>
                    <li>
                      <Link href="/legal">Privacy, termini e responsabilità</Link>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Il sostegno non è una voce d'elenco fra le altre: il progetto non
                ha pubblicità né abbonamenti, e chi lo usa è l'unico posto da cui
                possono arrivare i soldi che lo tengono in piedi. Sta in un
                blocco suo, dove si vede. */}
              <div className="piede__sostegno">
                <p>
                  <strong>Questo sito non ha pubblicità, abbonamenti o tracciamento.</strong> Se vi
                  serve e volete che continui, il modo più diretto è questo.
                </p>
                <p className="azioni">
                  <a className="bottone bottone--primario" href={SOSTIENI_URL}>
                    Offri un caffè al progetto
                  </a>
                  <Link className="bottone" href="/segnala">
                    Segnala un problema
                  </Link>
                </p>
              </div>

              {/* La riga sulle fonti è permanente e non è un banner da chiudere:
                compare su ogni pagina che mostra testo normativo, perché i
                termini di Normattiva lo richiedono e perché è un'informazione
                utile — dice a chi legge da dove viene ogni parola e dove andarla
                a verificare.

                Sta nel piede e non sopra la prima riga di testo. Un cartello
                messo davanti al contenuto lo si salta: dopo tre pagine non lo
                legge più nessuno, e intanto ha rubato lo spazio in cui il sito
                deve dire cosa ha trovato. Qui invece sta dove si cercano le
                fonti, sempre nello stesso punto, su ogni pagina.

                È scritta in positivo di proposito: «testo che fa fede» al posto
                di «non ha carattere di ufficialità» dice esattamente la stessa
                cosa e la dice a chi non sa cosa voglia dire «carattere di
                ufficialità».

                L'ultima frase invece è alla lettera «questo sito non fornisce
                consulenza legale», e alla lettera deve restare. È una formula
                con un significato consolidato: chi deve valutarla — un ordine
                professionale, un ufficio legale, un giudice — cerca quelle
                parole, non una parafrasi. Riscriverla meglio la indebolisce, e
                qui la chiarezza vale meno della certezza. */}
              <div className="attribuzione">
                <p className="avvertenza">
                  I testi vengono da <strong>Normattiva</strong> e sono citati alla lettera, così
                  ogni affermazione di questo sito si può risalire fino alla fonte. Il testo che fa
                  fede resta quello pubblicato sulla <em>Gazzetta Ufficiale</em>, e prevale in caso
                  di discordanza. Quello che trovate qui serve a farsi un’opinione documentata in
                  fretta: <strong>questo sito non fornisce consulenza legale</strong>.
                </p>
                <p className="attribuzione__fonti">
                  <strong>Fonti:</strong> Normattiva — Banca dati delle norme vigenti,{' '}
                  <a href="https://dati.normattiva.it">dati.normattiva.it</a>, con licenza{' '}
                  <a href="https://creativecommons.org/licenses/by/4.0/deed.it">CC BY 4.0</a>; Corte
                  costituzionale, open data con licenza{' '}
                  <a href="https://creativecommons.org/licenses/by-sa/3.0/it/">CC BY-SA 3.0</a>. Le
                  elaborazioni e le segnalazioni sono nostre, e{' '}
                  <Link href="/segnala">si possono contestare qui</Link>.
                </p>
              </div>
            </div>
          </footer>
        </FornitoreTema>
      </body>
    </html>
  );
}
