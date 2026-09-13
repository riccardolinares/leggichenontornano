import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, FONTE_NORMATTIVA, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/*
 * L'anteprima dell'indice delle segnalazioni.
 *
 * La cifra è quante ne sono pubblicate — non quante ne sono state trovate:
 * fra le due c'è la soglia di pubblicazione, ed è la differenza che rende
 * citabile questo numero.
 */

export const alt = 'Tutte le segnalazioni pubblicate, con le prove e la regola che le ha trovate';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pubblicate = dataset().publishedAnomalies();

  return new ImageResponse(
    cornice({
      occhiello: 'Tutte le segnalazioni',
      accento: OG.ossido,
      cifra: numero(pubblicate.length),
      unita: pubblicate.length === 1 ? 'punto' : 'punti',
      titolo: 'in cui la legislazione italiana non torna, ciascuno con i testi originali davanti.',
      nota: 'Ogni voce porta la regola che l’ha trovata e i suoi limiti dichiarati.',
      fonte: FONTE_NORMATTIVA,
    }),
    size,
  );
}
