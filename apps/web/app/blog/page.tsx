import Link from 'next/link';
import { articoli } from '@/lib/blog';
import { dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import { data, percorsoAnomalia } from '@/lib/testo';

/*
 * L'indice del blog.
 *
 * Il blog esiste per una ragione sola: una scheda di segnalazione dice *cosa*
 * risulta dai testi, e lo dice bene, ma non dice *perché dovrebbe importare a
 * qualcuno*. Quella distanza — fra un fatto verificabile e una persona che
 * capisce di cosa si tratta — è quella che questo progetto deve coprire per
 * non restare un archivio consultato da dieci addetti.
 *
 * Ogni articolo nasce da una segnalazione e la cita: non c'è un articolo senza
 * la sua scheda, e la scheda resta la prova.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Approfondimenti',
  descrizione:
    'Un approfondimento al giorno su una legge che non torna: cosa succede in pratica, a chi, e da quanto. Ogni articolo parte da una segnalazione verificabile.',
  percorso: '/blog',
});

export default function Blog() {
  const elenco = articoli();
  const reader = dataset();

  return (
    <div className="contenitore">
      <h1>Approfondimenti</h1>
      <p className="apertura">
        Una scheda di segnalazione dice cosa risulta dai testi. Non dice perché dovrebbe importare a
        qualcuno. Questi articoli coprono quella distanza: partono da una segnalazione verificabile
        e raccontano cosa succede in pratica, a chi, e da quanto tempo.
      </p>

      {elenco.length === 0 ? (
        <div className="niente-segnale">
          <h2>Nessun approfondimento pubblicato</h2>
          <p>
            La redazione scrive un articolo al giorno a partire da una segnalazione, ma qui non ce
            n’è ancora nessuno: o la generazione non è configurata su questo ambiente, o non è
            ancora girata.
          </p>
          <p>
            Nel frattempo <Link href="/">le segnalazioni</Link> ci sono tutte, con i testi originali
            e la regola che le ha trovate.
          </p>
        </div>
      ) : (
        <ol className="elenco">
          {elenco.map((a) => {
            const segnalazione = reader.anomaly(a.anomaliaId);
            return (
              <li key={a.slug} className="scheda">
                <p className="scheda__meta">
                  <span>{data(a.data)}</span>
                  {a.modello ? <span>scritto da un modello, verificato sui fatti</span> : null}
                </p>
                <h2 className="scheda__titolo">
                  <Link href={`/blog/${a.slug}`}>{a.titolo}</Link>
                </h2>
                <p className="scheda__pratica">{a.sommario}</p>
                {segnalazione ? (
                  <p className="scheda__meta">
                    <Link href={percorsoAnomalia(segnalazione.id)}>
                      La segnalazione da cui nasce
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
