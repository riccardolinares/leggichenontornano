'use client';

import { useEffect, useState } from 'react';

/**
 * Strumenti di condivisione.
 *
 * Nessun widget di terze parti: caricherebbe codice che traccia chi legge una
 * pagina su una legge. Per un progetto civico è una riga da non superare. Qui
 * ci sono solo collegamenti normali, che funzionano anche senza JavaScript, e
 * due bottoni che fanno una cosa sola ciascuno.
 *
 * **I canali sono quelli che si usano in Italia.** WhatsApp prima di tutto: è
 * lì che un link su una legge viene girato davvero, nel gruppo dell'ufficio o
 * della categoria professionale. Poi Telegram, Facebook, X e LinkedIn. Non c'è
 * Instagram e non c'è TikTok perché non hanno un modo di ricevere un link da
 * una pagina web — ci si arriva dal foglio di condivisione del telefono, che è
 * esattamente quello che apre il primo bottone.
 */

function testoCondivisione(titolo: string, url: string): string {
  return `${titolo} ${url}`;
}

export function Condivisione({ url, titolo }: { url: string; titolo: string }) {
  const [copiato, setCopiato] = useState(false);
  // `navigator.share` non esiste su tutti i browser, e non si può sapere al
  // momento della generazione statica: si guarda dopo il montaggio, così il
  // markup del server e quello del client coincidono.
  const [condivisioneNativa, setCondivisioneNativa] = useState(false);

  useEffect(() => {
    setCondivisioneNativa(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
  }, []);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      window.setTimeout(() => setCopiato(false), 4000);
    } catch {
      // Se la clipboard non è disponibile l'URL resta comunque visibile e
      // selezionabile nella pagina: non si perde nulla.
      setCopiato(false);
    }
  };

  const condividi = async () => {
    try {
      await navigator.share({ title: titolo, url });
    } catch {
      // L'utente ha annullato, o il browser ha rifiutato: non è un errore da
      // mostrare. I collegamenti qui sotto restano.
    }
  };

  const testo = testoCondivisione(titolo, url);

  return (
    <div className="azioni">
      {condivisioneNativa ? (
        <button type="button" className="bottone bottone--primario" onClick={condividi}>
          Condividi
        </button>
      ) : null}

      <button type="button" className="bottone" onClick={copia}>
        {copiato ? 'Indirizzo copiato' : 'Copia l’indirizzo'}
      </button>

      <a
        className="bottone"
        href={`https://wa.me/?text=${encodeURIComponent(testo)}`}
        rel="noopener"
      >
        WhatsApp
      </a>
      <a
        className="bottone"
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(titolo)}`}
        rel="noopener"
      >
        Telegram
      </a>
      <a
        className="bottone"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        rel="noopener"
      >
        Facebook
      </a>
      <a
        className="bottone"
        href={`https://x.com/intent/post?text=${encodeURIComponent(titolo)}&url=${encodeURIComponent(url)}`}
        rel="noopener"
      >
        X
      </a>
      <a
        className="bottone"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        rel="noopener"
      >
        LinkedIn
      </a>

      {/* Il messaggio di conferma va annunciato, non solo mostrato. */}
      <span role="status" aria-live="polite" className="solo-lettori-schermo">
        {copiato ? 'Indirizzo copiato negli appunti.' : ''}
      </span>
    </div>
  );
}
