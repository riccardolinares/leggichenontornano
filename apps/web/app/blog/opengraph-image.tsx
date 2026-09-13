import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { articoli } from '@/lib/blog';
import { numero } from '@/lib/testo';

export const alt = 'Approfondimenti — una legge che non torna al giorno';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const quanti = articoli().length;
  return new ImageResponse(
    cornice({
      occhiello: 'Approfondimenti',
      accento: OG.verderame,
      ...(quanti > 0 ? { cifra: numero(quanti), unita: quanti === 1 ? 'storia' : 'storie' } : {}),
      titolo:
        quanti > 0
          ? 'di leggi che non tornano, ciascuna con i testi originali e la regola che l’ha trovata.'
          : 'Un approfondimento al giorno su una legge che non torna, a partire da una segnalazione verificabile.',
      nota: 'Cosa succede in pratica, a chi, e da quanto.',
    }),
    size,
  );
}
