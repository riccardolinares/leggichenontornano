import Link from 'next/link';
import { CifreForti, type CifraForte } from '@/components/cifre-forti';
import { dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import {
  classeGravita,
  data,
  livello,
  numero,
  numeroDecimale,
  percorsoAnomalia,
  percorsoNorma,
  urnAtto,
} from '@/lib/testo';

/*
 * La home apriva con l'indice completo: centotré voci in fila, sotto cinque
 * paragrafi che spiegavano cosa fossero. Chi arrivava dal link di un
 * conoscente leggeva un titolo, una spiegazione e poi un elenco senza fine di
 * norme che non conosceva, e se ne andava.
 *
 * Adesso la home fa due cose e basta: mostra **le cifre che fanno alzare un
 * sopracciglio** prima che serva leggere, e **le ultime incongruenze trovate**.
 * L'indice completo, con i filtri e la coda di lavorazione, sta a
 * `/segnalazioni`: chi lo vuole ci arriva, e chi non sa ancora cosa sia questo
 * sito non ci sbatte contro.
 *
 * Ogni numero qui sotto è calcolato dal dataset a ogni generazione. Scriverli a
 * mano sarebbe più semplice e sarebbe il modo più rapido di ritrovarsi una
 * cifra falsa sulla home il giorno in cui il corpus cambia.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Le leggi che non tornano',
  descrizione:
    'Atti in vigore che rinviano a leggi cancellate, provvedimenti promessi e mai arrivati in tempo, norme che si contraddicono. Trovati leggendo i testi ufficiali.',
  percorso: '/',
});

/** Quante segnalazioni recenti stanno in home. */
const QUANTE_ULTIME = 6;

export default function Home() {
  const reader = dataset();
  const tutte = reader.publishedAnomalies();
  const manifest = reader.data.manifest;
  const contatore = reader.counter();

  /* Il conteggio parte dalle sole segnalazioni di `rinvio-ad-atto-abrogato` e
     prende **solo il primo URN**, che è l'atto che rinvia. Contare tutti gli
     URN di tutte le segnalazioni gonfiava la cifra con gli atti bersaglio, che
     sono per definizione abrogati: la frase diceva «atti tuttora in vigore» e
     fra quegli atti ce n'erano di cancellati. */
  const rinviiAdAbrogato = tutte.filter((a) => a.checkId === 'rinvio-ad-atto-abrogato');
  const attiColpiti = new Set(
    rinviiAdAbrogato.map((a) => (a.urns[0] ? urnAtto(a.urns[0]) : '')).filter((u) => u !== ''),
  ).size;
  const annoPiuVecchio = rinviiAdAbrogato.reduce((max, a) => {
    const m = /abrogato da (\d+) anni/.exec(a.title);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  /* La divisione si fa solo dove ha un senso. Con zero mandati non esiste una
     media, e `0 / 0` produrrebbe un `NaN` che prima o poi qualcuno stampa. */
  const anniMediPerMandato =
    contatore && contatore.mandates > 0
      ? Math.round((contatore.totalDaysLate / contatore.mandates / 365.25) * 10) / 10
      : null;

  /* Le cifre si costruiscono una per una e solo se il dataset le sostiene: una
     casella vuota è meglio di una casella con dentro zero, che si legge come
     un'informazione e non lo è. */
  const cifre: CifraForte[] = [];
  if (attiColpiti > 0) {
    cifre.push({
      valore: numero(attiColpiti),
      unita: attiColpiti === 1 ? 'atto' : 'atti',
      frase: 'ancora in vigore rinviano a una legge che è stata cancellata',
      href: '/numeri#rinvii',
    });
  }
  if (annoPiuVecchio > 0) {
    cifre.push({
      valore: numero(annoPiuVecchio),
      unita: annoPiuVecchio === 1 ? 'anno' : 'anni',
      frase: 'fa è stata cancellata la legge più vecchia che qualcuno continua a citare',
      href: '/numeri#richiamata',
    });
  }
  if (contatore && contatore.mandates > 0) {
    cifre.push({
      valore: numero(contatore.mandates),
      frase: 'provvedimenti promessi da una legge hanno il termine scaduto',
      href: '/numeri#ritardo',
    });
  }
  if (anniMediPerMandato !== null) {
    cifre.push({
      valore: numeroDecimale(anniMediPerMandato),
      unita: 'anni',
      frase: 'è il ritardo medio su quei termini, contato dal giorno della scadenza',
      href: '/dati',
    });
  }

  /* «Le ultime trovate» è un'informazione diversa da «le più gravi»: dice che
     il sito è vivo e che il corpus si allarga. L'ordine primario è la data in
     cui la segnalazione è comparsa; a parità — e oggi sono tutte della stessa
     corsa — decide la norma più recente, che è comunque la più utile da
     vedere per prima. */
  const ultime = [...tutte]
    .sort(
      (a, b) =>
        b.firstSeenAt.localeCompare(a.firstSeenAt) ||
        (b.windowFrom ?? '').localeCompare(a.windowFrom ?? ''),
    )
    .slice(0, QUANTE_ULTIME);

  return (
    <div className="contenitore">
      <section className="apertura-forte">
        <h1>Le leggi che non tornano</h1>
        <p className="apertura-forte__riga">
          Leggiamo i testi ufficiali della legge italiana e pubblichiamo i punti in cui non tornano.
        </p>

        <CifreForti
          cifre={cifre}
          didascalia="Le cifre che riassumono cosa è stato trovato finora"
        />
      </section>

      {ultime.length > 0 ? (
        <section className="sezione" aria-labelledby="ultime-titolo">
          <h2 id="ultime-titolo" className="sezione__titolo">
            Le ultime che abbiamo trovato
          </h2>
          <ol className="elenco">
            {ultime.map((a) => (
              <li key={a.id} className="scheda">
                <h3 className="scheda__titolo">
                  <Link href={percorsoAnomalia(a.id)}>{a.title}</Link>
                </h3>
                {/* «Cosa succede in pratica» viene prima di qualsiasi riferimento
                    normativo: chi arriva qui da un link non deve conoscere gli
                    URN per capire di cosa si tratta. */}
                <p className="scheda__pratica">{a.plainLanguage}</p>
                <p className="scheda__meta">
                  <span className={classeGravita(a.severity)}>gravità {a.severity}</span>
                  <span>{livello(a.level)}</span>
                  {a.windowFrom ? <span>dal {data(a.windowFrom)}</span> : null}
                  {a.urns[0] ? (
                    <Link href={percorsoNorma(urnAtto(a.urns[0]))}>Leggi la norma</Link>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>

          <p className="azioni">
            <Link className="bottone bottone--primario" href="/segnalazioni">
              Tutte le {numero(tutte.length)} segnalazioni
            </Link>
            <Link className="bottone" href="/grafo">
              La mappa delle leggi
            </Link>
          </p>
        </section>
      ) : (
        <div className="niente-segnale">
          <h2>Nessuna segnalazione pubblicata</h2>
          <p>
            Sul corpus attualmente ingerito nessun controllo ha prodotto segnalazioni che superino
            la soglia di pubblicazione. <Link href="/dati">La pagina Dati</Link> dice quali
            controlli girano, su quanti atti e con quale precisione misurata.
          </p>
        </div>
      )}

      {manifest ? (
        <p className="riga-corpus">
          Su un corpus di {numero(manifest.counts.acts)} atti e {numero(manifest.counts.relations)}{' '}
          relazioni fra norme, aggiornato al {data(manifest.generatedAt.slice(0, 10))}. Ogni
          segnalazione mostra i testi originali, la regola che l’ha trovata e i suoi limiti:{' '}
          <Link href="/dati">dati e precisione di ogni controllo</Link>.
        </p>
      ) : null}
    </div>
  );
}
