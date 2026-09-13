import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';

/*
 * L'anteprima del modulo di segnalazione.
 *
 * Senza cifra: qui non c'è un numero da sostenere, c'è un invito. Metterci
 * quante segnalazioni sono arrivate sarebbe la cosa più facile e la meno
 * onesta — è un dato che non pubblichiamo e che non misuriamo.
 */

export const alt = 'Qualcosa non torna? Aiutaci a migliorare il sito';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  return new ImageResponse(
    cornice({
      occhiello: 'Qualcosa non torna?',
      accento: OG.ocra,
      titolo:
        'Se una segnalazione è sbagliata, diccelo: diventa una discussione pubblica, non una mail.',
      nota: 'Non serve un account: il modulo apre la segnalazione al posto tuo.',
    }),
    size,
  );
}
