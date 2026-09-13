'use client';

import { useState } from 'react';

/**
 * Strumenti di condivisione.
 *
 * Un solo bottone con JavaScript, e fa una cosa sola: copiare l'URL. Tutto il
 * resto sono collegamenti normali, che funzionano anche senza JavaScript e che
 * un browser può aprire in una nuova scheda come qualunque altro link.
 *
 * Nessun widget di terze parti: caricherebbe codice che traccia chi legge una
 * pagina su una legge. Per un progetto civico è una riga da non superare.
 */
export function Condivisione({ url, titolo }: { url: string; titolo: string }) {
  const [copiato, setCopiato] = useState(false);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 4000);
    } catch {
      // Se la clipboard non è disponibile l'URL resta comunque visibile e
      // selezionabile qui sotto: non si perde nulla.
      setCopiato(false);
    }
  };

  return (
    <div className="azioni">
      <button type="button" className="bottone" onClick={copia}>
        {copiato ? 'Indirizzo copiato' : 'Copia l’indirizzo'}
      </button>
      <a
        className="bottone"
        href={`https://mastodon.social/share?text=${encodeURIComponent(`${titolo} ${url}`)}`}
        rel="noopener"
      >
        Condividi su Mastodon
      </a>
      <a
        className="bottone"
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titolo)}`}
        rel="noopener"
      >
        Condividi su Telegram
      </a>
      {/* Il messaggio di conferma va annunciato, non solo mostrato. */}
      <span role="status" aria-live="polite" className="solo-lettori-schermo">
        {copiato ? 'Indirizzo copiato negli appunti.' : ''}
      </span>
    </div>
  );
}
