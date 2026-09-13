import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { paginaLegale } from '@/lib/legale';
import { data } from '@/lib/testo';

/*
 * L'anteprima della limitazione di responsabilità.
 *
 * La frase è quella che la pagina esiste per dire: il testo che fa fede resta
 * la Gazzetta. Senza cifra, perché qui una cifra grande darebbe l'idea di una
 * misura dove invece c'è un limite.
 */

const PERCORSO = '/legal/disclaimer';

export const alt = 'Il testo che fa fede resta quello della Gazzetta Ufficiale';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pagina = paginaLegale(PERCORSO);

  return new ImageResponse(
    cornice({
      occhiello: 'Limitazione di responsabilità',
      accento: OG.ossido,
      titolo:
        'Il testo che fa fede resta quello della Gazzetta Ufficiale. Qui trovi da dove nasce ogni affermazione, e come contestarla.',
      nota: `Rivista il ${data(pagina.aggiornataIl)}`,
    }),
    size,
  );
}
