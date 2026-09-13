import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { paginaLegale } from '@/lib/legale';
import { data } from '@/lib/testo';

/*
 * L'anteprima dell'informativa privacy.
 *
 * Senza cifra: il numero che conterebbe qui sarebbe «quanti dati raccogliamo»,
 * e la risposta onesta è «nessuno finché non ci scrivi». Una cifra grande a
 * schermo intero direbbe il contrario di quello che la pagina dice.
 *
 * La data è quella della revisione del testo, non della build: chi manda
 * questo link a un collega sta chiedendo «a quando risale», e la risposta
 * deve arrivare con l'immagine.
 */

const PERCORSO = '/legal/privacy';

export const alt = 'Informativa privacy: il sito non pone cookie e riceve solo quello che scrivi';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pagina = paginaLegale(PERCORSO);

  return new ImageResponse(
    cornice({
      occhiello: 'Informativa privacy',
      accento: OG.verderame,
      titolo:
        'Il sito non pone cookie e non misura chi legge. L’unico dato che riceve è quello che scrivi nel modulo.',
      nota: `Rivista il ${data(pagina.aggiornataIl)}`,
    }),
    size,
  );
}
