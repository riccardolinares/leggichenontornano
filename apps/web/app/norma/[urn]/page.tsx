import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EgoNetwork } from '@/components/ego-network';
import { dataset } from '@/lib/dataset';
import {
  classeGravita,
  data,
  finestra,
  nomeNorma,
  numero,
  percorsoAnomalia,
  percorsoNorma,
} from '@/lib/testo';
import { Tabella } from '@/components/tabella';

/*
 * Anche qui niente `force-static`: `?v=` sceglie la data di vigenza e `?c=`
 * apre la modalità confronto, e con la generazione statica forzata entrambi
 * verrebbero ignorati. Gli URL sono il prodotto (ADR 0008): un parametro che
 * l'URL porta e la pagina non legge è peggio di un parametro che non esiste.
 */

interface Props {
  params: Promise<{ urn: string }>;
  searchParams: Promise<{ v?: string; c?: string; art?: string }>;
}

/**
 * Il lettore norma viene generato staticamente per gli atti coinvolti in una
 * segnalazione pubblicata: sono quelli che qualcuno raggiungerà davvero da un
 * link. Il resto del corpus resta raggiungibile, ma non si pregenera mezzo
 * milione di pagine per riempire una sitemap.
 */
export async function generateStaticParams() {
  const reader = dataset();
  const urns = new Set<string>();
  for (const a of reader.publishedAnomalies()) {
    for (const urn of a.urns) urns.add(urn.split('~')[0]!);
  }
  // Qualche atto in più perché il sito non sia vuoto quando non ci sono
  // segnalazioni: i primi per data di pubblicazione.
  for (const act of reader.data.acts.slice(0, 30)) urns.add(act.urn);
  return [...urns].map((urn) => ({ urn: encodeURIComponent(urn) }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { urn } = await params;
  const { v } = await searchParams;
  const decoded = decodeURIComponent(urn);
  const act = dataset().act(decoded);
  if (!act) return { title: 'Norma non presente nel corpus' };
  return {
    title: `${nomeNorma(decoded)}${v ? ` — testo vigente al ${data(v)}` : ''}`,
    description: act.title,
  };
}

export default async function LettoreNorma({ params, searchParams }: Props) {
  const { urn: urnGrezzo } = await params;
  const { v, c, art } = await searchParams;
  const urn = decodeURIComponent(urnGrezzo);
  const reader = dataset();
  const act = reader.act(urn);
  if (!act) notFound();

  const versioni = reader.versions(urn);
  const vigente = reader.versionAt(urn, v);
  const articoli = vigente ? reader.articles(vigente.id) : [];
  const principali = articoli.filter((a) => a.principal);
  const mostrati = art ? principali.filter((a) => a.number === art.toLowerCase()) : principali;
  const anomalie = reader.anomaliesFor(urn);
  const anomaliePerArticolo = new Map<string, typeof anomalie>();
  for (const a of anomalie) {
    for (const u of a.urns) {
      const m = /~art(\d+(?:-[a-z]+)?)/i.exec(u);
      if (!m || u.split('~')[0] !== urn) continue;
      const key = m[1]!.toLowerCase();
      const lista = anomaliePerArticolo.get(key);
      if (lista) lista.push(a);
      else anomaliePerArticolo.set(key, [a]);
    }
  }

  // Modalità confronto: è un parametro dello stesso URL, non una pagina separata.
  const confronto = c ? reader.versionAt(urn, c) : null;
  const articoliConfronto = confronto ? reader.articles(confronto.id) : [];
  const testoConfronto = new Map(articoliConfronto.map((a) => [a.number ?? '', a.text]));

  const ego = reader.egoNetwork(urn);

  return (
    <div className="contenitore">
      <nav aria-label="Percorso" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        <Link href="/">Segnalazioni</Link> <span aria-hidden="true">›</span>{' '}
        <span>Lettore norma</span>
      </nav>

      <h1>{nomeNorma(urn)}</h1>
      <p className="apertura">{act.title}</p>

      <p className="scheda__meta">
        <span className="mono" style={{ wordBreak: 'break-all' }}>
          {urn}
        </span>
        {act.publicationDate ? <span>pubblicata il {data(act.publicationDate)}</span> : null}
        {act.abrogated ? (
          <span className="etichetta etichetta--antinomia">
            abrogata{act.abrogatedFrom ? ` dal ${data(act.abrogatedFrom)}` : ''}
          </span>
        ) : null}
      </p>

      {/* Timeline multivigenza */}
      <section className="sezione" aria-labelledby="vigenze-titolo">
        <h2 id="vigenze-titolo" className="sezione__titolo">
          Versioni di questo atto ({numero(versioni.length)})
        </h2>
        {versioni.length === 0 ? (
          <p>Nessuna versione registrata.</p>
        ) : (
          <Tabella didascalia="Ogni riga è una versione consolidata dell’atto. Il collegamento apre il testo come era a quella data.">
            <thead>
              <tr>
                <th scope="col">Vigenza</th>
                <th scope="col">Testo</th>
                <th scope="col">Confronta con la versione mostrata</th>
              </tr>
            </thead>
            <tbody>
              {versioni.map((versione) => {
                const corrente = vigente?.id === versione.id;
                return (
                  <tr key={versione.id}>
                    <th scope="row">
                      {finestra(versione.inForceFrom, versione.inForceTo)}
                      {corrente ? (
                        <>
                          {' '}
                          <span className="etichetta etichetta--verificato">mostrata</span>
                        </>
                      ) : null}
                      {versione.dateConflict ? (
                        <>
                          <br />
                          <small style={{ color: 'var(--ocra)' }}>
                            Discordanza nella fonte: {versione.dateConflict}
                          </small>
                        </>
                      ) : null}
                    </th>
                    <td>
                      <Link href={percorsoNorma(urn, versione.inForceFrom)}>
                        Apri il testo al {data(versione.inForceFrom)}
                      </Link>
                    </td>
                    <td>
                      {corrente ? (
                        '—'
                      ) : (
                        <Link
                          href={`/norma/${encodeURIComponent(urn)}?v=${vigente?.inForceFrom ?? ''}&c=${versione.inForceFrom}`}
                        >
                          Confronta
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabella>
        )}
      </section>

      {/* Testo */}
      <section className="sezione" aria-labelledby="testo-titolo">
        <h2 id="testo-titolo" className="sezione__titolo">
          Testo {vigente ? `vigente ${finestra(vigente.inForceFrom, vigente.inForceTo)}` : ''}
          {confronto ? ` — confrontato con la versione del ${data(confronto.inForceFrom)}` : ''}
        </h2>

        {mostrati.length === 0 ? (
          <p>
            Non abbiamo il testo di questo atto a questa data.{' '}
            <Link href={percorsoNorma(urn)}>Torna al testo vigente oggi</Link>.
          </p>
        ) : (
          <div className="norma">
            {mostrati.slice(0, 400).map((articolo) => {
              const segnalazioni = anomaliePerArticolo.get(articolo.number ?? '') ?? [];
              const precedente = confronto ? testoConfronto.get(articolo.number ?? '') : undefined;
              const cambiato = precedente !== undefined && precedente !== articolo.text;
              return (
                <article
                  className="articolo"
                  key={articolo.id}
                  id={articolo.number ? `art${articolo.number}` : undefined}
                >
                  <p className="articolo__num">
                    {articolo.num ?? `Art. ${articolo.number}`}
                    {articolo.container ? ` — ${articolo.container}` : ''}
                  </p>
                  {articolo.heading ? (
                    <h3 className="articolo__rubrica">{articolo.heading}</h3>
                  ) : null}

                  {/* Le anomalie compaiono come annotazioni a margine, accanto
                      al testo, non come una lista separata da qualche altra parte. */}
                  {segnalazioni.map((a) => (
                    <aside className="margine" key={a.id}>
                      <span className={classeGravita(a.severity)}>segnalazione</span>{' '}
                      <Link href={percorsoAnomalia(a.id)}>{a.title}</Link>
                    </aside>
                  ))}

                  <p>{articolo.text}</p>

                  {confronto ? (
                    <div
                      className="prova"
                      style={{ marginTop: '0.8rem', borderLeft: '3px solid var(--bordo-forte)' }}
                    >
                      <p className="prova__etichetta">
                        Versione del {data(confronto.inForceFrom)}{' '}
                        {cambiato ? '— testo diverso' : '— testo identico'}
                      </p>
                      {cambiato ? (
                        <p className="prova__testo">{precedente ?? '(articolo non presente)'}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {articolo.number ? (
                    <p style={{ fontSize: '0.8rem', marginTop: '0.7rem' }}>
                      <Link
                        href={`/norma/${encodeURIComponent(urn)}?art=${articolo.number}${vigente ? `&v=${vigente.inForceFrom}` : ''}`}
                      >
                        Indirizzo citabile di questo articolo
                      </Link>
                    </p>
                  ) : null}
                </article>
              );
            })}
            {mostrati.length > 400 ? (
              <p style={{ marginTop: '1.5rem' }}>
                Mostrati i primi 400 articoli di {numero(mostrati.length)}. Usa il parametro{' '}
                <code>?art=</code> nell’indirizzo per aprirne uno preciso.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Ego-network deterministica, a profondità 1 */}
      {ego.edges.length > 0 ? (
        <section className="sezione" aria-labelledby="grafo-titolo">
          <h2 id="grafo-titolo" className="sezione__titolo">
            Relazioni con altre norme
          </h2>
          <EgoNetwork centro={urn} nodi={ego.nodes} archi={ego.edges} />
        </section>
      ) : null}
    </div>
  );
}
