import Link from 'next/link';
import { THRESHOLD } from '@leggichenontornano/engine';
import { IntestazioneLegale } from '@/components/intestazione-legale';
import { paginaLegale } from '@/lib/legale';
import { bloccoDatiStrutturati, datiStrutturatiDocumento, metadatiPagina } from '@/lib/seo';
import { percentuale } from '@/lib/testo';

/*
 * La limitazione di responsabilità.
 *
 * Dice le stesse cose dell'avvertenza che sta nel piede di ogni pagina, ma per
 * esteso e con le conseguenze pratiche: quale testo fa fede, cosa vale una
 * segnalazione, e soprattutto cosa *non* dice l'assenza di una segnalazione —
 * che è il fraintendimento più costoso fra tutti quelli possibili su questo
 * sito.
 *
 * La soglia di pubblicazione viene dal motore e non da una riga scritta qui:
 * il giorno che cambia, cambia anche in questa pagina.
 */

const PERCORSO = '/legal/disclaimer';

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Limitazione di responsabilità',
  descrizione:
    'Quanto vale quello che leggi qui: il testo che fa fede resta quello della Gazzetta Ufficiale, le segnalazioni sono elaborazioni automatiche, e il parere lo dà chi ha titolo per darlo.',
  percorso: PERCORSO,
});

export default function Disclaimer() {
  const pagina = paginaLegale(PERCORSO);

  return (
    <div className="contenitore stretto">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiDocumento({
            titolo: 'Limitazione di responsabilità',
            descrizione:
              'Il testo che fa fede, i limiti dei controlli automatici e come contestare una segnalazione.',
            percorso: PERCORSO,
            dataPubblicazione: pagina.aggiornataIl,
          }),
        )}
      />

      <IntestazioneLegale percorso={PERCORSO} />

      <p className="apertura">
        Questo sito racconta cosa ha trovato un’interrogazione dentro il testo delle leggi. Vale
        come punto di partenza documentato — con i testi originali, le date e la regola davanti — e
        va usato per quello. Questa pagina dice fin dove arriva.
      </p>

      <section className="sezione" aria-labelledby="fa-fede">
        <h2 id="fa-fede" className="sezione__titolo">
          Qual è il testo che fa fede
        </h2>
        <p>
          I testi normativi che trovi qui vengono dagli open data di <strong>Normattiva</strong> e
          sono citati alla lettera, così ogni affermazione del sito si può risalire fino alla fonte.
          Quella banca dati però <strong>non ha carattere di ufficialità</strong>, e nemmeno questa
          sua rielaborazione ce l’ha: il testo ufficiale resta quello pubblicato sulla{' '}
          <em>Gazzetta Ufficiale</em>, e <strong>prevale in caso di discordanza</strong>.
        </p>
        <p>
          In pratica: quando la cosa conta davvero — un termine che scade, un importo, una sanzione
          — si controlla in Gazzetta. Il sito ti dà l’URN e la data di vigenza esatta proprio perché
          quel controllo si faccia in un minuto invece che in un pomeriggio.
        </p>
      </section>

      <section className="sezione" aria-labelledby="parere">
        <h2 id="parere" className="sezione__titolo">
          Il parere lo dà chi ha titolo per darlo
        </h2>
        <p>
          <strong>Questo sito non fornisce consulenza legale</strong> e nessuna segnalazione è un
          parere: non conosce il tuo caso, le sue circostanze, gli atti che ci sono dietro né la
          giurisprudenza che vi si applica. Quello che fa è metterlo davanti a chi il parere lo deve
          dare: i due testi che non tornano, le loro finestre di vigenza, l’intersezione, i criteri
          classici di risoluzione valutati uno per uno. Con quella scheda in mano un professionista
          lavora più in fretta; al posto suo, non ci va.
        </p>
        <p>
          Il sito non dichiara illegittima nessuna norma: quello lo fa la Corte costituzionale, e le
          sue decisioni le riportiamo con le sue parole nella{' '}
          <Link href="/corte">sezione dedicata</Link>.
        </p>
      </section>

      <section className="sezione" aria-labelledby="automatiche">
        <h2 id="automatiche" className="sezione__titolo">
          Le segnalazioni sono elaborazioni automatiche
        </h2>
        <p>
          Nascono da controlli che girano sul corpus: ai livelli più bassi confrontano date e
          relazioni fra norme — «questa norma in vigore rinvia a un atto abrogato» è un fatto
          registrato — e ai livelli più alti confrontano il contenuto, e per farlo devono prima
          estrarre dal testo chi è obbligato a cosa ed entro quando. L’estrazione sbaglia, e quando
          sbaglia la segnalazione è sbagliata.
        </p>
        <p>
          Per questo un controllo entra nell’indice pubblico solo sopra{' '}
          {percentuale(THRESHOLD.minPrecision)} di precisione misurata su revisione umana, e per
          questo la <Link href="/dati">pagina dei dati</Link> mostra anche i controlli che restano
          fuori, con il motivo. <strong>Una segnalazione può essere sbagliata</strong>, e la cosa
          più utile che puoi farci è dircelo: il pulsante «Non è un conflitto» su ogni scheda, o il
          modulo <Link href="/segnala">«Qualcosa non torna?»</Link>. Le risposte cambiano la
          precisione misurata del controllo e possono toglierlo dal sito — è già il meccanismo con
          cui il sito si corregge, non un canale di cortesia.
        </p>
      </section>

      <section className="sezione" aria-labelledby="assenza">
        <h2 id="assenza" className="sezione__titolo">
          Cosa non dice l’assenza di una segnalazione
        </h2>
        <div className="niente-segnale">
          <p>
            <strong>Una norma su cui non trovi niente non è per questo una norma coerente.</strong>{' '}
            Il corpus è la porzione di legislazione che abbiamo ingerito, non l’ordinamento
            italiano: una norma può essere fuori dal corpus, oppure dentro un controllo che non ha
            ancora superato la soglia, oppure dentro un tipo di incongruenza che nessun controllo
            cerca ancora.
          </p>
          <p style={{ marginBottom: 0 }}>
            Quanto è grande il corpus e quali controlli girano è scritto, aggiornato, nella{' '}
            <Link href="/dati">pagina dei dati</Link>. Nessuna pagina di questo sito è una
            certificazione di conformità, e l’indice delle segnalazioni non è una mappa completa: è
            quello che i controlli hanno trovato finora.
          </p>
        </div>
        <p>
          Vale anche per i numeri. Il contatore dei giorni misura{' '}
          <strong>termini scaduti, non attuazioni mancate</strong>: che il provvedimento sia
          arrivato in ritardo o non sia arrivato affatto è una verifica in Gazzetta Ufficiale che il
          progetto non ha ancora fatto, ed è scritto ogni volta che il numero compare. Chi lo cita,
          lo citi per quello che è.
        </p>
      </section>

      <section className="sezione" aria-labelledby="esterni">
        <h2 id="esterni" className="sezione__titolo">
          I collegamenti verso l’esterno
        </h2>
        <p>
          Le pagine di Normattiva, della Corte costituzionale, della Gazzetta Ufficiale e di GitHub
          a cui il sito rimanda non sono nostre: del loro contenuto e della loro disponibilità
          risponde chi le pubblica. Le citiamo perché sono la fonte, ed è lì che vanno verificate le
          cose importanti.
        </p>
        <p>
          Come funzionano i controlli, per esteso, sta in{' '}
          <Link href="/come-funziona">Come funziona</Link>. Le condizioni d’uso del sito stanno nei{' '}
          <Link href="/legal/termini">termini di servizio</Link>.
        </p>
      </section>
    </div>
  );
}
