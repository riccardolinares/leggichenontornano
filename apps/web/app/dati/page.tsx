import Link from 'next/link';
import { THRESHOLD } from '@antinomia/engine';
import { REPO_URL, dataset } from '@/lib/dataset';
import { data, numero, percentuale } from '@/lib/testo';
import { Tabella } from '@/components/tabella';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Dati e precisione',
  description:
    'Il dataset scaricabile, le licenze e la precisione misurata di ogni controllo, compresi quelli che non pubblichiamo.',
};

export default function Dati() {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const metriche = reader.data.metrics;
  const pubblicati = metriche.filter((m) => m.published);
  const fermi = metriche.filter((m) => !m.published);

  return (
    <div className="contenitore">
      <h1>Dati e precisione</h1>
      <p className="apertura">
        Questa pagina mostra quanto è grande il corpus, quanto è precisa ogni regola e quali
        controlli non stiamo pubblicando. La parte interessante è l’ultima.
      </p>

      <section className="sezione" aria-labelledby="corpus">
        <h2 id="corpus" className="sezione__titolo">
          Consistenza del corpus
        </h2>
        {manifest ? (
          <Tabella
            didascalia={`Stato del dataset alla generazione del {data(manifest.generatedAt.slice(0, 10))}.`}
          >
            <tbody>
              <tr>
                <th scope="row">Atti</th>
                <td>{numero(manifest.counts.acts)}</td>
              </tr>
              <tr>
                <th scope="row">Versioni (multivigenza)</th>
                <td>{numero(manifest.counts.versions)}</td>
              </tr>
              <tr>
                <th scope="row">Articoli</th>
                <td>{numero(manifest.counts.articles)}</td>
              </tr>
              <tr>
                <th scope="row">Relazioni fra norme</th>
                <td>{numero(manifest.counts.relations)}</td>
              </tr>
              <tr>
                <th scope="row">Segnalazioni prodotte</th>
                <td>{numero(manifest.counts.anomalies)}</td>
              </tr>
              <tr>
                <th scope="row">Segnalazioni pubblicate</th>
                <td>{numero(manifest.counts.publishedAnomalies)}</td>
              </tr>
            </tbody>
          </Tabella>
        ) : (
          <p>Nessun dataset generato.</p>
        )}
        <p style={{ marginTop: '1rem' }}>
          Il corpus non è l’intero ordinamento italiano: contiene le collezioni che abbiamo
          ingerito, e cresce. Una segnalazione assente può dipendere da una norma che non abbiamo
          ancora.
        </p>
      </section>

      <section className="sezione" aria-labelledby="precisione">
        <h2 id="precisione" className="sezione__titolo">
          Precisione per controllo
        </h2>
        <div className="niente-segnale" style={{ marginBottom: '1.5rem' }}>
          <p style={{ marginBottom: 0 }}>
            Soglia di pubblicazione: <strong>{Math.round(THRESHOLD.minPrecision * 100)}%</strong> di
            precisione su almeno <strong>{THRESHOLD.minSample}</strong> revisioni umane. Sotto
            soglia il controllo resta in coda interna.
          </p>
        </div>

        <Tabella didascalia="Ogni controllo, quante segnalazioni ha prodotto, quante sono state revisionate da una persona, e se pubblica.">
          <thead>
            <tr>
              <th scope="col">Controllo</th>
              <th scope="col">Liv.</th>
              <th scope="col">Segnalazioni</th>
              <th scope="col">Revisioni</th>
              <th scope="col">Precisione</th>
              <th scope="col">Pubblica</th>
            </tr>
          </thead>
          <tbody>
            {metriche.map((m) => (
              <tr key={m.checkId}>
                <th scope="row">
                  {m.label}
                  <br />
                  <small className="mono" style={{ color: 'var(--inchiostro-debole)' }}>
                    {m.checkId}
                  </small>
                </th>
                <td>{m.level}</td>
                <td>{numero(m.found)}</td>
                <td>
                  {numero(m.reviewed)}
                  {m.reviewed > 0 ? ` (${numero(m.confirmed)} conferme)` : ''}
                </td>
                <td>{percentuale(m.precision)}</td>
                <td>
                  {m.published ? (
                    <span className="etichetta etichetta--verificato">sì</span>
                  ) : (
                    <span className="etichetta etichetta--area-grigia">no</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabella>

        {fermi.length > 0 ? (
          <>
            <h3 style={{ marginTop: '2rem' }}>Perché questi controlli non pubblicano</h3>
            <dl>
              {fermi.map((m) => (
                <div key={m.checkId} style={{ marginBottom: '1rem' }}>
                  <dt style={{ fontWeight: 600 }}>{m.label}</dt>
                  <dd style={{ margin: '0.2rem 0 0', color: 'var(--inchiostro-tenue)' }}>
                    {m.reason}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}

        {pubblicati.length === 0 ? (
          <p>
            Al momento nessun controllo pubblica.{' '}
            <strong>Non significa che la legislazione italiana sia coerente</strong>: significa che
            nessuna regola ha ancora superato la soglia sul corpus che abbiamo.
          </p>
        ) : null}
      </section>

      <section className="sezione" aria-labelledby="scarica">
        <h2 id="scarica" className="sezione__titolo">
          Scaricare il dataset
        </h2>
        <p>
          Il dataset derivato è pubblicato come artefatto di release in JSONL: una riga per record,
          un file per tipo. Non è un formato elegante, è un formato che si legge con{' '}
          <code>grep</code> e non richiede di installare niente per verificarci sopra una nostra
          affermazione.
        </p>
        <ul>
          <li>
            <code>acts.jsonl</code> — gli atti, con stato di abrogazione
          </li>
          <li>
            <code>versions.jsonl</code> — le finestre di vigenza
          </li>
          <li>
            <code>articles.jsonl</code> — il testo degli articoli per versione
          </li>
          <li>
            <code>relations.jsonl</code> — il grafo tipizzato e datato
          </li>
          <li>
            <code>anomalies.jsonl</code> — le segnalazioni, pubblicate e in coda
          </li>
          <li>
            <code>metrics.json</code> e <code>manifest.json</code> — precisione e provenienza
          </li>
        </ul>
        <p className="azioni">
          <a className="bottone bottone--primario" href={`${REPO_URL}/releases`}>
            Release e dataset
          </a>
          <a className="bottone" href={`${REPO_URL}/tree/main/docs`}>
            Metodo e decisioni
          </a>
          <Link className="bottone" href="/stampa">
            Materiali per la stampa
          </Link>
        </p>
      </section>

      <section className="sezione" aria-labelledby="licenze">
        <h2 id="licenze" className="sezione__titolo">
          Licenze e attribuzione
        </h2>
        <p className="attribuzione">
          <strong>Fonte:</strong> Normattiva — Banca dati delle norme vigenti,{' '}
          <a href="https://dati.normattiva.it">dati.normattiva.it</a>, licenza{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.it">CC BY 4.0</a>.
          <br />
          La banca dati Normattiva non ha carattere di ufficialità: l’unico testo ufficiale è quello
          pubblicato sulla <em>Gazzetta Ufficiale</em>, che prevale in caso di discordanza.
          <br />
          <strong>Software:</strong> EUPL 1.2. <strong>Dataset derivato:</strong> CC BY 4.0.
        </p>
      </section>
    </div>
  );
}
