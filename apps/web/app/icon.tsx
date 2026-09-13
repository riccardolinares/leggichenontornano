import { ImageResponse } from 'next/og';

/**
 * La favicon, disegnata dal codice.
 *
 * Un file `.ico` binario nel repository invecchia in silenzio: cambia la
 * palette e nessuno se ne accorge. Questa la genera Next dal token di colore,
 * quindi resta allineata al resto per costruzione.
 *
 * Il segno è una riga che si spezza: è quello che fa una norma che rinvia a un
 * testo che non c'è più. A 32 pixel non si legge un simbolo complicato, e una
 * lettera dentro un cerchio l'avrebbero anche altri mille progetti.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#14201c',
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        {/* La riga intera: la norma che rinvia. */}
        <rect x="5" y="10" width="13" height="3" rx="1" fill="#f5f6f4" />
        {/* Il pezzo che manca: il rinvio che non trova destinazione. */}
        <rect x="21" y="10" width="6" height="3" rx="1" fill="#9e3323" />
        <rect x="5" y="16" width="22" height="3" rx="1" fill="#f5f6f4" opacity="0.55" />
        <rect x="5" y="22" width="9" height="3" rx="1" fill="#f5f6f4" opacity="0.3" />
      </svg>
    </div>,
    size,
  );
}
