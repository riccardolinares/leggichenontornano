import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { checkById } from '@antinomia/engine';
import { Condivisione } from '@/components/condivisione';
import { BarraVigenze, type Finestra } from '@/components/vigenze';
import { REPO_URL, SITE_URL, dataset } from '@/lib/dataset';
import {
  articoloDi,
  classeGravita,
  data,
  livello,
  nomeNorma,
  percorsoNorma,
  urnAtto,
} from '@/lib/testo';
import { Tabella } from '@/components/tabella';

export const dynamic = 'force-static';

interface Prova {
  urn: string;
  label: string;
  quote: string;
  inForceFrom?: string | null;
  inForceTo?: string | null;
  kind: string;
}

interface Risoluzione {
  criterion: string;
  status: string;
  explanation: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

/** Ogni anomalia pubblicata è una pagina statica con un URL stabile. */
export async function generateStaticParams() {
  return dataset()
    .publishedAnomalies()
    .map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const anomalia = dataset().anomaly(decodeURIComponent(id));
  if (!anomalia?.published) return { title: 'Segnalazione non trovata' };
  const url = `${SITE_URL}/anomalia/${encodeURIComponent(anomalia.id)}`;
  return {
    title: anomalia.title,
    description: anomalia.plainLanguage,
    alternates: { canonical: url },
    openGraph: {
      title: anomalia.title,
      description: anomalia.plainLanguage,
      url,
      type: 'article',
      images: [
        {
          url: `/anomalia/${encodeURIComponent(anomalia.id)}/opengraph-image`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: anomalia.title,
      description: anomalia.plainLanguage,
    },
  };
}

export default async function SchedaAnomalia({ params }: Props) {
  const { id } = await params;
  const reader = dataset();
  const anomalia = reader.anomaly(decodeURIComponent(id));
  if (!anomalia || !anomalia.published) notFound();

  const controllo = checkById(anomalia.checkId);
  const prove = (anomalia.evidence ?? []) as Prova[];
  const risoluzioni = (anomalia.resolutions ?? []) as Risoluzione[];
  const url = `${SITE_URL}/anomalia/${encodeURIComponent(anomalia.id)}`;

  const finestre: Finestra[] = anomalia.urns.slice(0, 2).map((urn, i) => {
    const atto = reader.act(urnAtto(urn));
    const versioni = reader.versions(urnAtto(urn));
    return {
      etichetta: `Norma ${i + 1}`,
      da: versioni[0]?.inForceFrom ?? atto?.publicationDate ?? null,
      a: versioni.at(-1)?.inForceTo ?? null,
    };
  });

  const titoloIssue = `Non è un conflitto: ${anomalia.id}`;
  const corpoIssue = [
    `Segnalazione: ${url}`,
    `Controllo: ${anomalia.checkId}`,
    '',
    '## Perché non è un conflitto',
    '',
    '(descrivi qui il motivo: rinvio recettizio, norma speciale, delegificazione autorizzata, errore di estrazione, altro)',
    '',
    '## Riferimenti',
    '',
    ...anomalia.urns.map((u) => `- ${u}`),
  ].join('\n');
  const linkIssue = `${REPO_URL}/issues/new?title=${encodeURIComponent(titoloIssue)}&body=${encodeURIComponent(corpoIssue)}&labels=${encodeURIComponent('non-e-un-conflitto')}`;

  return (
    <article className="contenitore">
      <nav aria-label="Percorso" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>
        <Link href="/">Segnalazioni</Link> <span aria-hidden="true">›</span>{' '}
        <span>{controllo?.label ?? anomalia.checkId}</span>
      </nav>

      <header className="anomalia__intestazione">
        <p className="scheda__meta" style={{ marginBottom: '0.8rem' }}>
          <span className={classeGravita(anomalia.severity)}>{anomalia.severity}</span>
          <span>{livello(anomalia.level)}</span>
          <span className="mono">{anomalia.id}</span>
        </p>
        <h1 className="anomalia__titolo">{anomalia.title}</h1>
      </header>

      {/* 1. Spiegazione in lingua comune, prima di qualunque riferimento tecnico. */}
      <section aria-labelledby="pratica-titolo">
        <h2 id="pratica-titolo" className="sezione__titolo">
          Cosa succede in pratica
        </h2>
        <p className="pratica">{anomalia.plainLanguage}</p>
      </section>

      {/* 2. I testi originali, sopra ai campi estratti: l'utente verifica
             l'estrazione prima di valutare il verdetto. */}
      <section className="sezione" aria-labelledby="prove-titolo">
        <h2 id="prove-titolo" className="sezione__titolo">
          I testi, come li abbiamo letti
        </h2>
        <div className="affiancati">
          {prove.map((prova, i) => (
            <div className="prova" key={`${prova.urn}-${i}`}>
              <p className="prova__etichetta">{prova.label}</p>
              <p className="prova__testo">{prova.quote}</p>
              <span className="prova__urn">
                {prova.urn}
                {prova.inForceFrom ? ` · dal ${data(prova.inForceFrom)}` : ''}
              </span>
              <p style={{ margin: '0.8rem 0 0', fontSize: '0.85rem' }}>
                <Link href={percorsoNorma(urnAtto(prova.urn))}>
                  Apri il testo completo della norma
                </Link>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Le finestre di vigenza, con l'intersezione evidenziata. */}
      {finestre.some((f) => f.da) ? (
        <section className="sezione" aria-labelledby="vigenze-titolo">
          <h2 id="vigenze-titolo" className="sezione__titolo">
            Quando erano in vigore
          </h2>
          <BarraVigenze
            finestre={finestre}
            intersezione={
              anomalia.windowFrom ? { da: anomalia.windowFrom, a: anomalia.windowTo } : null
            }
          />
        </section>
      ) : null}

      {/* 4. La riga «possibile risoluzione» compare sempre, anche quando dice
             che nessun criterio si applica. */}
      <section className="sezione" aria-labelledby="risoluzione-titolo">
        <h2 id="risoluzione-titolo" className="sezione__titolo">
          C’è una spiegazione?
        </h2>
        <p>
          I criteri classici di risoluzione delle antinomie — specialità, posteriorità, gerarchia —
          non sono automatismi: qui diciamo soltanto se sono <em>astrattamente</em> invocabili fra i
          due atti coinvolti. La valutazione resta a chi legge.
        </p>
        <ul className="risoluzioni">
          {risoluzioni.map((r, i) => (
            <li className="risoluzione" key={`${r.criterion}-${i}`}>
              <span>
                <span className="risoluzione__criterio">
                  {r.criterion === 'nessuno' ? 'Avvertenza' : r.criterion}
                </span>
                <br />
                <span className="risoluzione__stato">{r.status.replace(/-/g, ' ')}</span>
              </span>
              <span>{r.explanation}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Il dettaglio tecnico, con la regola in chiaro. */}
      <section className="sezione" aria-labelledby="tecnico-titolo">
        <h2 id="tecnico-titolo" className="sezione__titolo">
          Dettaglio tecnico
        </h2>

        <details>
          <summary>La regola che ha prodotto questa segnalazione</summary>
          <p>
            Non è una parafrasi: è la regola stessa, serializzata. Nessun modello linguistico ha
            deciso che queste due norme sono in conflitto; il conflitto è il risultato di questa
            interrogazione.
          </p>
          <code className="regola">{anomalia.rule}</code>
          {controllo ? (
            <p style={{ fontSize: '0.9rem' }}>
              Precisione attesa per questo tipo di controllo: {controllo.expectedPrecision}.{' '}
              <Link href="/dati">Precisione misurata e soglia di pubblicazione</Link>.
            </p>
          ) : null}
        </details>

        <details>
          <summary>Norme coinvolte e identificatori</summary>
          <Tabella didascalia="Gli URN:NIR citati da questa segnalazione.">
            <thead>
              <tr>
                <th scope="col">Norma</th>
                <th scope="col">URN:NIR</th>
                <th scope="col">Testo</th>
              </tr>
            </thead>
            <tbody>
              {anomalia.urns.map((urn) => {
                const articolo = articoloDi(urn);
                return (
                  <tr key={urn}>
                    <th scope="row">
                      {nomeNorma(urn)}
                      {articolo ? `, art. ${articolo}` : ''}
                    </th>
                    <td className="mono" style={{ wordBreak: 'break-all' }}>
                      {urn}
                    </td>
                    <td>
                      <Link href={percorsoNorma(urnAtto(urn))}>Apri</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabella>
        </details>
      </section>

      {/* 6. Condivisione e contraddittorio. */}
      <section className="sezione" aria-labelledby="azioni-titolo">
        <h2 id="azioni-titolo" className="sezione__titolo">
          Condividi, o dinne che è sbagliata
        </h2>
        <Condivisione url={url} titolo={anomalia.title} />

        <div className="niente-segnale" style={{ marginTop: '1.8rem' }}>
          <h3 style={{ marginTop: 0 }}>Non è un conflitto?</h3>
          <p>
            Se ritieni che questa segnalazione sia infondata — rinvio recettizio, norma speciale,
            delegificazione autorizzata, o un errore nostro nella lettura del testo — dillo. Si apre
            una issue pubblica, senza registrarsi. Le risposte diventano il nostro gold standard e
            cambiano la precisione misurata di questo controllo.
          </p>
          <p>
            <a className="bottone bottone--primario" href={linkIssue} rel="noopener">
              Non è un conflitto
            </a>
          </p>
        </div>
      </section>
    </article>
  );
}
