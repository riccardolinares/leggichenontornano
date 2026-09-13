import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/*
 * L'anteprima della home.
 *
 * La cifra è quella che il sito dichiara in apertura, letta dallo stesso
 * dataset che genera la pagina: un'anteprima che promette un numero diverso da
 * quello che il lettore trova dopo il clic è un piccolo tradimento, e si
 * ricorda.
 */

export const alt = 'Le leggi che non tornano — le incongruenze della legislazione italiana';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pubblicate = dataset().publishedAnomalies().length;

  return new ImageResponse(
    cornice(
      pubblicate > 0
        ? {
            occhiello: 'Le leggi che non tornano',
            accento: OG.ossido,
            cifra: numero(pubblicate),
            unita: 'segnalazioni',
            titolo:
              'Punti in cui la legislazione italiana non torna, con i testi e la regola che li ha trovati.',
            nota: 'Ogni segnalazione mostra le sue prove e i suoi limiti.',
          }
        : {
            occhiello: 'Le leggi che non tornano',
            accento: OG.verderame,
            titolo:
              'Incongruenze, contraddizioni e aree grigie della legislazione italiana, con le prove e la regola che le ha trovate.',
          },
    ),
    size,
  );
}
