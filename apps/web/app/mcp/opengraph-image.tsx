import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero } from '@/lib/testo';

/*
 * L'anteprima della pagina MCP.
 *
 * Questa è la pagina che gira fra chi sviluppa, e il link finisce in chat dove
 * di questo progetto non sa niente nessuno: la cifra serve a dire in un colpo
 * che cosa si collega, non che esiste un server.
 */

export const alt = 'Il corpus delle leggi italiane dentro il tuo assistente, via MCP';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const reader = dataset();

  return new ImageResponse(
    cornice({
      occhiello: 'Server MCP',
      accento: OG.verderame,
      cifra: numero(reader.data.acts.length),
      unita: 'norme',
      titolo: `interrogabili dal tuo assistente mentre risponde, con le date di vigenza e le fonti.`,
      nota: 'npx -y @leggichenontornano/mcp — nessun account, nessuna chiave.',
    }),
    size,
  );
}
