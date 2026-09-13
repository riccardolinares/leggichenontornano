import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { paginaLegale } from '@/lib/legale';
import { data } from '@/lib/testo';

/*
 * L'anteprima dei termini di servizio.
 *
 * La frase dice la cosa che conta e che nessuno si aspetta da una pagina di
 * termini: quasi tutto è permesso, e l'unica condizione è citare la fonte.
 */

const PERCORSO = '/legal/termini';

export const alt =
  'Termini di servizio: codice EUPL 1.2, dati CC BY 4.0, attribuzione come unica condizione';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pagina = paginaLegale(PERCORSO);

  return new ImageResponse(
    cornice({
      occhiello: 'Termini di servizio',
      accento: OG.ocra,
      titolo:
        'Il codice è EUPL 1.2, i dati CC BY 4.0: si può rifare tutto da capo, con l’attribuzione come unica condizione.',
      nota: `Rivisti il ${data(pagina.aggiornataIl)}`,
    }),
    size,
  );
}
