import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { paginaLegale } from '@/lib/legale';
import { data } from '@/lib/testo';

/*
 * L'anteprima della pagina sui cookie.
 *
 * La cifra è zero, ed è l'unico posto del sito in cui uno zero è
 * un'informazione invece che una casella vuota: è il numero che la pagina è
 * venuta a dire.
 */

const PERCORSO = '/legal/cookie';

export const alt = 'Questo sito non pone cookie: nessuno, e c’è un test che lo verifica';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const pagina = paginaLegale(PERCORSO);

  return new ImageResponse(
    cornice({
      occhiello: 'Cookie',
      accento: OG.verderame,
      cifra: '0',
      unita: 'cookie',
      titolo:
        'né tecnici, né di sessione, né di terze parti. Non c’è un banner perché non c’è niente da chiedere.',
      nota: `C’è un test che lo verifica a ogni build · rivista il ${data(pagina.aggiornataIl)}`,
    }),
    size,
  );
}
