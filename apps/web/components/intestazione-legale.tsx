import Link from 'next/link';
import { paginaLegale } from '@/lib/legale';
import { data } from '@/lib/testo';

/**
 * Il titolo di una pagina legale, con la data della sua ultima revisione.
 *
 * La data sta in cima e non in fondo perché è la prima cosa che serve a chi
 * arriva: un'informativa è vera a una data, e senza quella data chi legge non
 * sa se sta guardando le condizioni di oggi o quelle di due anni fa. In fondo
 * alla pagina la vedrebbe dopo aver deciso se fidarsi.
 *
 * Viene dall'elenco in `lib/legale.ts`, non dal testo della pagina: così la si
 * cambia dove si cambia la sostanza, e non c'è modo di ritoccare un paragrafo
 * dimenticando la riga che dice quando lo si è fatto.
 */
export function IntestazioneLegale({ percorso }: { percorso: string }) {
  const pagina = paginaLegale(percorso);
  return (
    <>
      <h1>{pagina.titolo}</h1>
      <p className="legale-data">
        <strong>Ultimo aggiornamento: {data(pagina.aggiornataIl)}.</strong>{' '}
        <Link href="/legal">Tutte le pagine legali</Link>
      </p>
    </>
  );
}
