'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * «Qualcosa non torna?»
 *
 * Il modulo esiste perché il canale che avevamo — aprire una issue su GitHub —
 * funziona per chi ha un account GitHub, cioè per una minoranza di chi usa
 * questo sito. Un funzionario che nota un dato sbagliato non si registra su una
 * piattaforma per dircelo: chiude la pagina, e quel dato resta sbagliato.
 *
 * Qui compila tre campi e la issue la apriamo noi. Se il server non è
 * configurato per farlo, il modulo **non finge**: apre la issue precompilata su
 * GitHub, che è quello che si poteva fare prima.
 */

type Stato =
  | { tipo: 'fermo' }
  | { tipo: 'invio' }
  | { tipo: 'fatto'; url?: string }
  | { tipo: 'ripiego'; url: string }
  | { tipo: 'errore'; messaggio: string };

const TIPI = [
  { valore: 'dato', etichetta: 'Un dato sembra sbagliato' },
  { valore: 'pagina', etichetta: 'Una pagina non funziona' },
  { valore: 'chiarezza', etichetta: 'C’è scritto qualcosa che non si capisce' },
  { valore: 'accessibilita', etichetta: 'Non riesco a usare il sito' },
  { valore: 'altro', etichetta: 'Altro' },
] as const;

export function SegnalaProblema({
  repoUrl,
  paginaIniziale,
}: {
  repoUrl: string;
  paginaIniziale?: string;
}) {
  const [tipo, setTipo] = useState<string>('dato');
  const [messaggio, setMessaggio] = useState('');
  const [contatto, setContatto] = useState('');
  const [sitoWeb, setSitoWeb] = useState('');
  const [stato, setStato] = useState<Stato>({ tipo: 'fermo' });

  const pagina = paginaIniziale ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  const urlDiRipiego = (): string => {
    const titolo = `Segnalazione dal sito${pagina ? ` — ${pagina}` : ''}`;
    const corpo = [messaggio, '', `Tipo: ${tipo}`, `Pagina: ${pagina || 'non indicata'}`].join(
      '\n',
    );
    return `${repoUrl}/issues/new?title=${encodeURIComponent(titolo)}&body=${encodeURIComponent(corpo)}&labels=${encodeURIComponent('da-triage')}`;
  };

  const invia = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (messaggio.trim().length < 30) {
      setStato({
        tipo: 'errore',
        messaggio: 'Servono almeno trenta caratteri: cosa avete visto, e dove.',
      });
      return;
    }
    setStato({ tipo: 'invio' });

    try {
      const risposta = await fetch('/api/segnalazione', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo, pagina, messaggio, contatto, sitoWeb }),
      });
      const dati = (await risposta.json()) as { errore?: string; url?: string };

      if (risposta.ok) {
        setStato({ tipo: 'fatto', ...(dati.url ? { url: dati.url } : {}) });
        setMessaggio('');
        setContatto('');
        return;
      }
      if (
        dati.errore === 'apertura-automatica-non-configurata' ||
        dati.errore === 'apertura-automatica-non-disponibile'
      ) {
        setStato({ tipo: 'ripiego', url: urlDiRipiego() });
        return;
      }
      setStato({ tipo: 'errore', messaggio: dati.errore ?? 'Non è andata: riprovate fra poco.' });
    } catch {
      // La rete può non esserci. Meglio offrire la strada alternativa che
      // lasciare chi segnala davanti a un modulo che non risponde.
      setStato({ tipo: 'ripiego', url: urlDiRipiego() });
    }
  };

  if (stato.tipo === 'fatto') {
    return (
      <div className="segnala segnala--fatto" role="status">
        <p>
          <strong>Ricevuta, grazie.</strong> È diventata una segnalazione pubblica: chiunque può
          leggerla, e resta lì finché non le abbiamo risposto.
        </p>
        {stato.url ? (
          <p className="azioni">
            <a className="bottone" href={stato.url} rel="noopener">
              Guarda la segnalazione
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="segnala" onSubmit={invia}>
      <div className="segnala__campo">
        <label htmlFor="segnala-tipo">Che tipo di problema è</label>
        <select id="segnala-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPI.map((t) => (
            <option key={t.valore} value={t.valore}>
              {t.etichetta}
            </option>
          ))}
        </select>
      </div>

      <div className="segnala__campo">
        <label htmlFor="segnala-messaggio">Che cosa avete visto</label>
        <p id="segnala-aiuto" className="segnala__aiuto">
          Più è concreto, più è utile: quale pagina, quale numero, cosa vi aspettavate di trovare.
          Non serve essere gentili né tecnici.
        </p>
        {/* Niente `minLength`: il controllo nativo blocca l'invio con un
            fumetto del browser, che gli screen reader annunciano in modo
            incostante e che sparisce da solo. Il messaggio lo diamo noi, in
            pagina e dentro un `role="status"`, dove chi ascolta lo sente. */}
        <textarea
          id="segnala-messaggio"
          aria-describedby="segnala-aiuto"
          required
          maxLength={5000}
          rows={6}
          value={messaggio}
          onChange={(e) => setMessaggio(e.target.value)}
        />
      </div>

      <div className="segnala__campo">
        <label htmlFor="segnala-contatto">
          Dove rispondervi <span className="segnala__facoltativo">(facoltativo)</span>
        </label>
        <p id="segnala-contatto-aiuto" className="segnala__aiuto">
          Una mail, se volete sapere com’è finita. Senza, la segnalazione vale uguale.
        </p>
        <input
          id="segnala-contatto"
          type="email"
          aria-describedby="segnala-contatto-aiuto"
          value={contatto}
          onChange={(e) => setContatto(e.target.value)}
        />
      </div>

      {/* Campo esca: nascosto a chi vede e a chi ascolta, lo riempiono solo i
          programmi. `aria-hidden` più `tabIndex={-1}` perché non finisca né
          nello screen reader né nel percorso da tastiera. */}
      <div className="segnala__esca" aria-hidden="true">
        <label htmlFor="segnala-sito">Non compilare questo campo</label>
        <input
          id="segnala-sito"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={sitoWeb}
          onChange={(e) => setSitoWeb(e.target.value)}
        />
      </div>

      <p className="segnala__nota">
        La segnalazione diventa una <strong>issue pubblica</strong> su GitHub, con quello che avete
        scritto. Non metteteci dati personali che non volete pubblici.{' '}
        <Link href="/legal/privacy">Che fine fa quello che scrivete</Link>.
      </p>

      <div className="azioni">
        <button
          type="submit"
          className="bottone bottone--primario"
          disabled={stato.tipo === 'invio'}
        >
          {stato.tipo === 'invio' ? 'Mando…' : 'Manda la segnalazione'}
        </button>
        <a className="bottone" href={`${repoUrl}/issues/new`}>
          Preferisco aprirla su GitHub
        </a>
      </div>

      <p role="status" aria-live="polite" className="segnala__esito">
        {stato.tipo === 'errore' ? stato.messaggio : null}
        {stato.tipo === 'ripiego' ? (
          <>
            L’apertura automatica non è attiva su questo sito.{' '}
            <a href={stato.url} rel="noopener">
              Aprite la segnalazione su GitHub
            </a>
            : il testo che avete scritto è già dentro.
          </>
        ) : null}
      </p>
    </form>
  );
}
