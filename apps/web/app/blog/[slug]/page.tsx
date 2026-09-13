import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { checkById } from '@leggichenontornano/engine';
import { articolo, articoli, type Sezione } from '@/lib/blog';
import { REPO_URL, SITE_URL, dataset } from '@/lib/dataset';
import {
  bloccoDatiStrutturati,
  datiStrutturatiArticolo,
  datiStrutturatiBriciole,
  metadatiPagina,
} from '@/lib/seo';
import { Condivisione } from '@/components/condivisione';
import { Tabella } from '@/components/tabella';
import {
  classeGravita,
  data,
  finestra,
  livello,
  nomeNorma,
  percentuale,
  percorsoAnomalia,
  percorsoNorma,
  urnAtto,
} from '@/lib/testo';

/*
 * Un approfondimento.
 *
 * La pagina ha due metà, e la divisione è il punto.
 *
 * **Sopra** c'è l'articolo: prosa, leggibile da chiunque, scritta da un modello
 * a partire dalla sola scheda dei fatti e rifiutata in automatico se contiene
 * una cifra o una citazione che la scheda non sostiene (ADR 0010).
 *
 * **Sotto** c'è il dossier: URN, date, versioni, la query che ha prodotto la
 * segnalazione, la precisione misurata del controllo. Non è scritto da
 * nessuno — è assemblato dal dataset al momento della generazione, e per
 * costruzione non può divergere dalla scheda.
 *
 * Chi arriva da un link condiviso legge la prima metà e ha capito. Chi deve
 * usare la cosa per lavoro scorre alla seconda e trova tutto quello che gli
 * serve per rifare il conto da sé.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return articoli().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = articolo(slug);
  if (!a) return { title: 'Approfondimento non trovato', robots: { index: false, follow: true } };
  return metadatiPagina({
    titolo: a.titolo,
    descrizione: a.sommario,
    percorso: `/blog/${a.slug}`,
    tipo: 'article',
  });
}

export default async function Approfondimento({ params }: Props) {
  const { slug } = await params;
  const a = articolo(slug);
  if (!a) notFound();

  const reader = dataset();
  const segnalazione = reader.anomaly(a.anomaliaId);
  const controllo = segnalazione ? checkById(segnalazione.checkId) : null;
  const metrica = segnalazione ? reader.metric(segnalazione.checkId) : null;
  const url = `${SITE_URL}/blog/${a.slug}`;

  const atti = segnalazione
    ? [...new Set(segnalazione.urns.map((u) => urnAtto(u)))].map((urn) => ({
        urn,
        act: reader.act(urn),
      }))
    : [];

  return (
    <article className="contenitore">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON serializzato da noi, non da input
        dangerouslySetInnerHTML={{
          __html: datiStrutturatiArticolo({
            titolo: a.titolo,
            descrizione: a.sommario,
            percorso: `/blog/${a.slug}`,
            pubblicatoIl: a.data,
            ...(a.modello ? { autoreMacchina: a.modello } : {}),
          }),
        }}
      />

      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiBriciole([
            { nome: 'Approfondimenti', percorso: '/blog' },
            { nome: a.titolo, percorso: `/blog/${a.slug}` },
          ]),
        )}
      />
      <nav aria-label="Percorso" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>
        <Link href="/blog">Approfondimenti</Link> <span aria-hidden="true">›</span>{' '}
        <span>{data(a.data)}</span>
      </nav>

      <h1>{a.titolo}</h1>
      <p className="apertura">{a.sommario}</p>

      {/* La firma sta in alto, prima del testo, non in fondo. Chi legge deve
          sapere *prima* chi ha scritto le parole che sta per leggere. */}
      <p className="firma">
        {a.modello ? (
          <>
            Le parole di questo articolo sono scritte da un modello linguistico a partire{' '}
            <strong>solo</strong> dai fatti della segnalazione, e un controllo automatico rifiuta
            l’articolo se contiene una cifra o una citazione che quei fatti non sostengono. I fatti
            vengono dal dataset; le parole no.{' '}
            <Link href="/come-funziona">Come funziona, per esteso</Link>.
          </>
        ) : (
          <>Questo articolo è scritto da una persona, a partire dai fatti della segnalazione.</>
        )}
      </p>

      {a.sezioni.map((s: Sezione) => (
        <section className="sezione" key={s.titolo} aria-labelledby={`s-${s.titolo}`}>
          <h2 id={`s-${s.titolo}`} className="sezione__titolo">
            {s.titolo}
          </h2>
          {s.paragrafi.map((p: string) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </section>
      ))}

      <Condivisione url={url} titolo={a.titolo} />

      {/* ---------- Il dossier: non scritto, assemblato ---------- */}
      {segnalazione ? (
        <section className="sezione dossier" aria-labelledby="dossier">
          <h2 id="dossier" className="sezione__titolo">
            Il dossier
          </h2>
          <p>
            Da qui in giù non scrive nessuno: sono i campi del dataset, messi in fila. Servono a chi
            questa cosa la deve usare per lavoro, e a chiunque voglia rifare il conto da sé.
          </p>

          <h3>La segnalazione</h3>
          <p className="scheda__meta">
            <span className={classeGravita(segnalazione.severity)}>
              gravità {segnalazione.severity}
            </span>
            <span>{livello(segnalazione.level)}</span>
            <Link href={percorsoAnomalia(segnalazione.id)}>Apri la scheda completa</Link>
          </p>
          <p>{segnalazione.plainLanguage}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--inchiostro-tenue)' }}>
            Periodo: {finestra(segnalazione.windowFrom, segnalazione.windowTo)}.
          </p>

          {atti.length > 0 ? (
            <>
              <h3>Le norme coinvolte</h3>
              <Tabella didascalia="Gli atti citati dalla segnalazione, con lo stato di vigenza.">
                <thead>
                  <tr>
                    <th scope="col">Atto</th>
                    <th scope="col">Stato</th>
                    <th scope="col">Versioni</th>
                  </tr>
                </thead>
                <tbody>
                  {atti.map(({ urn, act }) => (
                    <tr key={urn}>
                      <th scope="row">
                        <Link href={percorsoNorma(urn)}>{nomeNorma(urn)}</Link>
                      </th>
                      <td>
                        {act?.abrogated
                          ? `Abrogato${act.abrogatedFrom ? ` dal ${data(act.abrogatedFrom)}` : ''}`
                          : 'In vigore'}
                      </td>
                      <td>{act?.versionCount ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabella>
            </>
          ) : null}

          {controllo ? (
            <>
              <h3>La regola che l’ha trovata</h3>
              <p>
                {controllo.description} {metrica ? metrica.reason : null}{' '}
                {metrica && metrica.precision !== null ? (
                  <>Precisione misurata: {percentuale(metrica.precision)}.</>
                ) : (
                  <>La precisione di questo controllo non è ancora misurata.</>
                )}{' '}
                <Link href={`/controllo/${controllo.id}`}>La pagina del controllo</Link>.
              </p>
              <pre className="regola" tabIndex={0} role="region" aria-label="La regola, come query">
                <code>{segnalazione.rule}</code>
              </pre>
            </>
          ) : null}

          <h3>Se pensate che sia sbagliata</h3>
          <p>
            È il contributo più utile che esista, e non richiede né titoli né codice.{' '}
            <a
              href={`${REPO_URL}/issues/new?title=${encodeURIComponent(`Non è un conflitto: ${segnalazione.id}`)}&labels=${encodeURIComponent('non-e-un-conflitto')}`}
            >
              Aprite una issue
            </a>
            : le risposte cambiano la precisione misurata del controllo, e possono toglierlo dal
            sito.
          </p>
        </section>
      ) : null}
    </article>
  );
}
