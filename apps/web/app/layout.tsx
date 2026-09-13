import type { Metadata } from 'next';
import { Archivo, Newsreader } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Navigazione } from '@/components/navigazione';
import { REPO_URL, SITE_URL } from '@/lib/dataset';

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Le leggi che non tornano',
    template: '%s — Le leggi che non tornano',
  },
  description:
    'Incongruenze, contraddizioni e aree grigie della legislazione italiana, con le prove e la regola che le ha trovate.',
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    siteName: 'Le leggi che non tornano',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${serif.variable} ${grottesco.variable}`}>
      <body>
        {/* Primo elemento focalizzabile della pagina: chi naviga da tastiera
            non deve attraversare la navigazione a ogni cambio di pagina. */}
        <a className="salta" href="#contenuto">
          Vai al contenuto
        </a>

        <header className="testata">
          <div className="contenitore testata__riga">
            <Link href="/" className="marchio">
              Le leggi che non tornano
              <span className="marchio__tecnico">progetto antinomia</span>
            </Link>
            <Navigazione />
          </div>
        </header>

        {/* L'avvertenza è permanente e non è un banner da chiudere: compare su
            ogni pagina che può mostrare testo normativo, come richiesto dai
            termini di Normattiva e dal metodo del progetto. */}
        <div className="avvertenza">
          <p className="contenitore">
            Elaborazione automatica su dati <strong>Normattiva</strong> (CC BY 4.0). La banca dati
            Normattiva non ha carattere di ufficialità: l’unico testo ufficiale è quello pubblicato
            sulla <em>Gazzetta Ufficiale</em>, che prevale in caso di discordanza. Questo sito non
            fornisce consulenza legale.
          </p>
        </div>

        <main id="contenuto">{children}</main>

        <footer className="piede">
          <div className="contenitore">
            <div className="piede__griglia">
              <div>
                <h2>Il progetto</h2>
                <ul>
                  <li>
                    <Link href="/come-funziona">Come funziona</Link>
                  </li>
                  <li>
                    <Link href="/dati">Dati e precisione</Link>
                  </li>
                  <li>
                    <Link href="/stampa">Per la stampa</Link>
                  </li>
                  <li>
                    <a href={REPO_URL}>Codice sorgente</a>
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
                </ul>
              </div>
              <div>
                <h2>Cosa non facciamo</h2>
                <ul>
                  <li>Nessuna consulenza legale</li>
                  <li>Nessuna dichiarazione di illegittimità</li>
                  <li>Nessun modello che giudica le norme</li>
                  <li>Nessun voto, nessuna classifica</li>
                </ul>
              </div>
            </div>

            <p className="attribuzione" style={{ marginTop: '2rem' }}>
              <strong>Fonte dei dati:</strong> Normattiva — Banca dati delle norme vigenti,{' '}
              <a href="https://dati.normattiva.it">dati.normattiva.it</a>, distribuiti con licenza{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/deed.it">CC BY 4.0</a>. Le
              elaborazioni, le segnalazioni e gli errori sono nostri.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
