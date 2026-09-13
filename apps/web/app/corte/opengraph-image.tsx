import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, FONTE_CONSULTA, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/*
 * L'anteprima delle pronunce.
 *
 * La fonte è la Corte costituzionale, non Normattiva: cambia la licenza, e
 * attribuire una sentenza alla banca dati sbagliata è un errore di licenza,
 * non di stile.
 */

export const alt = 'Le dichiarazioni di illegittimità che colpiscono il corpus';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pronunce = dataset().pronunce();

  return new ImageResponse(
    cornice({
      occhiello: 'Pronunce della Consulta',
      accento: OG.ossido,
      cifra: numero(pronunce.length),
      unita: pronunce.length === 1 ? 'decisione' : 'decisioni',
      titolo:
        'della Corte costituzionale che colpiscono norme di questo corpus, con le sue parole.',
      nota: 'Dichiarare illegittima una norma spetta alla Corte: qui si collega al testo che colpisce.',
      fonte: FONTE_CONSULTA,
    }),
    size,
  );
}
