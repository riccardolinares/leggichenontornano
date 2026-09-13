import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { grafo } from '@/lib/grafo';
import { numero } from '@/lib/testo';

/*
 * L'anteprima della mappa viva.
 *
 * La pagina è nata senza, ed è arrivata così in produzione: il ramo che l'ha
 * scritta aveva unito `main` prima che `main` avesse il controllo sulle
 * anteprime, e la fusione finale non rimette in moto la verifica. Il difetto
 * non stava in nessuno dei due rami — stava fra i due.
 *
 * La cifra è il numero di norme del grafo, la stessa di `/grafo`: le due
 * pagine mostrano lo stesso ordinamento, e un'anteprima che dicesse cifre
 * diverse farebbe sembrare che siano due dataset.
 */

export const alt = 'La mappa viva delle leggi italiane: la simulazione gira nel browser';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const g = grafo();

  return new ImageResponse(
    cornice({
      occhiello: 'La mappa viva',
      accento: OG.verderame,
      cifra: numero(g.nodi.length),
      unita: 'norme',
      titolo: 'e i legami che le tengono insieme, con le forze accese: si prendono e si tirano.',
      nota: 'Il disegno cambia a ogni caricamento. Per la mappa citabile: /grafo',
    }),
    size,
  );
}
