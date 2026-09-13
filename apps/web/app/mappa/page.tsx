import Link from 'next/link';
import { CHECK_DEFINITIONS } from '@leggichenontornano/engine';
import { articoli } from '@/lib/blog';
import { SITE_URL, dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import { numero, percorsoPronuncia, titoloPronuncia } from '@/lib/testo';

/*
 * La mappa del sito, per le persone.
 *
 * `sitemap.xml` esiste e serve ai motori di ricerca; questa pagina serve a
 * chiunque altro, compreso un assistente che sta cercando di capire cosa c'è
 * qui dentro. Le due cose non si sostituiscono: una è un elenco di URL, questa
 * dice anche **cosa ci si trova** — che è l'informazione che manca a chi
 * arriva da una ricerca su una pagina interna e non sa dove sia finito.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Mappa del sito',
  descrizione:
    'Tutto quello che c’è su leggichenontornano.it: le segnalazioni, i controlli, le norme, le pronunce, gli approfondimenti e i dati scaricabili.',
  percorso: '/mappa',
});

export default function Mappa() {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const pubblicate = reader.publishedAnomalies();
  const pronunce = reader.pronunce();
  const approfondimenti = articoli();

  return (
    <div className="contenitore">
      <h1>Mappa del sito</h1>
      <p className="apertura">
        Tutto quello che c’è qui dentro, in una pagina sola. Per i motori di ricerca c’è{' '}
        <a href={`${SITE_URL}/sitemap.xml`}>sitemap.xml</a>; per un assistente c’è{' '}
        <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>.
      </p>

      <div className="mappa">
        <section aria-labelledby="m-leggere">
          <h2 id="m-leggere">Da leggere</h2>
          <ul>
            <li>
              <Link href="/">Le segnalazioni</Link> — {numero(pubblicate.length)} punti in cui la
              legislazione non torna, con i testi e la regola che li ha trovati
            </li>
            <li>
              <Link href="/numeri">I numeri</Link> — le cifre più dure che il dataset sostiene
            </li>
            <li>
              <Link href="/blog">Approfondimenti</Link> —{' '}
              {approfondimenti.length > 0
                ? `${numero(approfondimenti.length)} articoli, uno al giorno`
                : 'un articolo al giorno su una legge che non torna'}
            </li>
            <li>
              <Link href="/dicono">Dicono di noi</Link> — chi usa il progetto, e cosa ne ha scritto
            </li>
          </ul>
        </section>

        <section aria-labelledby="m-consultare">
          <h2 id="m-consultare">Da consultare</h2>
          <ul>
            <li>
              <Link href="/norme">Le norme del corpus</Link> —{' '}
              {manifest ? `${numero(manifest.counts.acts)} atti` : 'gli atti ingeriti'}, ciascuno
              leggibile a qualunque data di vigenza
            </li>
            <li>
              <Link href="/corte">Le pronunce della Consulta</Link> — {numero(pronunce.length)}{' '}
              decisioni che hanno colpito norme del corpus
            </li>
            <li>
              <Link href="/dati">Dati e precisione</Link> — cosa copre il dataset e quanto è precisa
              ogni regola
            </li>
          </ul>
        </section>

        <section aria-labelledby="m-controlli">
          <h2 id="m-controlli">I controlli, uno per uno</h2>
          <ul>
            {CHECK_DEFINITIONS.map((c) => (
              <li key={c.id}>
                <Link href={`/controllo/${c.id}`}>{c.label}</Link> — {c.description}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="m-usare">
          <h2 id="m-usare">Da usare</h2>
          <ul>
            <li>
              <Link href="/assistente">Dentro il tuo assistente</Link> — collega Claude o Codex al
              corpus, tre righe di configurazione
            </li>
            <li>
              <Link href="/stampa">Per la stampa</Link> — dataset scaricabile, numeri e contatti
            </li>
            <li>
              <Link href="/come-funziona">Come funziona</Link> — il metodo, e cosa il progetto non
              fa
            </li>
            <li>
              <Link href="/segnala">Qualcosa non torna?</Link> — segnalate un problema, senza
              bisogno di un account
            </li>
          </ul>
        </section>

        {pronunce.length > 0 ? (
          <section aria-labelledby="m-pronunce">
            <h2 id="m-pronunce">Le decisioni più recenti</h2>
            <ul>
              {pronunce.slice(0, 10).map((p) => (
                <li key={p.ecli}>
                  <Link href={percorsoPronuncia(p.ecli)}>{titoloPronuncia(p)}</Link>
                </li>
              ))}
            </ul>
            <p>
              <Link href="/corte">Tutte le {numero(pronunce.length)} pronunce</Link>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
