import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { grafo } from '@/lib/grafo';
import { numero } from '@/lib/testo';

/*
 * L'anteprima della mappa.
 *
 * Non prova a mostrare il grafo: un disegno di centocinquanta nodi, rimpicciolito
 * a un'anteprima che qualcuno guarda per due secondi dentro una chat, diventa
 * una macchia grigia. Meglio la cifra che il grafo fa vedere.
 */

export const alt = 'La mappa delle leggi italiane in vigore';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const g = grafo();
  const rotti = g.archi.filter((a) => a.rotto).length;

  return new ImageResponse(
    cornice({
      occhiello: 'La mappa delle leggi in vigore',
      accento: OG.ossido,
      cifra: numero(rotti),
      unita: 'fili rossi',
      titolo:
        'collegamenti fra leggi italiane in vigore e testi che non esistono più. Nella mappa si vedono in un secondo.',
      nota: `${numero(g.nodi.length)} norme, ${numero(g.archi.length)} collegamenti`,
    }),
    size,
  );
}
