import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, FONTE_NORMATTIVA, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/*
 * L'anteprima dell'elenco delle norme.
 *
 * La cifra che regge da sola non è il numero di atti — che non dice niente a
 * nessuno — ma **quante volte il corpus è stato riscritto**: le versioni sono
 * il contesto in cui le incongruenze nascono, ed è il numero che fa alzare un
 * sopracciglio a chi con quelle norme ci lavora.
 */

export const alt = 'Le norme del corpus, leggibili a qualunque data di vigenza';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const reader = dataset();
  const atti = reader.data.acts;
  const versioni = atti.reduce((somma, a) => somma + a.versionCount, 0);

  return new ImageResponse(
    cornice({
      occhiello: 'Le norme del corpus',
      accento: OG.verderame,
      cifra: numero(versioni),
      unita: 'versioni',
      titolo: `di ${numero(atti.length)} atti italiani, ciascuna leggibile alla data in cui era in vigore.`,
      nota: 'Il testo di una legge cambia; qui si vede quale versione valeva quando.',
      fonte: FONTE_NORMATTIVA,
    }),
    size,
  );
}
