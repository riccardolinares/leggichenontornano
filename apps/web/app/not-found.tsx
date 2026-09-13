import Link from 'next/link';

export const metadata = { title: 'Pagina non trovata' };

/**
 * Un URL pubblicato non viene rimosso (ADR 0008). Se si arriva qui, l'indirizzo
 * non è mai esistito o la norma non è nel corpus: sono due cose diverse e vanno
 * dette entrambe, perché «non l'abbiamo» non significa «non c'è».
 */
export default function NonTrovata() {
  return (
    <div className="contenitore stretto">
      <h1>Qui non c’è niente, ma poco più in là sì</h1>
      <p className="apertura">
        O l’indirizzo ha un refuso, oppure la norma che cerchi entrerà nel corpus a una delle
        prossime ingestioni. In entrambi i casi la strada più breve è ripartire dall’indice — e se
        ti serve quella norma in particolare, <Link href="/segnala">diccelo</Link>: è il modo più
        rapido per farla entrare.
      </p>
      <p className="azioni">
        <Link className="bottone bottone--primario" href="/">
          Vai all’indice delle segnalazioni
        </Link>
        <Link className="bottone" href="/dati">
          Guarda cosa contiene il corpus
        </Link>
      </p>
    </div>
  );
}
