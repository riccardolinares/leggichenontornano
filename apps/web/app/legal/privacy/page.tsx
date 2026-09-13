import Link from 'next/link';
import { IntestazioneLegale } from '@/components/intestazione-legale';
import { Tabella } from '@/components/tabella';
import { EMAIL, REPO_URL } from '@/lib/dataset';
import { BASE_TRASFERIMENTO, INDIRIZZO_TITOLARE, TITOLARE, paginaLegale } from '@/lib/legale';
import { bloccoDatiStrutturati, datiStrutturatiDocumento, metadatiPagina } from '@/lib/seo';

/*
 * L'informativa privacy, scritta sui trattamenti che questo sito fa davvero.
 *
 * Sono tre: il modulo delle segnalazioni, il freno anti-abuso che legge
 * l'indirizzo IP per dieci minuti, e i log che l'hosting tiene comunque. Tutto
 * il resto di un'informativa tipo — profilazione, newsletter, account,
 * marketing — qui non c'è, e non viene elencato per dire che non c'è: un
 * elenco di trattamenti assenti fa sembrare grande un trattamento piccolo, e
 * chi legge smette di distinguere la riga che lo riguarda davvero.
 *
 * La riga che lo riguarda davvero è una sola, ed è messa in evidenza in cima:
 * quello che scrive diventa pubblico.
 */

const PERCORSO = '/legal/privacy';

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Informativa privacy',
  descrizione:
    'Quali dati questo sito può ricevere, dove finiscono, per quanto restano e come si chiede di cancellarli. Informativa ai sensi dell’art. 13 del Regolamento (UE) 2016/679.',
  percorso: PERCORSO,
});

export default function Privacy() {
  const pagina = paginaLegale(PERCORSO);

  return (
    <div className="contenitore stretto">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiDocumento({
            titolo: 'Informativa privacy',
            descrizione:
              'Quali dati questo sito può ricevere, dove finiscono e come si chiede di cancellarli.',
            percorso: PERCORSO,
            dataPubblicazione: pagina.aggiornataIl,
          }),
        )}
      />

      <IntestazioneLegale percorso={PERCORSO} />

      <p className="apertura">
        Questo sito pubblica testi di legge, e per farlo non ha bisogno di sapere chi siete. L’unico
        momento in cui può ricevere un vostro dato è quando lo scrivete voi, nel modulo{' '}
        <Link href="/segnala">«Qualcosa non torna?»</Link>. Questa pagina dice cosa succede a quel
        dato, passaggio per passaggio.
      </p>

      {/* La cosa più importante dell'intera informativa, e sta prima di tutto
          il resto: chi scrive nel modulo deve saperlo *mentre decide se
          scrivere*, non in fondo a una pagina che aprirà dopo. */}
      <div className="niente-segnale">
        <h2 style={{ marginTop: 0 }}>Quello che scrivete nel modulo diventa pubblico</h2>
        <p style={{ marginBottom: 0 }}>
          La segnalazione diventa una <strong>issue pubblica</strong> nella repository del progetto
          su GitHub: il testo che avete scritto, la pagina da cui siete partiti e, se lo lasciate,
          il contatto. Chiunque può leggerla senza registrarsi, i motori di ricerca la indicizzano,
          e resta lì. Se la cosa è delicata, scrivetela a <a href={`mailto:${EMAIL}`}>{EMAIL}</a>:
          quella strada resta privata.
        </p>
      </div>

      <section className="sezione" aria-labelledby="titolare">
        <h2 id="titolare" className="sezione__titolo">
          Chi risponde di questi dati
        </h2>
        <p>
          Titolare del trattamento: <strong>{TITOLARE}</strong>, {INDIRIZZO_TITOLARE}. Per qualunque
          cosa riguardi i vostri dati — una domanda, una correzione, una richiesta di cancellazione
          — l’indirizzo è <a href={`mailto:${EMAIL}`}>{EMAIL}</a>, ed è lo stesso da cui passano la
          stampa e le segnalazioni riservate.
        </p>
      </section>

      <section className="sezione" aria-labelledby="cosa">
        <h2 id="cosa" className="sezione__titolo">
          Cosa il sito riceve, e quando
        </h2>
        <Tabella didascalia="I dati che questo sito può ricevere, il momento in cui li riceve, a cosa servono e quanto restano.">
          <thead>
            <tr>
              <th scope="col">Dato</th>
              <th scope="col">Quando</th>
              <th scope="col">A cosa serve</th>
              <th scope="col">Quanto resta</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Il testo della segnalazione</th>
              <td>quando premete «Manda la segnalazione»</td>
              <td>diventa il corpo della issue pubblica, ed è quello su cui lavoriamo</td>
              <td>finché la repository è pubblica, salvo vostra richiesta di cancellazione</td>
            </tr>
            <tr>
              <th scope="row">Un contatto, se lo lasciate</th>
              <td>stesso momento, ed è un campo facoltativo</td>
              <td>a rispondervi: senza, la segnalazione vale uguale e non vi risponde nessuno</td>
              <td>finisce nella issue pubblica insieme al resto</td>
            </tr>
            <tr>
              <th scope="row">La pagina da cui scrivete e il tipo di problema</th>
              <td>stesso momento, li mette il modulo</td>
              <td>a capire dove guardare</td>
              <td>finiscono nel titolo e nel corpo della issue</td>
            </tr>
            <tr>
              <th scope="row">Il vostro indirizzo IP</th>
              <td>a ogni invio del modulo</td>
              <td>
                a fermare chi rimanda lo stesso modulo dieci volte: tre invii ogni dieci minuti
              </td>
              <td>
                dieci minuti nella memoria del server, e sparisce al riavvio. Non entra nella issue
                e non viene scritto su nessun file
              </td>
            </tr>
            <tr>
              <th scope="row">I log tecnici dell’hosting</th>
              <td>a ogni visita, come su qualunque server</td>
              <td>
                a far funzionare il sito e ad accorgersi di un guasto: indirizzo IP, ora, pagina
                chiesta, tipo di browser
              </td>
              <td>li tiene Vercel per il periodo previsto dal piano su cui gira il sito</td>
            </tr>
          </tbody>
        </Tabella>
        <p>
          Questa tabella è tutto. Le pagine del sito sono costruite in anticipo e servite uguali a
          chiunque le chieda: non c’è un account, non c’è una sessione, non c’è una misura di
          pubblico. È una cosa che si controlla invece di crederci —{' '}
          <a href={REPO_URL}>il codice è pubblico</a>, la sola rotta che riceve qualcosa è{' '}
          <code>/api/segnalazione</code>, e la <Link href="/legal/cookie">pagina sui cookie</Link>{' '}
          porta il test che verifica che dopo una visita il vostro browser non abbia niente addosso.
        </p>
      </section>

      <section className="sezione" aria-labelledby="dove-finisce">
        <h2 id="dove-finisce" className="sezione__titolo">
          Dove finisce quello che scrivete
        </h2>
        <p>
          Il modulo esiste perché segnalare un errore non richieda un account GitHub: la issue la
          apriamo noi, con un token che sta sul server e sa fare solo quello. Il risultato però è lo
          stesso di una issue aperta da voi — <strong>è pubblica</strong> — e nasce con l’etichetta{' '}
          <code>da-triage</code>.
        </p>
        <p>
          Da lì in poi vale quello che vale per qualunque pagina pubblica di internet: può essere
          copiata, citata, archiviata o duplicata in un fork da chiunque, e quelle copie non
          spariscono quando cancelliamo la nostra. È il motivo per cui il modulo, prima del
          pulsante, vi chiede di non metterci dati personali che non volete pubblici — vostri o di
          altri.
        </p>
        <p>
          Se l’apertura automatica non è attiva, il modulo non finge: vi porta su GitHub con il
          testo già dentro, e la pubblicate voi con il vostro account. In quel caso il dato passa da
          GitHub e non da questo sito.
        </p>
      </section>

      <section className="sezione" aria-labelledby="base">
        <h2 id="base" className="sezione__titolo">
          Su quale base giuridica
        </h2>
        <ul>
          <li>
            <strong>Il testo della segnalazione e il contatto</strong>: li mandate voi perché
            vengano pubblicati, ed è il vostro consenso a reggere il trattamento (art. 6, paragrafo
            1, lettera a, del Regolamento). Potete ritirarlo: significa chiederci di chiudere e
            cancellare la issue, e lo facciamo.
          </li>
          <li>
            <strong>L’indirizzo IP letto dal freno anti-abuso e i log dell’hosting</strong>:
            legittimo interesse (art. 6, paragrafo 1, lettera f) a tenere in piedi un servizio
            gratuito e a non farlo travolgere da un programma. È il minimo che serve a farlo
            funzionare, e dura il tempo scritto nella tabella qui sopra.
          </li>
        </ul>
        <p>
          Non c’è profilazione e non c’è nessuna decisione automatizzata che riguardi una persona
          (art. 22). I controlli di questo sito guardano il testo delle leggi, non chi lo legge:
          come funzionano è scritto in <Link href="/come-funziona">Come funziona</Link>.
        </p>
      </section>

      <section className="sezione" aria-labelledby="chi-vede">
        <h2 id="chi-vede" className="sezione__titolo">
          Chi altro li vede
        </h2>
        <p>
          Due fornitori, e sono nominati per nome perché vederli scritti è l’unico modo per
          valutarli.
        </p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> — l’hosting, come responsabile del trattamento. Le pagine
            sono generate in anticipo e servite dalla rete di distribuzione; l’unica parte calcolata
            a richiesta è la rotta che riceve le segnalazioni, e gira nella regione{' '}
            <code>fra1</code>, <strong>Francoforte, Unione europea</strong>. È dichiarato in{' '}
            <a href={`${REPO_URL}/blob/main/apps/web/vercel.json`}>
              <code>apps/web/vercel.json</code>
            </a>
            : senza quella riga la regione predefinita sarebbe negli Stati Uniti.
          </li>
          <li>
            <strong>GitHub, Inc.</strong> — dove vive la issue, che è pubblica per scelta. Quello
            che ci scrivete lo trattano loro secondo le loro condizioni, e lo vede chiunque.
          </li>
        </ul>
        <p>
          Sono entrambe società statunitensi. Anche con il codice che gira a Francoforte, un
          trasferimento di dati fuori dall’Unione europea può avvenire, e quando avviene sta sulle
          garanzie previste dagli articoli 44-49 del Regolamento: {BASE_TRASFERIMENTO}.
        </p>
        <p>
          Nessun altro. I dati di chi scrive non vengono ceduti, venduti, scambiati né usati per
          pubblicità: il progetto non ha inserzionisti, e{' '}
          <Link href="/stampa">come si tiene in piedi</Link> è scritto in chiaro.
        </p>
      </section>

      <section className="sezione" aria-labelledby="diritti">
        <h2 id="diritti" className="sezione__titolo">
          Cosa potete chiedere, e come
        </h2>
        <p>
          Gli articoli dal 15 al 22 del Regolamento vi danno una serie di diritti. Tradotti in cosa
          potete scrivere in una mail:
        </p>
        <ul>
          <li>
            <strong>«Cosa avete di mio?»</strong> — ve lo diciamo, e ve ne diamo copia (art. 15).
          </li>
          <li>
            <strong>«Questo dato è sbagliato, correggetelo»</strong> (art. 16).
          </li>
          <li>
            <strong>«Cancellatelo»</strong> (art. 17). Per una segnalazione significa che chiudiamo
            e cancelliamo la issue. Le copie che altri hanno già fatto — un fork, un motore di
            ricerca, un archivio — non possiamo toglierle, ed è meglio saperlo prima di scrivere che
            dopo.
          </li>
          <li>
            <strong>«Fermatevi finché non chiariamo»</strong> (art. 18), mentre contestate
            l’esattezza di un dato o il nostro legittimo interesse.
          </li>
          <li>
            <strong>«Datemelo in un formato che posso riusare»</strong> (art. 20): quello che ci
            avete mandato ve lo ridiamo in un file leggibile da una macchina.
          </li>
          <li>
            <strong>«Non voglio»</strong> (art. 21), per i trattamenti che stanno sul legittimo
            interesse.
          </li>
        </ul>
        <p>
          Si scrive a <a href={`mailto:${EMAIL}`}>{EMAIL}</a> e si risponde entro un mese, che è il
          termine dell’art. 12. Non chiediamo di compilare moduli: basta dire quale segnalazione e
          cosa volete che ne facciamo.
        </p>
        <p>
          Se la risposta non vi soddisfa potete rivolgervi al{' '}
          <a href="https://www.garanteprivacy.it">Garante per la protezione dei dati personali</a>{' '}
          con un reclamo (art. 77), oppure al giudice. Sono strade vostre e questa pagina non ne
          chiude nessuna.
        </p>
      </section>

      <section className="sezione" aria-labelledby="minori">
        <h2 id="minori" className="sezione__titolo">
          Una nota sui minori
        </h2>
        <p>
          Il sito non ha registrazione e non chiede l’età a nessuno. Il modulo però pubblica quello
          che riceve: se lo usa un ragazzo, quel testo diventa pubblico come per chiunque altro. È
          una ragione in più perché il modulo serva a descrivere un problema in una pagina, e non a
          raccontare una storia personale.
        </p>
      </section>

      <section className="sezione" aria-labelledby="modifiche">
        <h2 id="modifiche" className="sezione__titolo">
          Quando questa pagina cambia
        </h2>
        <p>
          La data in cima cambia con il testo. E siccome questa pagina sta nella stessa repository
          del sito, ogni modifica è un commit pubblico: cosa diceva prima, e quando lo ha smesso di
          dire, si legge nella <a href={`${REPO_URL}/commits/main`}>cronologia</a> invece di doverci
          credere.
        </p>
      </section>
    </div>
  );
}
