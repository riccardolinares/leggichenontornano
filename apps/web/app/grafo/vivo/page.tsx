import Link from 'next/link';
import { GrafoVivo, type ArcoVivo, type NodoVivo } from '@/components/grafo-vivo';
import { Tabella } from '@/components/tabella';
import { REPO_URL } from '@/lib/dataset';
import { ETICHETTA_FAMIGLIA, grafo } from '@/lib/grafo';
import { metadatiPagina } from '@/lib/seo';
import { data, numero, percorsoNorma } from '@/lib/testo';

/*
 * La mappa viva: lo stesso grafo di `/grafo`, con la simulazione accesa.
 *
 * ## Perché due pagine e non una
 *
 * Non è la stessa cosa fatta due volte. `/grafo` è un'immagine ferma, calcolata
 * sul server, uguale per tutti e citabile come una pagina: quella resta, e
 * [ADR 0012](../../../../docs/adr/0012-il-grafo-si-puo-fare-se-non-si-muove.md)
 * continua a valere lì, riga per riga. Qui la simulazione gira nel browser, e
 * quindi il disegno **non è più lo stesso per due persone**. È una perdita
 * vera, ed è scritta in
 * [ADR 0018](../../../../docs/adr/0018-il-grafo-si-puo-muovere-se-si-rinuncia-a-citarlo.md)
 * insieme a quello che si guadagna: le norme si possono prendere e tirare, e
 * tirando un perno si vede in un gesto quanta parte dell'ordinamento gli sta
 * appesa.
 *
 * L'indirizzo dice la stessa cosa: `/grafo/vivo` sta **sotto** `/grafo` perché
 * è lo stesso grafo in un'altra forma, non un'altra mappa.
 *
 * I dati sono quelli di `lib/grafo.ts` — nodi, archi, gradi, famiglie di
 * legame — e non vengono ricalcolati qui. Le coordinate che quel file produce
 * sono l'unica cosa che questa pagina butta via, perché è esattamente quello
 * che la simulazione viene a fare.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'La mappa viva delle leggi',
  descrizione:
    'Lo stesso grafo delle leggi italiane, con la simulazione a forze accesa nel browser: le norme si trascinano, i perni si vedono a occhio. Il disegno cambia a ogni caricamento.',
  percorso: '/grafo/vivo',
});

export default function PaginaGrafoVivo() {
  const g = grafo();

  /* Dal grafo del server si prende tutto tranne le posizioni: quelle le
     calcola la simulazione nel browser, ed è l'unica differenza con `/grafo`. */
  const nodi: NodoVivo[] = g.nodi.map((n) => ({
    urn: n.urn,
    nome: n.nome,
    percorso: percorsoNorma(n.urn),
    grado: n.grado,
    entranti: n.entranti,
    uscenti: n.uscenti,
    abrogato: n.abrogato,
    fuoriCorpus: n.fuoriCorpus,
    puntaAlVuoto: n.puntaAlVuoto,
    segnalazioni: n.segnalazioni,
  }));

  const archi: ArcoVivo[] = g.archi.map((a) => ({
    da: a.da,
    a: a.a,
    famiglia: a.famiglia,
    peso: a.peso,
    rotto: a.rotto,
  }));

  const rotti = archi.filter((a) => a.rotto).length;
  const morti = nodi.filter((n) => n.abrogato).length;

  const perFamiglia = g.famiglie.map((f) => ({
    famiglia: f,
    quanti: archi.filter((a) => a.famiglia === f).length,
    rotti: archi.filter((a) => a.famiglia === f && a.rotto).length,
  }));

  // L'elenco sotto il disegno è ordinato come il disegno va letto: prima i
  // perni, che sono i nodi grossi al centro.
  const inElenco = [...nodi].sort((x, y) => y.grado - x.grado || x.nome.localeCompare(y.nome));

  return (
    <div className="contenitore">
      <h1>La mappa viva delle leggi</h1>
      <p className="apertura">
        Le stesse {numero(nodi.length)} norme e gli stessi {numero(archi.length)} collegamenti della{' '}
        <Link href="/grafo">mappa ferma</Link>, con la simulazione accesa: qui le leggi si sistemano
        da sole sotto gli occhi, e si possono prendere e tirare. Chi tira un perno vede in un gesto
        quanta parte dell’ordinamento gli sta appesa.
      </p>

      <p className="riga-corpus">
        {numero(nodi.length)} norme e {numero(archi.length)} collegamenti, che riassumono{' '}
        {numero(g.relazioni)} relazioni del dataset; {numero(rotti)} finiscono su {numero(morti)}{' '}
        testi che non sono più in vigore. Corpus aggiornato al {data(g.conosciutoAl)}.
      </p>

      <GrafoVivo nodi={nodi} archi={archi} famiglie={g.famiglie} />

      <section className="sezione" aria-labelledby="vivo-leggere">
        <h2 id="vivo-leggere" className="sezione__titolo">
          Come si legge, e cosa questa pagina non è
        </h2>
        <ul className="elenco-domande">
          <li>
            <strong>Il disegno non è citabile.</strong> Le posizioni le calcola il tuo browser,
            adesso: chi apre questo stesso indirizzo vede le stesse norme in un’altra disposizione.
            Se ti serve un’immagine da allegare, da discutere o da mettere in un atto, usa la{' '}
            <Link href="/grafo">mappa ferma</Link>, che è sempre la stessa per tutti.
          </li>
          <li>
            <strong>Nessun numero si legge da qui.</strong> Le cifre stanno nella riga sopra e nelle
            tabelle sotto. Un disegno che cambia non può essere la fonte di un dato.
          </li>
          <li>
            <strong>Grandezza del punto:</strong> quante altre leggi lo toccano. I punti più grossi
            sono i perni: tutto passa da lì, e infatti tirandoli si muove mezza mappa.
          </li>
          <li>
            <strong>Colore del filo:</strong> lo stesso della mappa ferma. Grigio la rimanda, verde
            la riscrive, ocra la cancella, azzurro la attua, viola la Corte l’ha dichiarata
            illegittima. Il <strong className="grafo__rosso">rosso</strong> è riservato a una cosa
            sola: il bersaglio non è più in vigore.
          </li>
          <li>
            <strong>Punto vuoto cerchiato di rosso:</strong> una norma abrogata. Non è più in
            vigore, e continuano ad arrivarci dei fili.
          </li>
          <li>
            <strong>Per usarla:</strong> passa sopra una norma per vederne il nome e accendere i
            suoi collegamenti, trascinala per sentire cosa le viene dietro, cliccala per aprirne la
            scheda. Rotella per avvicinarti. Da tastiera il disegno non si esplora: quello che
            contiene sta tutto nell’elenco qui sotto, che è fatto di collegamenti veri.
          </li>
        </ul>
      </section>

      <section className="sezione" aria-labelledby="vivo-legami">
        <h2 id="vivo-legami" className="sezione__titolo">
          Che cosa sono i fili
        </h2>
        <Tabella didascalia="I collegamenti del disegno per tipo di legame, e quanti finiscono su norme non più in vigore.">
          <thead>
            <tr>
              <th scope="col">Che cosa una norma ha fatto all’altra</th>
              <th scope="col">Collegamenti</th>
              <th scope="col">Verso norme non più in vigore</th>
            </tr>
          </thead>
          <tbody>
            {perFamiglia.map((f) => (
              <tr key={f.famiglia}>
                <th scope="row">{ETICHETTA_FAMIGLIA[f.famiglia]}</th>
                <td>{numero(f.quanti)}</td>
                <td>{numero(f.rotti)}</td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      </section>

      <section className="sezione" aria-labelledby="vivo-elenco">
        <h2 id="vivo-elenco" className="sezione__titolo">
          Le norme del disegno, una per una
        </h2>
        <p>
          Un canvas è invisibile a chi usa uno screen reader, e non si percorre da tastiera. Questo
          elenco non è un ripiego: è la stessa informazione del disegno, leggibile, ordinabile a
          occhio e fatta di collegamenti che portano alla scheda di ogni norma.
        </p>
        <Tabella didascalia="Le norme del grafo, dalla più collegata alla meno collegata, con quante norme le richiamano e quante ne richiamano.">
          <thead>
            <tr>
              <th scope="col">Norma</th>
              <th scope="col">La richiamano</th>
              <th scope="col">Ne richiama</th>
              <th scope="col">Stato</th>
            </tr>
          </thead>
          <tbody>
            {inElenco.map((n) => (
              <tr key={n.urn}>
                <th scope="row">
                  <Link href={n.percorso}>{n.nome}</Link>
                </th>
                <td>{numero(n.entranti)}</td>
                <td>{numero(n.uscenti)}</td>
                <td>
                  {n.abrogato
                    ? 'non è più in vigore'
                    : n.fuoriCorpus
                      ? 'testo non ancora ingerito'
                      : n.puntaAlVuoto
                        ? 'in vigore, rinvia a una norma cancellata'
                        : 'in vigore'}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      </section>

      <p className="riga-corpus">
        Questa pagina contraddice di proposito una decisione scritta, e lo dice:{' '}
        <a
          href={`${REPO_URL}/blob/main/docs/adr/0018-il-grafo-si-puo-muovere-se-si-rinuncia-a-citarlo.md`}
        >
          ADR 0018
        </a>{' '}
        registra cosa si guadagna e cosa si perde a lasciare correre una simulazione nel browser.
        Per l’immagine che si può citare resta la <Link href="/grafo">mappa ferma</Link>.{' '}
        <Link href="/mappa">Tutto il resto del sito</Link>.
      </p>
    </div>
  );
}
