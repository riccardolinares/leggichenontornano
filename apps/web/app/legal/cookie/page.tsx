import Link from 'next/link';
import { IntestazioneLegale } from '@/components/intestazione-legale';
import { REPO_URL } from '@/lib/dataset';
import { paginaLegale } from '@/lib/legale';
import { bloccoDatiStrutturati, datiStrutturatiDocumento, metadatiPagina } from '@/lib/seo';

/*
 * La pagina sui cookie.
 *
 * Il sito non ne pone nessuno, e questa pagina lo dice in una riga. La
 * tentazione opposta — riempirla di tabelle su cookie tecnici, di sessione e
 * di terze parti che qui non esistono — produrrebbe un documento più
 * autorevole all'aspetto e falso nella sostanza: esattamente la cosa che
 * questo progetto rimprovera a chi scrive che una norma «è illegittima» quando
 * ha trovato solo due date che non tornano.
 *
 * La parte che vale è l'ultima: c'è un test che lo verifica, e il giorno che
 * qualcuno aggiungerà qualcosa che pone un cookie sarà la build a fermarsi,
 * non un lettore ad accorgersene.
 */

const PERCORSO = '/legal/cookie';

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Cookie',
  descrizione:
    'Questo sito non pone cookie: né tecnici, né di sessione, né di terze parti. Ecco perché, e come si verifica.',
  percorso: PERCORSO,
});

export default function Cookie() {
  const pagina = paginaLegale(PERCORSO);

  return (
    <div className="contenitore stretto">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiDocumento({
            titolo: 'Cookie',
            descrizione: 'Questo sito non pone cookie. Perché, e come si verifica.',
            percorso: PERCORSO,
            dataPubblicazione: pagina.aggiornataIl,
          }),
        )}
      />

      <IntestazioneLegale percorso={PERCORSO} />

      <p className="apertura">
        <strong>Questo sito non pone cookie.</strong> Nessuno: né tecnici, né di sessione, né di
        terze parti. Non c’è un banner perché non c’è niente da chiedervi.
      </p>

      <section className="sezione" aria-labelledby="perche">
        <h2 id="perche" className="sezione__titolo">
          Perché non ce n’è bisogno
        </h2>
        <p>
          Un cookie serve a riconoscere il browser che torna. Qui non c’è niente da riconoscere: le
          pagine sono costruite durante la build e servite identiche a chiunque le chieda, non c’è
          un account, non c’è un carrello, non c’è una preferenza da ricordare. Anche il modulo{' '}
          <Link href="/segnala">«Qualcosa non torna?»</Link> funziona senza sessione — manda quello
          che avete scritto e riceve una risposta, e con quella finisce.
        </p>
        <p>
          Il resto è conseguenza di come il sito è fatto. I caratteri tipografici vengono scaricati
          in fase di build e serviti da questo dominio, così il vostro browser non contatta nessun
          altro per leggerli. Non ci sono video incorporati, mappe, pulsanti social, misure di
          pubblico o inserzioni: sono le cose che di solito portano i cookie dentro un sito, e
          ciascuna avrebbe voluto in cambio un pezzo di quello che fate. Nemmeno la memoria del
          browser viene usata: niente <code>localStorage</code>, niente <code>sessionStorage</code>.
        </p>
      </section>

      <section className="sezione" aria-labelledby="prova">
        <h2 id="prova" className="sezione__titolo">
          E come fate a verificarlo
        </h2>
        <p>
          In due modi, e nessuno dei due richiede di fidarsi di questa pagina. Il primo è aprire gli
          strumenti di sviluppo del vostro browser e guardare l’elenco dei cookie per questo
          dominio: è vuoto.
        </p>
        <p>
          Il secondo è che lo verifica la build. Fra i test end-to-end del progetto ce n’è uno che
          visita la home, il modulo delle segnalazioni e questa pagina, poi chiede al browser
          l’elenco dei cookie e pretende che sia vuoto. Sta in{' '}
          <a href={`${REPO_URL}/blob/main/apps/web/e2e/usabilita.spec.ts`}>
            <code>apps/web/e2e/usabilita.spec.ts</code>
          </a>
          . Se qualcuno aggiungesse un componente che pone un cookie, quel test fallirebbe e la
          pagina che state leggendo non potrebbe diventare falsa senza che nessuno se ne accorga.
        </p>
      </section>

      <section className="sezione" aria-labelledby="se-cambia">
        <h2 id="se-cambia" className="sezione__titolo">
          Se un giorno servisse
        </h2>
        <p>
          Se un cookie tecnico diventasse necessario, questa pagina direbbe quale, a cosa serve,
          quanto dura e cosa succede rifiutandolo — prima di metterlo, non dopo. Un cookie che
          profila chi legge invece non arriverà: un sito che chiede alle istituzioni di essere
          verificabili non può guadagnare sull’attenzione di chi lo consulta. Come si tiene in piedi
          è scritto <Link href="/stampa">nella pagina per la stampa</Link>, ed è l’unico modello che
          ha.
        </p>
        <p>
          Quello che il sito può ricevere, nell’unico caso in cui riceve qualcosa, è descritto nell’
          <Link href="/legal/privacy">informativa privacy</Link>.
        </p>
      </section>
    </div>
  );
}
