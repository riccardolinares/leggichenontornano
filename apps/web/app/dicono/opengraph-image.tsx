import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';

/*
 * L'anteprima di «Dicono di noi».
 *
 * Nessuna cifra, e non per dimenticanza: finché la pagina è vuota, un numero
 * sarebbe uno zero grande che viaggia da solo. Quando ci saranno testimonianze
 * vere sarà il momento di metterle qui — non prima.
 */

export const alt = 'Chi usa il progetto, e cosa ne ha scritto';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  return new ImageResponse(
    cornice({
      occhiello: 'Dicono di noi',
      accento: OG.verderame,
      titolo: 'Chi usa questo progetto per lavoro, e cosa ci ha scritto.',
      nota: 'Ogni voce porta il link a quello che è stato pubblicato: niente frasi senza fonte.',
    }),
    size,
  );
}
