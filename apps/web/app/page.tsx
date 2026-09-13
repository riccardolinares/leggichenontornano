import Link from 'next/link';
import { CHECK_DEFINITIONS } from '@antinomia/engine';
import { Tabella } from '@/components/tabella';
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
 * Niente `force-static` qui.
 *
 * Con la generazione statica forzata i `searchParams` arrivano sempre vuoti, e
 * il filtro per tipo di controllo smette silenziosamente di funzionare: l'URL
 * cambia, la pagina no. Verificato sul sito costruito, non dedotto — è il tipo
 * di guasto che nessuno nota finché qualcuno non manda un link filtrato.
 *
 * La pagina resta economica: legge un file JSONL già in memoria.
 */

/* Il canonical è `/` anche quando l'URL porta `?tipo=`: il filtro mostra un
   sottoinsieme dello stesso indice, e senza canonical ogni filtro diventerebbe
   una pagina concorrente della home. Il posto indicizzabile per un singolo
   controllo è la sua pagina, `/controllo/<id>`, non un parametro. */
export const metadata = metadatiPagina({
  titolo: 'Le leggi che non tornano',
  descrizione:
    'Indice delle incongruenze rilevate nella legislazione italiana, con le prove e la regola che le ha trovate.',
  percorso: '/',
});

interface Props {
  searchParams: Promise<{ tipo?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { tipo } = await searchParams;
  const reader = dataset();
  const tutte = reader.publishedAnomalies();
  const anomalie = tipo ? tutte.filter((a) => a.checkId === tipo) : tutte;

  const perTipo = new Map<string, number>();
  for (const a of tutte) perTipo.set(a.checkId, (perTipo.get(a.checkId) ?? 0) + 1);

  const manifest = reader.data.manifest;
  const metriche = reader.data.metrics;
  const sottoSoglia = metriche.filter((m) => !m.published && m.found > 0);
  const contatore = reader.counter();

  /* I numeri dell'apertura, ricavati dal dataset a ogni generazione.
     Scriverli a mano sarebbe più semplice e sarebbe il modo più rapido di
     ritrovarsi una cifra falsa sulla home il giorno in cui il corpus cambia.

     Il conteggio parte dalle sole segnalazioni di `rinvio-ad-atto-abrogato` e
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

  return (
    <div className="contenitore">
      {/* La home apre con una frase, non con un cruscotto. I numeri ci sono, e
          sono i più duri che abbiamo, ma stanno **dentro le frasi**: una griglia
          di metriche si guarda e non si legge, e il piano la esclude.

          Tutti i numeri qui sotto sono calcolati dal dataset, non scritti a
          mano. Se il corpus cambia, cambiano — ed è l'unico modo perché una
          cifra sulla home resti vera. */}
      <h1>Le leggi che non tornano</h1>
      <p className="apertura">
        <strong className="cifra">{numero(tutte.length)}</strong> punti in cui la legislazione
        italiana non torna: atti ancora in vigore che rinviano a leggi cancellate, modifiche a norme
        che non esistono più, adempimenti con due termini diversi per la stessa cosa. Ogni
        segnalazione mostra i testi originali, la regola che l’ha trovata e i suoi limiti.
      </p>

      {/* Il colpo che fa notizia, e che regge: sono atti di oggi, non reperti. */}
      {attiColpiti > 0 && annoPiuVecchio > 0 ? (
        <p className="colpo">
          <strong>{numero(attiColpiti)} atti tuttora in vigore</strong> rinviano a una norma che è
          stata abrogata. Il rinvio più vecchio punta a una legge cancellata{' '}
          <strong>{annoPiuVecchio} anni fa</strong>: chi la applica oggi deve ricostruire da sé
          quale disciplina si sia messa al suo posto.
        </p>
      ) : null}

      {contatore && anniMediPerMandato !== null ? (
        <p className="colpo">
          <strong>{numero(contatore.mandates)} provvedimenti attuativi</strong> promessi da una
          legge hanno un termine scaduto: in media da{' '}
          <strong>{numeroDecimale(anniMediPerMandato)} anni</strong>.{' '}
          <Link href="/dati">Cosa misura davvero questo numero</Link> — misura termini scaduti, non
          attuazioni mancate, e la differenza conta.
        </p>
      ) : null}

      {manifest ? (
        <p className="riga-corpus">
          Su un corpus di {numero(manifest.counts.acts)} atti e {numero(manifest.counts.relations)}{' '}
          relazioni fra norme, aggiornato al {data(manifest.generatedAt.slice(0, 10))}.{' '}
          <Link href="/dati">Dati e precisione di ogni controllo</Link>.
        </p>
      ) : null}

      <h2 id="filtri-titolo" className="solo-lettori-schermo">
        Filtra per tipo di controllo
      </h2>
      <ul className="filtri" aria-labelledby="filtri-titolo">
        <li>
          <Link className="filtro" href="/" aria-current={!tipo ? 'true' : undefined}>
            Tutte ({tutte.length})
          </Link>
        </li>
        {CHECK_DEFINITIONS.filter((c) => (perTipo.get(c.id) ?? 0) > 0).map((c) => (
          <li key={c.id}>
            <Link
              className="filtro"
              href={`/?tipo=${c.id}`}
              aria-current={tipo === c.id ? 'true' : undefined}
            >
              {c.label} ({perTipo.get(c.id)})
            </Link>
          </li>
        ))}
      </ul>

      {anomalie.length === 0 ? (
        <div className="niente-segnale">
          <h2>Nessuna segnalazione pubblicata{tipo ? ' per questo filtro' : ''}</h2>
          <p>
            {tipo
              ? 'Nessun controllo di questo tipo ha prodotto segnalazioni pubblicabili sul corpus attualmente ingerito.'
              : 'Sul corpus attualmente ingerito nessun controllo ha prodotto segnalazioni che superino la soglia di pubblicazione.'}
          </p>
          <p>
            <strong>Assenza di segnale non significa norma coerente.</strong> Significa che i
            controlli attivi, sulla porzione di corpus che abbiamo, non hanno trovato nulla.{' '}
            <Link href="/dati">La pagina Dati</Link> dice esattamente quali controlli girano, su
            quanti atti e con quale precisione misurata.
          </p>
        </div>
      ) : (
        <>
          {/* «Assenza di segnale ≠ norma coerente» va detto sempre, non solo
              quando l'indice è vuoto: è quando l'indice è pieno che il lettore
              rischia di leggerlo come una mappa completa. */}
          <p
            style={{
              fontSize: '0.92rem',
              color: 'var(--inchiostro-tenue)',
              borderLeft: '3px solid var(--ocra)',
              paddingLeft: '0.9rem',
              maxWidth: '46rem',
            }}
          >
            <strong>Assenza di segnale non significa norma coerente.</strong> Questo indice contiene
            quello che i controlli attivi hanno trovato sulla porzione di corpus che abbiamo
            ingerito. Una norma che non compare qui non è per questo in ordine.
          </p>
          <ol className="elenco">
            {anomalie.map((a) => (
              <li key={a.id} className="scheda">
                <h2 className="scheda__titolo">
                  <Link href={percorsoAnomalia(a.id)}>{a.title}</Link>
                </h2>
                {/* «Cosa succede in pratica» viene prima di qualsiasi riferimento
                  normativo: chi arriva qui da un link non deve conoscere gli URN
                  per capire di cosa si tratta. */}
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
        </>
      )}

      {sottoSoglia.length > 0 ? (
        <section className="sezione" aria-labelledby="coda-titolo">
          <h2 id="coda-titolo" className="sezione__titolo">
            Cosa non stiamo pubblicando
          </h2>
          <p>
            Questi controlli hanno prodotto segnalazioni che restano nella coda interna, perché la
            loro precisione non è ancora misurata o è sotto la soglia dell’85%. Le contiamo qui
            perché tacerle sarebbe meno onesto che dichiararle.
          </p>
          <Tabella didascalia="Controlli le cui segnalazioni non compaiono nell’indice, con il motivo.">
            <thead>
              <tr>
                <th scope="col">Controllo</th>
                <th scope="col">In coda</th>
                <th scope="col">Perché non è pubblicato</th>
              </tr>
            </thead>
            <tbody>
              {sottoSoglia.map((m) => (
                <tr key={m.checkId}>
                  <th scope="row">{m.label}</th>
                  <td>{numero(m.found)}</td>
                  <td>{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </Tabella>
        </section>
      ) : null}
    </div>
  );
}
