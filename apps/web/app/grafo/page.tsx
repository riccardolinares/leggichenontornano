import { Suspense } from 'react';
import Link from 'next/link';
import { GrafoForze } from '@/components/grafo-forze';
import { Tabella } from '@/components/tabella';
import { SITE_URL } from '@/lib/dataset';
import { grafo } from '@/lib/grafo';
import { metadatiPagina } from '@/lib/seo';
import { data, numero, percorsoNorma } from '@/lib/testo';

/*
 * Il grafo delle leggi in vigore.
 *
 * Pagina fuori dal menù e presente nel piede: è una cosa da guardare, non un
 * passaggio del percorso di chi cerca una norma.
 *
 * [ADR 0012](../../../docs/adr/0012-il-grafo-si-puo-fare-se-non-si-muove.md)
 * spiega perché esiste nonostante ADR 0003 escludesse i grafi force-directed.
 * In breve: l'obiezione vera era che una simulazione nel browser dà un disegno
 * diverso a ogni caricamento, e un'immagine che cambia da sola non si può
 * citare. Qui il layout è calcolato una volta, in modo deterministico, e nel
 * browser arrivano coordinate fisse.
 *
 * Sotto il disegno c'è la stessa informazione in tabella. Non è un ripiego per
 * l'accessibilità: un grafo denso fa vedere la **forma** del problema, e i
 * numeri esatti bisogna comunque poterli leggere.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'La mappa delle leggi',
  descrizione:
    'Come le leggi italiane si tengono fra loro: rinvii, modifiche, abrogazioni, attuazioni. In rosso i fili che finiscono su norme che non esistono più.',
  percorso: '/grafo',
});

export default function PaginaGrafo() {
  const g = grafo();

  const rotti = g.archi.filter((a) => a.rotto);
  const morti = g.nodi.filter((n) => n.abrogato);
  const puntanoAlVuoto = g.nodi.filter((n) => n.puntaAlVuoto && !n.abrogato);

  // I bersagli morti, ordinati per quante norme vive li richiamano ancora.
  const perBersaglio = new Map<string, number>();
  for (const a of rotti) perBersaglio.set(a.a, (perBersaglio.get(a.a) ?? 0) + 1);
  const bersagli = [...perBersaglio.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([urn, quanti]) => ({ nodo: g.nodi.find((n) => n.urn === urn), quanti }))
    .filter((b): b is { nodo: NonNullable<typeof b.nodo>; quanti: number } => !!b.nodo);

  return (
    <div className="contenitore">
      <h1>La mappa delle leggi</h1>
      <p className="apertura">
        Ogni punto è una legge. Ogni filo è qualcosa che una legge ha fatto a un’altra: la rimanda,
        la riscrive, la cancella, l’attua. <strong className="grafo__rosso">In rosso</strong> i fili
        che finiscono su norme che non esistono più — e i punti che li tirano.
      </p>

      <p className="riga-corpus">
        {numero(g.nodi.length)} norme e {numero(g.archi.length)} collegamenti, che riassumono{' '}
        {numero(g.relazioni)} relazioni del dataset; {numero(rotti.length)} finiscono su testi che
        non sono più in vigore. Calcolato sul corpus aggiornato al {data(g.conosciutoAl)}.
      </p>

      <Suspense fallback={<p>Preparo la mappa…</p>}>
        <GrafoForze grafo={g} base={SITE_URL} />
      </Suspense>

      <section className="sezione" aria-labelledby="leggere">
        <h2 id="leggere" className="sezione__titolo">
          Come si legge
        </h2>
        <ul className="elenco-domande">
          <li>
            <strong>Grandezza del punto:</strong> quante altre leggi lo toccano. I punti più grossi
            sono i perni dell’ordinamento: tutto passa da lì.
          </li>
          <li>
            <strong>Colore del filo:</strong> che cosa una norma ha fatto all’altra. Grigio la
            rimanda, verde la riscrive, ocra la cancella. Il rosso è riservato a una cosa sola, ed è
            il motivo per cui questa pagina esiste.
          </li>
          <li>
            <strong>Punto vuoto cerchiato di rosso:</strong> una norma abrogata. Non è più in
            vigore, e infatti nel disegno è un buco — solo che continuano ad arrivarci dei fili.
          </li>
          <li>
            <strong>Punto rosso pieno:</strong> una norma in vigore che rinvia ad almeno una norma
            cancellata. Chi la applica deve ricostruire da sé cosa si sia messo al posto del testo
            richiamato.
          </li>
          <li>
            <strong>Punto vuoto dal bordo sottile:</strong> una norma che qualcuno cita e di cui non
            abbiamo ancora il testo. È nel disegno perché il collegamento esiste, ed è vuota perché
            non l’abbiamo letta.
          </li>
          <li>
            <strong>Per guardarci dentro:</strong> rotella o doppio clic per avvicinarti, trascina
            per spostarti. Da tastiera, frecce per muoverti e <kbd>+</kbd> / <kbd>−</kbd> per
            l’ingrandimento. Le posizioni non cambiano mai: cambia solo da dove le guardi.
          </li>
        </ul>
      </section>

      {bersagli.length > 0 ? (
        <section className="sezione" aria-labelledby="buchi">
          <h2 id="buchi" className="sezione__titolo">
            I buchi, in numeri
          </h2>
          <p>
            Il disegno fa vedere la forma; i numeri esatti stanno qui. Sono{' '}
            {numero(puntanoAlVuoto.length)} norme che rinviano a {numero(morti.length)} testi
            cancellati.
          </p>
          <Tabella didascalia="Le norme abrogate, e quante norme in vigore continuano a richiamarle.">
            <thead>
              <tr>
                <th scope="col">Norma cancellata</th>
                <th scope="col">Norme in vigore che la richiamano</th>
              </tr>
            </thead>
            <tbody>
              {bersagli.map((b) => (
                <tr key={b.nodo.urn}>
                  <th scope="row">
                    <Link href={percorsoNorma(b.nodo.urn)}>{b.nodo.nome}</Link>
                  </th>
                  <td>{numero(b.quanti)}</td>
                </tr>
              ))}
            </tbody>
          </Tabella>
        </section>
      ) : null}

      <p className="riga-corpus">
        Il disegno è <strong>sempre lo stesso</strong>: le posizioni sono calcolate una volta dal
        dataset e non cambiano da un caricamento all’altro. Avvicinarsi sposta il punto di vista,
        non le norme — così questa mappa si può citare come si cita una pagina.{' '}
        <Link href="/mappa">Tutto il resto del sito</Link>.
      </p>
    </div>
  );
}
