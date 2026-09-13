import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

export const alt = 'Dati e precisione — il dataset e la precisione misurata di ogni controllo';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const reader = dataset();
  const inCoda = reader.data.anomalies.filter((a) => !a.published).length;

  return new ImageResponse(
    cornice({
      occhiello: 'Dati e precisione',
      accento: OG.ocra,
      ...(inCoda > 0 ? { cifra: numero(inCoda), unita: 'in coda' } : {}),
      titolo:
        inCoda > 0
          ? 'Segnalazioni che non pubblichiamo, perché la loro precisione non è ancora misurata.'
          : 'Quanto è grande il corpus, quanto è precisa ogni regola, e cosa non pubblichiamo.',
      nota: 'Si pubblica sopra l’85% di precisione misurata su almeno 30 revisioni.',
    }),
    size,
  );
}
