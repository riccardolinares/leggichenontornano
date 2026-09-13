import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CHECK_DEFINITIONS, THRESHOLD, checkById } from '@leggichenontornano/engine';
import { dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import {
  classeGravita,
  data,
  livello,
  numero,
  percentuale,
  percorsoAnomalia,
  percorsoNorma,
  urnAtto,
} from '@/lib/testo';

/*
 * Una pagina per controllo.
 *
 * Sulla home il tipo di controllo è un filtro, `?tipo=…`, e va bene per chi sta
 * già guardando l'indice. Ma «rinvio a una norma abrogata» è la cosa che
 * qualcuno cerca *prima* di sapere che questo sito esiste, e un parametro non è
 * una pagina: non ha un titolo suo, non si cita, e un motore di ricerca lo
 * tratta come una copia della home.
 *
 * Qui invece c'è tutto quello che serve per fidarsi o non fidarsi di un
 * controllo: cosa cerca, la query che lo fa, quante volte ha trovato qualcosa,
 * con quanta precisione misurata, e l'elenco completo.
 */

export const dynamic = 'force-static';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return CHECK_DEFINITIONS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const controllo = checkById(id);
  if (!controllo) return { title: 'Controllo non trovato', robots: { index: false, follow: true } };

  const reader = dataset();
  const trovate = reader.publishedAnomalies().filter((a) => a.checkId === id).length;

  return metadatiPagina({
    titolo: controllo.label,
    descrizione: `${controllo.description} ${
      trovate > 0
        ? `${trovate} segnalazion${trovate === 1 ? 'e' : 'i'} pubblicat${trovate === 1 ? 'a' : 'e'} sul corpus ingerito.`
        : 'Nessuna segnalazione pubblicata sul corpus ingerito.'
    }`,
    percorso: `/controllo/${id}`,
  });
}

export default async function PaginaControllo({ params }: Props) {
  const { id } = await params;
  const controllo = checkById(id);
  if (!controllo) notFound();

  const reader = dataset();
  const metrica = reader.metric(id);
  const segnalazioni = reader.publishedAnomalies().filter((a) => a.checkId === id);
  const inCoda = reader.data.anomalies.filter((a) => a.checkId === id && !a.published).length;

  return (
    <div className="contenitore">
      <nav aria-label="Percorso" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>
        <Link href="/">Segnalazioni</Link> <span aria-hidden="true">›</span>{' '}
        <span>{controllo.label}</span>
      </nav>

      <h1>{controllo.label}</h1>
      <p className="apertura">{controllo.description}</p>

      <p className="riga-corpus">
        {livello(controllo.level)}.{' '}
        {controllo.deterministic
          ? 'Attraversamento del grafo: nessuna estrazione, nessun modello.'
          : 'Richiede un’estrazione dal testo, e l’estrazione può sbagliare.'}{' '}
        Precisione attesa: {controllo.expectedPrecision}.
      </p>

      <section className="sezione" aria-labelledby="misura">
        <h2 id="misura" className="sezione__titolo">
          Quanto è affidabile
        </h2>
        {metrica ? (
          <p>
            Ha prodotto <strong>{numero(metrica.found)}</strong> segnalazion
            {metrica.found === 1 ? 'e' : 'i'} sul corpus ingerito.{' '}
            {metrica.reviewed > 0
              ? `Ne sono state riviste a mano ${numero(metrica.reviewed)}, di cui ${numero(metrica.confirmed)} confermate: precisione misurata ${percentuale(metrica.precision)}.`
              : 'Nessuna revisione umana registrata: la precisione non è misurata.'}{' '}
            {metrica.reason}
          </p>
        ) : (
          <p>Questo controllo non ha ancora una misura registrata.</p>
        )}
        <p style={{ fontSize: '0.92rem', color: 'var(--inchiostro-tenue)' }}>
          La soglia di pubblicazione è {percentuale(THRESHOLD.minPrecision)} di precisione su almeno{' '}
          {numero(THRESHOLD.minSample)} revisioni.{' '}
          <Link href="/dati">Le misure di tutti i controlli</Link>.
        </p>
      </section>

      <section className="sezione" aria-labelledby="regola">
        <h2 id="regola" className="sezione__titolo">
          La regola, per intero
        </h2>
        <p>
          Non è una parafrasi: è la query. Chi scarica il dataset può rieseguirla e ottenere le
          stesse righe.
        </p>
        {/* `tabIndex` e `role` non sono decorazione: il blocco scorre in
            orizzontale su uno schermo stretto, e una zona che scorre e non
            riceve il fuoco è irraggiungibile da tastiera. Con il ruolo serve
            anche un nome, altrimenti chi ci arriva sente «regione» e basta. */}
        <pre className="regola" tabIndex={0} role="region" aria-label="La regola, come query">
          <code>{controllo.rule}</code>
        </pre>
      </section>

      <section className="sezione" aria-labelledby="elenco">
        <h2 id="elenco" className="sezione__titolo">
          {segnalazioni.length > 0
            ? `Le ${numero(segnalazioni.length)} segnalazioni pubblicate`
            : 'Nessuna segnalazione pubblicata'}
        </h2>

        {segnalazioni.length === 0 ? (
          <p>
            <strong>Assenza di segnale non significa norma coerente.</strong>{' '}
            {inCoda > 0
              ? `Questo controllo ha ${numero(inCoda)} segnalazion${inCoda === 1 ? 'e' : 'i'} nella coda interna, che non pubblichiamo perché la precisione non è ancora misurata o è sotto la soglia.`
              : 'Sulla porzione di corpus che abbiamo, questo controllo non ha trovato nulla.'}
          </p>
        ) : (
          <ol className="elenco">
            {segnalazioni.map((a) => (
              <li key={a.id} className="scheda">
                <h3 className="scheda__titolo">
                  <Link href={percorsoAnomalia(a.id)}>{a.title}</Link>
                </h3>
                <p className="scheda__pratica">{a.plainLanguage}</p>
                <p className="scheda__meta">
                  <span className={classeGravita(a.severity)}>gravità {a.severity}</span>
                  {a.windowFrom ? <span>dal {data(a.windowFrom)}</span> : null}
                  {a.urns[0] ? (
                    <Link href={percorsoNorma(urnAtto(a.urns[0]))}>Leggi la norma</Link>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
