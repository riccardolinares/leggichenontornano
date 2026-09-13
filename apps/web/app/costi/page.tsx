import Link from 'next/link';
import { THRESHOLD } from '@leggichenontornano/engine';
import { etichettaUso, tokenTotali, VALUTA } from '@leggichenontornano/consumi';
import { GraficoBarre } from '@/components/grafico-barre';
import { GrigliaCifre } from '@/components/griglia-cifre';
import { Tabella } from '@/components/tabella';
import { REPO_URL, SOSTIENI_URL } from '@/lib/dataset';
import { riepilogoConsumi } from '@/lib/consumi';
import { contributori } from '@/lib/contributori';
import { bloccoDatiStrutturati, datiStrutturatiDocumento, metadatiPagina } from '@/lib/seo';
import { denaro, mese, numero } from '@/lib/testo';

/*
 * Quanto costa questo progetto, e chi lo tiene in piedi.
 *
 * L'indirizzo è `/costi` perché gli URL di questo sito sono sostantivi che
 * dicono cosa si trova dentro — `/numeri`, `/dati`, `/norme`, `/corte`,
 * `/stampa`, `/segnala` — e «costi» è la parola che una persona userebbe. Una
 * pagina chiamata `/contribuire` avrebbe messo la richiesta davanti al conto, e
 * qui l'ordine è l'argomento: prima quanto costa, poi chi lo paga, e solo dopo
 * come si può dare una mano. Chiedere aiuto senza aver prima aperto i libri è
 * esattamente quello che il progetto rimprovera a chi pubblica una cifra senza
 * dire come l'ha ottenuta.
 *
 * Tutti i numeri di questa pagina vengono dal registro in `data/consumi/`, che
 * è versionato: chi non si fida scarica il repository e rifà la somma. E
 * quando il registro non ha abbastanza righe per sostenere una cifra, **la
 * pagina lo dice** invece di mostrare uno zero. Uno zero calcolato su niente
 * somiglia a una misura, ed è il modo in cui una pagina di trasparenza diventa
 * il contrario di sé stessa.
 */

export const dynamic = 'force-static';

const DESCRIZIONE =
  'Quanto costa far girare questo progetto, misurato chiamata per chiamata, chi ci ha lavorato, e le tre strade per dare una mano.';

export const metadata = metadatiPagina({
  titolo: 'Costi e contributori',
  descrizione: DESCRIZIONE,
  percorso: '/costi',
});

export default async function Costi() {
  const r = riepilogoConsumi();
  const { elenco, motivo } = await contributori();

  /* Il consumo dichiarato da ciascuno, agganciato al nome utente GitHub. Il
     confronto è senza maiuscole perché GitHub non le distingue nei nomi utente
     e chi digita il proprio a mano non le rispetta. */
  const perUtente = new Map(r.perContributore.map((g) => [g.chiave.toLowerCase(), g]));
  const classifica = elenco.map((c) => ({ ...c, consumo: perUtente.get(c.utente.toLowerCase()) }));

  /* Chi ha dichiarato un consumo ma non compare fra i contributori di GitHub:
     è il caso di chi ha revisionato segnalazioni senza aprire una pull
     request, che per questo progetto è il lavoro che serve di più. Lasciarlo
     fuori dalla pagina perché non ha commit sarebbe proprio l'errore che la
     nota sotto la classifica dice di non fare. */
  const nomiNoti = new Set(elenco.map((c) => c.utente.toLowerCase()));
  const soloDichiarato = r.perContributore.filter((g) => !nomiNoti.has(g.chiave.toLowerCase()));

  const registroVuoto = r.righe === 0;

  return (
    <div className="contenitore">
      {/* `Article` e non `Dataset`: il dataset è già dichiarato una volta sola
          nel layout, ed è quello delle segnalazioni. Questa pagina è un
          resoconto, ed è lo stesso vocabolario con cui il sito dichiara la
          pagina di un controllo. */}
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiDocumento({
            titolo: 'Costi e contributori',
            descrizione: DESCRIZIONE,
            percorso: '/costi',
          }),
        )}
      />

      <h1>Quanto costa, e chi lo tiene in piedi</h1>
      <p className="apertura">
        Questo progetto chiede a chi lo legge di non fidarsi: ogni cifra del sito è calcolata da un
        dataset pubblico, e la query che l’ha prodotta sta in pagina. La stessa regola vale per i
        suoi conti. Qui c’è quanto costa far girare la macchina, misurato chiamata per chiamata, chi
        ci ha lavorato, e le tre strade per dare una mano — che non sono in ordine di importanza.
      </p>

      <section className="sezione" aria-labelledby="spesa">
        <h2 id="spesa" className="sezione__titolo">
          Quanto costa questo progetto
        </h2>

        <p>
          Il progetto usa un modello linguistico in tre punti: scrive gli approfondimenti del blog,
          estrae dai commi cosa una norma impone e a chi, e confronta le coppie di disposizioni del
          livello 4. Ogni risposta dell’API porta con sé i token consumati, e{' '}
          <strong>ogni chiamata passa da un unico punto che li registra</strong>: una riga per
          chiamata in <code className="mono">data/consumi/</code>, versionata nel repository. Il
          costo è stimato moltiplicando i token per il{' '}
          <a href={`${REPO_URL}/blob/main/packages/consumi/src/prezzi.ts`}>
            listino in vigore quel giorno
          </a>
          , che sta in un file solo e porta la data da cui vale.
        </p>

        {registroVuoto ? (
          <div className="niente-segnale">
            <p>
              <strong>
                Il registro dei consumi è appena nato e non contiene ancora nessuna riga.
              </strong>{' '}
              Non c’è niente da mostrare: nessun totale, nessun grafico, nessuna media mensile.
              Riempirla di zeri darebbe l’impressione di una misura, e uno zero calcolato su niente
              non è una misura — è il modo in cui una pagina di trasparenza racconta la prima bugia.
            </p>
            <p style={{ marginBottom: 0 }}>
              Le righe cominceranno ad arrivare da sole: la prima sarà quella dell’approfondimento
              di domani, che la GitHub Action scrive e committa insieme all’articolo. Quando ce ne
              saranno abbastanza, qui compariranno i token per modello, la spesa per uso, il suo
              andamento nel tempo e quanto costa tenere acceso il progetto ogni mese. Fino ad allora
              questa pagina dice quello che sa, che è come funziona il conto — non il conto.
            </p>
          </div>
        ) : (
          <>
            <GrigliaCifre
              didascalia="Il consumo registrato finora, in breve"
              cifre={[
                {
                  valore: numero(r.totali.chiamate),
                  unita: r.totali.chiamate === 1 ? 'chiamata' : 'chiamate',
                  etichetta: 'al modello, registrate una per una',
                },
                {
                  valore: numero(tokenTotali(r.totali)),
                  unita: 'token',
                  etichetta: 'in ingresso, in uscita e di cache',
                },
                {
                  valore: denaro(r.totali.costo, VALUTA),
                  etichetta: 'di costo stimato dal listino',
                },
                ...(r.costoMensile !== null
                  ? [
                      {
                        valore: denaro(r.costoMensile, VALUTA),
                        unita: 'al mese',
                        etichetta:
                          r.mesiCompleti === 1
                            ? 'media sull’unico mese concluso'
                            : `media sui ${numero(r.mesiCompleti)} mesi conclusi`,
                      },
                    ]
                  : []),
              ]}
            />

            <p className="riga-corpus">
              {r.dal === r.al
                ? `Registro di ${mese(r.dal ?? '')}.`
                : `Registro da ${mese(r.dal ?? '')} a ${mese(r.al ?? '')}.`}{' '}
              {r.totali.senzaPrezzo > 0 ? (
                <>
                  <strong>
                    {numero(r.totali.senzaPrezzo)}{' '}
                    {r.totali.senzaPrezzo === 1
                      ? 'chiamata è fuori dal totale in dollari'
                      : 'chiamate sono fuori dal totale in dollari'}
                  </strong>{' '}
                  perché il modello che le ha servite non è a listino: sono contate fra le chiamate
                  e non nella spesa, e il totale qui sopra è quindi una sottostima.{' '}
                </>
              ) : null}
              {r.costoMensile === null
                ? 'Non c’è ancora un mese concluso: una media mensile calcolata sul mese in corso dipenderebbe da che giorno è oggi, e non la scriviamo.'
                : 'La media è calcolata sui soli mesi conclusi: il mese in corso è incompleto per definizione.'}
            </p>

            <h3>A cosa servono i soldi</h3>
            <GraficoBarre
              barre={r.perUso.map((g) => ({
                etichetta: etichettaUso(g.chiave),
                valore: g.costo,
                valoreTesto: denaro(g.costo, VALUTA),
              }))}
              descrizione="La spesa stimata divisa per quello a cui è servita"
              didascalia="La spesa stimata per ciascun uso del modello, con le chiamate e i token che l’hanno prodotta."
              alternativa={
                <Tabella didascalia="La spesa stimata per ciascun uso del modello, con le chiamate e i token che l’hanno prodotta.">
                  <thead>
                    <tr>
                      <th scope="col">A cosa serviva</th>
                      <th scope="col">Chiamate</th>
                      <th scope="col">Token</th>
                      <th scope="col">Costo stimato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.perUso.map((g) => (
                      <tr key={g.chiave}>
                        <th scope="row" style={{ fontWeight: 400 }}>
                          {etichettaUso(g.chiave)}
                        </th>
                        <td>{numero(g.chiamate)}</td>
                        <td>{numero(tokenTotali(g))}</td>
                        <td>{denaro(g.costo, VALUTA)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabella>
              }
            />

            {r.perMese.length > 1 ? (
              <>
                <h3>Come va nel tempo</h3>
                <GraficoBarre
                  barre={r.perMese.map((g) => ({
                    etichetta: mese(g.chiave),
                    valore: g.costo,
                    valoreTesto: denaro(g.costo, VALUTA),
                  }))}
                  descrizione="La spesa stimata mese per mese, dal primo registrato a oggi"
                  didascalia="La spesa stimata di ogni mese, con quante chiamate al modello l’hanno prodotta."
                  alternativa={
                    <Tabella didascalia="La spesa stimata di ogni mese, con quante chiamate al modello l’hanno prodotta.">
                      <thead>
                        <tr>
                          <th scope="col">Mese</th>
                          <th scope="col">Chiamate</th>
                          <th scope="col">Costo stimato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.perMese.map((g) => (
                          <tr key={g.chiave}>
                            <th scope="row" style={{ fontWeight: 400 }}>
                              {mese(g.chiave)}
                            </th>
                            <td>{numero(g.chiamate)}</td>
                            <td>{denaro(g.costo, VALUTA)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabella>
                  }
                />
                <p style={{ fontSize: '0.9rem', color: 'var(--inchiostro-tenue)' }}>
                  L’ultimo mese della serie è quello in corso, ed è più basso degli altri per il
                  solo fatto di non essere finito. Non è un risparmio.
                </p>
              </>
            ) : null}

            <h3>Token per modello</h3>
            <Tabella didascalia="I token consumati da ciascun modello, divisi per tipo, e il costo che il listino gli attribuisce.">
              <thead>
                <tr>
                  <th scope="col">Modello</th>
                  <th scope="col">In ingresso</th>
                  <th scope="col">In uscita</th>
                  <th scope="col">Di cache</th>
                  <th scope="col">Costo stimato</th>
                </tr>
              </thead>
              <tbody>
                {r.perModello.map((g) => (
                  <tr key={g.chiave}>
                    <th scope="row">
                      <span className="mono">{g.chiave}</span>
                    </th>
                    <td>{numero(g.tokenIngresso)}</td>
                    <td>{numero(g.tokenUscita)}</td>
                    <td>{numero(g.tokenCacheScrittura + g.tokenCacheLettura)}</td>
                    <td>{g.senzaPrezzo > 0 ? 'non a listino' : denaro(g.costo, VALUTA)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabella>

            <p style={{ fontSize: '0.9rem', color: 'var(--inchiostro-tenue)' }}>
              Le cifre sono in dollari perché in dollari si paga l’API: convertirle in euro vorrebbe
              dire scegliere un cambio e non dirlo. Sono <strong>stime</strong>, non una fattura —
              token per listino — e il listino è pubblico, quindi il conto si rifà.
            </p>
          </>
        )}

        <p>
          Quello che questa pagina <em>non</em> conta è il resto: il tempo delle persone, che è la
          voce più grossa e non ha un prezzo di listino, e le poche spese vive di dominio e
          pubblicazione. Il consumo dei modelli è la parte che si può misurare esattamente, ed è la
          ragione per cui è l’unica che trovate in cifre.
        </p>
      </section>

      <section className="sezione" aria-labelledby="contributori">
        <h2 id="contributori" className="sezione__titolo">
          Chi ha contribuito
        </h2>

        <div className="niente-segnale">
          <p style={{ marginBottom: 0 }}>
            <strong>Il numero di commit non è il valore di un contributo.</strong> È un conteggio di
            quante volte qualcuno ha scritto nel repository, e su questo progetto il contributo che
            serve di più — un giurista che legge una segnalazione e dice che non è un conflitto —
            non produce nemmeno un commit. Questa classifica misura una cosa sola, e la dice: chi ha
            toccato il codice, e quante volte. Non leggetela come altro.
          </p>
        </div>

        {motivo ? (
          <p className="riga-corpus" style={{ marginTop: '1.5rem' }}>
            {motivo} Le pagine di questo sito sono statiche e si costruiscono una volta sola:
            nessuna richiesta parte dal vostro browser, nemmeno per questo elenco. L’elenco
            aggiornato è <a href={`${REPO_URL}/graphs/contributors`}>su GitHub</a>.
          </p>
        ) : classifica.length === 0 ? (
          <p className="riga-corpus" style={{ marginTop: '1.5rem' }}>
            L’API di GitHub ha risposto, e non risulta ancora nessun contributore oltre a chi ha
            aperto il repository.
          </p>
        ) : (
          <Tabella didascalia="I contributori del repository in classifica per numero di commit, con accanto il consumo di modello che ciascuno ha dichiarato.">
            <thead>
              <tr>
                <th scope="col">Contributore</th>
                <th scope="col">Commit</th>
                <th scope="col">Token dichiarati</th>
                <th scope="col">Costo dichiarato</th>
              </tr>
            </thead>
            <tbody>
              {classifica.map((c) => (
                <tr key={c.utente}>
                  <th scope="row">
                    <a href={c.profilo}>{c.utente}</a>
                  </th>
                  <td>{numero(c.contributi)}</td>
                  <td>{c.consumo ? numero(tokenTotali(c.consumo)) : 'non dichiarati'}</td>
                  <td>{c.consumo ? denaro(c.consumo.costo, VALUTA) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Tabella>
        )}

        {soloDichiarato.length > 0 ? (
          <>
            <h3>Chi ha dichiarato un consumo senza commit</h3>
            <Tabella didascalia="Chi ha dichiarato un consumo di modello senza comparire fra i contributori del repository.">
              <thead>
                <tr>
                  <th scope="col">Chi</th>
                  <th scope="col">Token dichiarati</th>
                  <th scope="col">Costo dichiarato</th>
                </tr>
              </thead>
              <tbody>
                {soloDichiarato.map((g) => (
                  <tr key={g.chiave}>
                    <th scope="row">
                      <a href={`https://github.com/${g.chiave}`}>{g.chiave}</a>
                    </th>
                    <td>{numero(tokenTotali(g))}</td>
                    <td>{denaro(g.costo, VALUTA)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabella>
          </>
        ) : null}

        <p style={{ marginTop: '1.5rem' }}>
          I token accanto a ciascun nome sono <strong>dichiarati, non misurati</strong>: li scrive
          chi contribuisce, con un comando che legge il file di sessione del proprio assistente e
          appende una riga al registro. Sono tenuti separati dalle chiamate che il progetto misura
          da sé, perché sono due gradi di certezza diversi e sommarli senza dirlo sarebbe un modo di
          far sembrare più solido un numero che non lo è.
        </p>
      </section>

      <section className="sezione" aria-labelledby="contribuire">
        <h2 id="contribuire" className="sezione__titolo">
          Come contribuire
        </h2>
        <p>
          Tre strade, e sono davvero tre. Un progetto che dice «contributi benvenuti» e poi ha una
          sola porta — quella della pull request — sta chiedendo aiuto a una categoria sola di
          persone, che per un progetto sul diritto italiano è la categoria sbagliata.
        </p>

        <div className="strade">
          <section className="strada" aria-labelledby="strada-tecnica">
            <h3 id="strada-tecnica">Competenze tecniche</h3>
            <p>
              Il progetto è TypeScript in un monorepo: un motore di controlli che gira su un grafo
              normativo, un sito statico senza JavaScript obbligatorio, un server MCP. Serve saper
              leggere codice altrui più che scriverne di nuovo.
            </p>
            <p>
              Da dove si comincia:{' '}
              <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>CONTRIBUTING.md</a> dice cosa il
              progetto <strong>non</strong> accetta — sono sei vincoli, e sono quelli che lo tengono
              in piedi — e cosa serve a un controllo nuovo per esistere. Le cose da fare sono
              descritte nelle issue con il modulo{' '}
              <a href={`${REPO_URL}/issues`}>«Un lavoro da fare»</a>, che è lungo di proposito:
              problema, come si vede che è fatto, dove mettere le mani, come si verifica.
            </p>
            <p style={{ marginBottom: 0 }}>
              Prima di aprire una pull request devono essere verdi{' '}
              <code className="mono">build</code>, <code className="mono">typecheck</code>,{' '}
              <code className="mono">test</code> e <code className="mono">e2e</code>. L’ultimo
              comprende l’audit di accessibilità: una violazione WCAG 2.1 AA fa fallire la build
              come qualunque altra regressione.
            </p>
          </section>

          <section className="strada" aria-labelledby="strada-giuridica">
            <h3 id="strada-giuridica">Competenze legali o giuridiche</h3>
            <p>
              <strong>È il contributo che al progetto manca di più</strong>, e non è un modo di
              dire: senza, metà di quello che il motore trova non può essere pubblicato.
            </p>
            <p>
              Il lavoro è leggere una segnalazione e dire se tiene. Un rinvio a una norma abrogata
              può essere <em>recettizio</em> — aver incorporato il testo richiamato una volta per
              tutte — e allora l’abrogazione successiva non lo tocca, e la segnalazione è un falso
              positivo. Lo stesso vale per una norma speciale che deroga a una generale, per una
              delegificazione autorizzata, per una disciplina transitoria. Sono distinzioni che una
              query non sa fare e una persona che conosce la materia fa in un minuto.
            </p>
            <p>
              Ogni scheda ha un pulsante <strong>«Non è un conflitto»</strong>: apre una issue
              pubblica, senza registrazione, con i riferimenti già dentro. Anche una riga basta.
            </p>
            <p style={{ marginBottom: 0 }}>
              Quelle risposte non finiscono in un cassetto: alimentano il gold standard e{' '}
              <strong>cambiano la precisione misurata</strong> del controllo che ha prodotto la
              segnalazione. Un tipo di controllo pubblica solo sopra il{' '}
              {Math.round(THRESHOLD.minPrecision * 100)}% di precisione su almeno{' '}
              {THRESHOLD.minSample} revisioni umane: sotto quella soglia le sue segnalazioni restano
              nella coda interna, e se scende sotto dopo esserci arrivato sparisce dal sito. La
              soglia è applicata dal codice, non dalla disciplina di chi pubblica: non ha un
              pulsante nemmeno per chi mantiene il progetto.{' '}
              <Link href="/dati">Le misure per intero</Link>.
            </p>
          </section>

          <section className="strada" aria-labelledby="strada-economica">
            <h3 id="strada-economica">Economicamente</h3>
            <p>
              Questo sito non ha pubblicità, abbonamenti, muri a pagamento o tracciamento, e non ne
              avrà. Non è una posa: sono le tre cose che cambierebbero quello che il sito può
              permettersi di scrivere.
            </p>
            <p>
              Vuol dire che i soldi arrivano da un posto solo, che è chi lo usa. Le cifre qui sopra
              sono quello che si paga per tenerlo acceso, e sono quelle vere.
            </p>
            <p className="azioni" style={{ marginBottom: 0 }}>
              <a className="bottone bottone--primario" href={SOSTIENI_URL}>
                Offri un caffè al progetto
              </a>
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
