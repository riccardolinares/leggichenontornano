import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/** L'anteprima della mappa del sito: quante cose ci sono, in una riga. */

export const alt = 'Tutto quello che c’è nel sito, in una pagina';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const reader = dataset();

  return new ImageResponse(
    cornice({
      occhiello: 'Mappa del sito',
      accento: OG.verderame,
      cifra: numero(reader.publishedAnomalies().length),
      unita: 'segnalazioni',
      titolo: `più ${numero(reader.data.acts.length)} norme e ${numero(reader.pronunce().length)} pronunce, tutte raggiungibili da qui.`,
      nota: 'Ogni pagina ha un indirizzo stabile, pensato per essere citato.',
    }),
    size,
  );
}
