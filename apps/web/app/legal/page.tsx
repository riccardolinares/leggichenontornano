import Link from 'next/link';
import { PAGINE_LEGALI } from '@/lib/legale';
import { bloccoDatiStrutturati, datiStrutturatiElenco, metadatiPagina } from '@/lib/seo';
import { data } from '@/lib/testo';

/*
 * L'indice delle pagine legali.
 *
 * Esiste perché il piede abbia un solo indirizzo da mostrare invece di
 * quattro, e perché chi cerca «privacy» o «termini» arriva quasi sempre da un
 * motore di ricerca su una parola sola: qui trova le quattro pagine con scritto
 * cosa dicono, invece di dover aprirle una per una.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Pagine legali',
  descrizione:
    'Informativa privacy, termini di servizio, cookie e limitazione di responsabilità: cosa il sito riceve, cosa potete farci e quanto vale quello che leggete.',
  percorso: '/legal',
});

export default function Legale() {
  return (
    <div className="contenitore stretto">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiElenco({
            titolo: 'Pagine legali',
            descrizione:
              'Informativa privacy, termini di servizio, cookie e limitazione di responsabilità.',
            percorso: '/legal',
            quanti: PAGINE_LEGALI.length,
          }),
        )}
      />

      <h1>Pagine legali</h1>
      <p className="apertura">
        Quattro pagine, scritte sui fatti di questo sito e non su un modello: quello che il sito
        riceve davvero, dove finisce, cosa potete fare con i dati che pubblica e quanto vale quello
        che ci leggete. Ognuna porta in cima la data in cui è stata rivista.
      </p>

      <ul className="legale-indice">
        {PAGINE_LEGALI.map((p) => (
          <li key={p.percorso}>
            <Link href={p.percorso}>{p.titolo}</Link>
            <p>{p.sommario}</p>
            <small>Ultimo aggiornamento: {data(p.aggiornataIl)}</small>
          </li>
        ))}
      </ul>

      <section className="sezione" aria-labelledby="in-breve">
        <h2 id="in-breve" className="sezione__titolo">
          In quattro righe
        </h2>
        <ul>
          <li>
            Le pagine sono costruite in anticipo e servite uguali a chiunque: il sito funziona senza
            sapere chi siete, e <strong>non pone nessun cookie</strong>.
          </li>
          <li>
            L’unico dato che può ricevere è quello che scrivete voi nel modulo{' '}
            <Link href="/segnala">«Qualcosa non torna?»</Link>, e quel testo{' '}
            <strong>diventa una segnalazione pubblica su GitHub</strong>.
          </li>
          <li>
            Il sito gira su Vercel, nella regione di Francoforte: il codice calcolato a richiesta
            resta nell’Unione europea.
          </li>
          <li>
            Il software è EUPL 1.2, il dataset derivato CC BY 4.0: potete rifare tutto da soli, con
            l’attribuzione come unica condizione.
          </li>
        </ul>
      </section>

      <section className="sezione" aria-labelledby="cambiano">
        <h2 id="cambiano" className="sezione__titolo">
          Come si controlla cosa dicevano prima
        </h2>
        <p>
          Queste pagine stanno nella stessa repository del resto del sito: ogni modifica è un commit
          pubblico, con la data e la riga cambiata. Chi vuole sapere cosa diceva l’informativa sei
          mesi fa non deve fidarsi di noi, la legge nella cronologia.
        </p>
      </section>
    </div>
  );
}
