import Link from 'next/link';
import { IntestazioneLegale } from '@/components/intestazione-legale';
import { Tabella } from '@/components/tabella';
import { EMAIL, REPO_URL } from '@/lib/dataset';
import { paginaLegale } from '@/lib/legale';
import { bloccoDatiStrutturati, datiStrutturatiDocumento, metadatiPagina } from '@/lib/seo';

/*
 * I termini di servizio.
 *
 * Su questo sito quasi tutto è permesso: la parte lunga non sono i divieti, è
 * la spiegazione di come riusare i dati senza sbagliare l'attribuzione. Le
 * licenze sono già decise — EUPL 1.2 per il software, CC BY 4.0 per il dataset
 * derivato — e qui vengono scritte dal lato di chi le deve rispettare, cioè
 * come cose da fare e non come clausole da subire.
 */

const PERCORSO = '/legal/termini';

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Termini di servizio',
  descrizione:
    'Cosa potete fare con questo sito e con i suoi dati, con quale attribuzione, e cosa vi garantiamo.',
  percorso: PERCORSO,
});

export default function Termini() {
  const pagina = paginaLegale(PERCORSO);

  return (
    <div className="contenitore stretto">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiDocumento({
            titolo: 'Termini di servizio',
            descrizione:
              'Cosa potete fare con questo sito e con i suoi dati, e a quali condizioni.',
            percorso: PERCORSO,
            dataPubblicazione: pagina.aggiornataIl,
          }),
        )}
      />

      <IntestazioneLegale percorso={PERCORSO} />

      <p className="apertura">
        Il sito è gratuito, non chiede registrazione e non vende niente. Queste sono le condizioni
        con cui potete usarlo: siccome quasi tutto è permesso, la parte che vale la pena leggere è
        quella sulle licenze — dice cosa scrivere sotto quando riusate i nostri dati.
      </p>

      <section className="sezione" aria-labelledby="potete">
        <h2 id="potete" className="sezione__titolo">
          Cosa potete fare
        </h2>
        <ul>
          <li>
            <strong>Leggere, copiare e citare</strong> qualunque pagina, in un articolo, in una
            tesi, in una memoria difensiva, in un atto di sindacato ispettivo. Ogni segnalazione ha
            un URL stabile fatto apposta per essere incollato.
          </li>
          <li>
            <strong>Scaricare tutto il dataset</strong> e rifare le nostre interrogazioni. Se
            ottenete conclusioni diverse dalle nostre, pubblicatele: è il motivo per cui il dataset
            è scaricabile.
          </li>
          <li>
            <strong>Usare l’API pubblica e il server MCP</strong>, senza account e senza chiave, per
            interrogare il corpus da un vostro programma o da dentro un assistente.
          </li>
          <li>
            <strong>Rifare il sito da zero.</strong> Il codice è aperto: si clona, si esegue la
            pipeline e si ottiene lo stesso sito. È così che si controlla che i numeri non siano
            scritti a mano.
          </li>
          <li>
            <strong>Contestare qualunque segnalazione.</strong> Il pulsante «Non è un conflitto» e
            il modulo <Link href="/segnala">«Qualcosa non torna?»</Link> servono a questo, e le
            risposte cambiano la precisione misurata del controllo: possono toglierlo dal sito.
          </li>
        </ul>
        <p>
          Una sola cosa vi chiediamo di non fare: interrogare il sito con una frequenza che lo
          metterebbe in ginocchio per tutti gli altri. Se vi serve tutto il corpus,{' '}
          <Link href="/dati">scaricate il dataset</Link> — è più veloce per voi e non toglie il sito
          a nessuno.
        </p>
      </section>

      <section className="sezione" aria-labelledby="licenze">
        <h2 id="licenze" className="sezione__titolo">
          Le licenze, e cosa chiedono in cambio
        </h2>
        <Tabella didascalia="Le licenze delle parti che compongono questo sito, e cosa deve fare chi le riusa.">
          <thead>
            <tr>
              <th scope="col">Cosa</th>
              <th scope="col">Licenza</th>
              <th scope="col">Cosa dovete fare</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Il software del sito e della pipeline</th>
              <td>
                <a href={`${REPO_URL}/blob/main/LICENSE`}>EUPL 1.2</a>
              </td>
              <td>
                se lo modificate e lo distribuite — anche solo offrendolo come servizio in rete —
                distribuite il sorgente con la stessa licenza o con una di quelle che la EUPL
                dichiara compatibili
              </td>
            </tr>
            <tr>
              <th scope="row">Il dataset derivato e i testi delle segnalazioni</th>
              <td>
                <a href="https://creativecommons.org/licenses/by/4.0/deed.it">CC BY 4.0</a>
              </td>
              <td>
                citate «Le leggi che non tornano» con il collegamento alla pagina da cui viene il
                dato; per il resto fatene quello che volete, anche a scopo commerciale
              </td>
            </tr>
            <tr>
              <th scope="row">I testi normativi</th>
              <td>
                <a href="https://dati.normattiva.it">Normattiva</a>, CC BY 4.0
              </td>
              <td>
                citate Normattiva come fonte: sono testi loro, qui riportati alla lettera e con la
                data di vigenza
              </td>
            </tr>
            <tr>
              <th scope="row">I dispositivi della Corte costituzionale</th>
              <td>
                <a href="https://creativecommons.org/licenses/by-sa/3.0/it/">CC BY-SA 3.0</a>
              </td>
              <td>
                citate la Corte e, se pubblicate un’opera derivata da quei testi, usate la stessa
                licenza: è la condizione in più che la BY-SA porta con sé
              </td>
            </tr>
          </tbody>
        </Tabella>
        <p>
          La regola pratica per citare bene: l’URL della segnalazione o della norma{' '}
          <strong>con la data di vigenza</strong>. Lo stesso articolo dice cose diverse in momenti
          diversi, e un riferimento senza data è un riferimento ambiguo. Le istruzioni per esteso
          stanno nella <Link href="/dati">pagina dei dati</Link>.
        </p>
      </section>

      <section className="sezione" aria-labelledby="modulo">
        <h2 id="modulo" className="sezione__titolo">
          Se usate il modulo delle segnalazioni
        </h2>
        <p>
          Quello che scrivete diventa una <strong>issue pubblica</strong> su GitHub: prima di
          premere il pulsante vale la pena leggere{' '}
          <Link href="/legal/privacy">come la trattiamo</Link>. Da qui discendono tre cose.
        </p>
        <ul>
          <li>
            <strong>Scrivete del problema, non delle persone.</strong> Serve la pagina, il numero,
            cosa vi aspettavate di trovare. Non servono i dati personali di nessuno, né documenti
            coperti da segreto o da riservatezza: quel materiale in una pagina pubblica non ci deve
            stare.
          </li>
          <li>
            <strong>Il testo resta vostro</strong>, e mandandolo ci date il permesso di pubblicarlo
            nella repository e di citarlo nel sito e nel dataset con la licenza CC BY 4.0. Se
            cambiate idea, ce lo dite e lo cancelliamo.
          </li>
          <li>
            <strong>Possiamo chiudere o cancellare una issue</strong> quando contiene dati personali
            di qualcuno che non ha scelto di renderli pubblici, insulti o messaggi automatici. Le
            regole di convivenza sono quelle del{' '}
            <a href={`${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`}>codice di condotta</a> del
            progetto, ed è l’unico caso in cui togliamo qualcosa che qualcuno ha scritto.
          </li>
        </ul>
        <p>
          Se la cosa è delicata e non volete lasciarla pubblica, l’indirizzo è{' '}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </section>

      <section className="sezione" aria-labelledby="garanzie">
        <h2 id="garanzie" className="sezione__titolo">
          Cosa vi garantiamo
        </h2>
        <ul>
          <li>
            <strong>Che ogni affermazione abbia la sua fonte accanto.</strong> I testi originali
            stanno in pagina, la regola che ha prodotto una segnalazione è scritta in chiaro, e
            chiunque può rifare il conto.
          </li>
          <li>
            <strong>Che gli indirizzi restino.</strong> L’URL di una segnalazione e quello di una
            norma sono pensati per essere citati in un documento che durerà più del sito: non li
            cambiamo per comodità nostra.
          </li>
          <li>
            <strong>Che quello che non sappiamo sia scritto.</strong> La{' '}
            <Link href="/dati">pagina dei dati</Link> dice quanto è grande il corpus, quali
            controlli girano e quali no, e con quale precisione misurata.
          </li>
        </ul>
        <p>
          Quello che non possiamo garantire è la continuità: è un progetto civico senza contratto di
          servizio, e può stare fermo per manutenzione o per un guasto di chi lo ospita. E quello
          che leggete qui resta un punto di partenza documentato, non un parere: cosa questo
          comporta è scritto nella{' '}
          <Link href="/legal/disclaimer">limitazione di responsabilità</Link>, che è la pagina da
          leggere prima di usare una segnalazione per decidere qualcosa.
        </p>
        <p>
          Del danno che derivasse da un errore del sito rispondiamo nei limiti in cui la legge non
          permette di escluderlo: dolo e colpa grave restano nostri, e nessuna riga di questa pagina
          li sposta. È una formula secca perché è l’unica onesta — un progetto gratuito non può
          promettere un risarcimento, ma neanche tirarsi fuori da quello che sbaglia sapendo di
          sbagliare.
        </p>
      </section>

      <section className="sezione" aria-labelledby="legge">
        <h2 id="legge" className="sezione__titolo">
          Legge applicabile
        </h2>
        <p>
          Si applica la legge italiana. Se usate il sito come consumatore, resta competente il
          giudice del luogo in cui risiedete o avete il domicilio: è una tutela che la legge vi dà e
          che questa pagina non tocca.
        </p>
        <p>
          La data in cima dice quando queste condizioni sono state riviste l’ultima volta. Ogni
          modifica è un commit pubblico nella{' '}
          <a href={`${REPO_URL}/commits/main`}>cronologia del progetto</a>.
        </p>
      </section>
    </div>
  );
}
