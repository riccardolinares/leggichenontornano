import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';

export const alt = 'Per la stampa — dataset, frase citabile e contatti';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  return new ImageResponse(
    cornice({
      occhiello: 'Per la stampa',
      accento: OG.ocra,
      titolo:
        'Il dataset è scaricabile, le query sono pubbliche, e ogni cifra si può rifare da soli.',
      nota: 'Scrivici: rispondiamo anche quando la risposta è «non lo sappiamo».',
    }),
    size,
  );
}
