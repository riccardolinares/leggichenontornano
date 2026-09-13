import { ImageResponse } from 'next/og';
import { PAGINE_LEGALI } from '@/lib/legale';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { numero } from '@/lib/testo';

/*
 * L'anteprima dell'indice delle pagine legali.
 *
 * Queste pagine non nascono per essere condivise, ma vengono citate: chi
 * verifica un progetto civico manda a un collega il link all'informativa, e
 * quel link deve arrivare con qualcosa sotto invece che con un rettangolo
 * vuoto. Il layout dichiara `summary_large_image` su **ogni** pagina del sito,
 * e una promessa dichiarata da tutti va mantenuta anche qui.
 *
 * La cifra è il numero di pagine, non una data: dice che sono poche e che si
 * leggono, che è esattamente il contrario di quello che chi legge si aspetta
 * da un blocco di testo legale.
 */

export const alt = 'Le pagine legali di Le leggi che non tornano, scritte sui fatti del sito';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  return new ImageResponse(
    cornice({
      occhiello: 'Pagine legali',
      accento: OG.verderame,
      cifra: numero(PAGINE_LEGALI.length),
      unita: 'pagine',
      titolo:
        'scritte sui fatti di questo sito: cosa riceve davvero, dove finisce, cosa puoi farci.',
      nota: 'Ognuna porta in cima la data in cui è stata rivista.',
    }),
    size,
  );
}
