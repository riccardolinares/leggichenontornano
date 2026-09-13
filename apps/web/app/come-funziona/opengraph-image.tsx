import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';

export const alt = 'Come funziona — cosa il progetto fa e cosa non fa';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  return new ImageResponse(
    cornice({
      occhiello: 'Come funziona',
      accento: OG.verderame,
      titolo:
        'Interrogazioni deterministiche sul grafo delle norme, testi originali in pagina, ogni regola in chiaro.',
      nota: 'Ogni segnalazione si può rifare da soli, con il dataset scaricabile.',
    }),
    size,
  );
}
