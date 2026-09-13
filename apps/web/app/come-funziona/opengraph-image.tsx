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
        'Nessun modello che giudica le norme. Query deterministiche sul grafo, testi originali, e i limiti dichiarati.',
      nota: 'Assenza di segnale non significa norma coerente.',
    }),
    size,
  );
}
