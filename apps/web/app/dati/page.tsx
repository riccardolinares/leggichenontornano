import Link from 'next/link';
import { THRESHOLD } from '@antinomia/engine';
import { REPO_URL, dataset } from '@/lib/dataset';
import { data, numero, percentuale } from '@/lib/testo';
import { Tabella } from '@/components/tabella';
import { ContatoreNazionale } from '@/components/contatore';

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
  const verticali = reader.verticals();
  const revisioni = metriche.reduce((n, m) => n + m.reviewed, 0);
  const contatore = reader.counter();

  return (
    <div className="contenitore">
      <h1>Dati e precisione</h1>
      <p className="apertura">
        Questa pagina mostra quanto è grande il corpus, quanto è precisa ogni regola e quali
        controlli non stiamo pubblicando. La parte interessante è l’ultima.
      </p>

      {contatore ? (
        <section className="sezione" aria-labelledby="contatore">
          <h2 id="contatore" className="sezione__titolo">
            Il contatore
          </h2>
          <ContatoreNazionale contatore={contatore} />
        </section>
      ) : null}

      <section className="sezione" aria-labelledby="corpus">
        <h2 id="corpus" className="sezione__titolo">
          Consistenza del corpus
        </h2>
        {manifest ? (
          <Tabella
            didascalia={`Stato del dataset alla generazione del ${data(manifest.generatedAt.slice(0, 10))}.`}
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

        <h3 style={{ marginTop: '2rem' }}>Cosa manca ancora</h3>
        <div className="niente-segnale">
          <p style={{ marginBottom: 0 }}>
            {revisioni === 0 ? (
              <>
                <strong>Nessuna revisione umana è ancora stata registrata.</strong> Le percentuali
                di precisione qui sopra non esistono perché non c’è ancora niente da misurare, e i
                controlli di livello 1 pubblicano in attesa di quelle revisioni perché sono
                deterministici, non perché siano stati verificati.{' '}
              </>
            ) : (
              <>
                Le revisioni registrate sono <strong>{numero(revisioni)}</strong>, e le percentuali
                qui sopra valgono quanto quel campione.{' '}
              </>
            )}
            Il primo lotto di segnalazioni <strong>non è ancora stato demolito da giuristi
            esterni</strong>: è il passo previsto prima del lancio pubblico, e l’incarico è «trova
            tutto quello che non regge», non «controlla se vanno bene». Finché non sarà fatto,
            questa riga resta qui.
          </p>
        </div>
      </section>

      {verticali.length > 0 ? (
        <section className="sezione" aria-labelledby="verticali">
          <h2 id="verticali" className="sezione__titolo">
            Fin dove arriva il confronto semantico
          </h2>
          <p>
            I controlli di livello 3 confrontano il contenuto delle norme, e non possono farlo su
            tutto: nell’italiano giuridico «concessione» sta nel codice dei contratti pubblici e
            nel codice della navigazione, «collaudo» negli appalti e nel collaudo dei veicoli.
            Ogni dominio dichiara quindi <strong>l’elenco degli atti</strong> su cui il confronto
            lavora. Qui sotto c’è quell’elenco, per intero.
          </p>
          {verticali.map((v) => (
            <div key={v.vertical} style={{ marginBottom: '2rem' }}>
              <h3>{v.label}</h3>
              <p>
                {numero(v.acts.length)} atti, {numero(v.concepts)} concetti nel vocabolario,{' '}
                {numero(v.propositions)} proposizioni estratte da <code>{v.extractor}</code>, di cui{' '}
                {numero(v.propositionsWithConcept)} ricondotte a un concetto: sono le uniche che
                entrano in un confronto.
              </p>
              <Tabella didascalia={`Gli atti su cui il confronto semantico del dominio «${v.label}» ha effettivamente lavorato.`}>
                <thead>
                  <tr>
                    <th scope="col">Atto</th>
                    <th scope="col">Come è entrato nel dominio</th>
                  </tr>
                </thead>
                <tbody>
                  {v.acts.map((urn) => (
                    <tr key={urn}>
                      <th scope="row" style={{ fontWeight: 400 }}>
                        <Link href={`/norma/${encodeURIComponent(urn)}`}>
                          {dataset().act(urn)?.title.slice(0, 90) ?? urn}
                        </Link>
                        <br />
                        <code>{urn}</code>
                      </th>
                      <td>
                        {v.roots.includes(urn)
                          ? 'dichiarato a mano come atto fondativo del dominio'
                          : `aggiunto dal grafo: ${v.expansion.join(' o ').toLowerCase()} un atto fondativo`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabella>
              {v.missingRoots.length > 0 ? (
                <div className="niente-segnale" style={{ marginTop: '1rem' }}>
                  <p style={{ marginBottom: 0 }}>
                    <strong>
                      {numero(v.missingRoots.length)} atti fondativi dichiarati non sono nel corpus
                      che abbiamo scaricato
                    </strong>{' '}
                    e quindi non vengono confrontati:{' '}
                    {v.missingRoots.map((u) => (
                      <code key={u} style={{ marginRight: '0.5rem' }}>
                        {u}
                      </code>
                    ))}
                    . La copertura di questo dominio è corrispondentemente più bassa.
                  </p>
                </div>
              ) : null}
            </div>
          ))}
          <div className="niente-segnale">
            <p style={{ marginBottom: 0 }}>
              Una divergenza fra un atto di questo elenco e una norma che ne sta fuori{' '}
              <strong>oggi non la vediamo</strong>. È una scelta: preferiamo non vederla piuttosto
              che pubblicarla insieme a duecento accostamenti fra materie diverse.
            </p>
          </div>
        </section>
      ) : null}

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
            <code>verticali.json</code> — i domini del confronto semantico e i loro confini
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
