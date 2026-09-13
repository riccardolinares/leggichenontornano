import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/*
 * L'anteprima della pagina dei numeri: il numero più grosso che abbiamo, con
 * accanto quello che misura davvero.
 *
 * «Giorni di ritardo» e non «provvedimenti mai adottati»: la seconda frase
 * funzionerebbe meglio e non la possiamo sostenere. Un'anteprima è il punto in
 * cui la tentazione di esagerare è massima, perché è la parte che viaggia.
 */

export const alt = 'I numeri delle leggi che non tornano';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const reader = dataset();
  const contatore = reader.counter();
  const pubblicate = reader.publishedAnomalies().length;

  if (contatore && contatore.totalDaysLate > 0) {
    return new ImageResponse(
      cornice({
        occhiello: 'I numeri',
        accento: OG.ossido,
        cifra: numero(contatore.totalDaysLate),
        unita: 'giorni',
        titolo: `di ritardo sui termini che la legge si era data per ${numero(contatore.mandates)} provvedimenti attuativi.`,
        nota: 'Conta i termini scaduti: il decreto può essere arrivato in ritardo.',
      }),
      size,
    );
  }

  return new ImageResponse(
    cornice({
      occhiello: 'I numeri',
      accento: OG.ossido,
      ...(pubblicate > 0 ? { cifra: numero(pubblicate), unita: 'segnalazioni' } : {}),
      titolo: 'Le cifre più dure che questo dataset sostiene, con quello che non dicono accanto.',
    }),
    size,
  );
}
