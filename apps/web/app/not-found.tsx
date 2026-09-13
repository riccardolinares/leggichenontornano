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
      <h1>Questo indirizzo non porta da nessuna parte</h1>
      <p className="apertura">
        O l’indirizzo è sbagliato, oppure la norma che cerchi non è ancora nel corpus che abbiamo
        ingerito. Sono due cose diverse: la seconda non significa che la norma non esista.
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
