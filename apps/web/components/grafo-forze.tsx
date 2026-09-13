'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Grafo, NodoGrafo } from '@/lib/grafo';

/**
 * Il grafo, nel browser.
 *
 * **Non c'è nessuna simulazione qui dentro.** Le coordinate arrivano già
 * calcolate dal server (`lib/grafo.ts`), in modo deterministico: questo
 * componente disegna, filtra ed evidenzia. È la differenza fra un'immagine che
 * si può citare e una che cambia a ogni caricamento.
 *
 * Tre cose che il disegno deve fare, in ordine di importanza:
 *
 *  1. **far vedere il buco in un secondo** — il rosso non è decorativo, segna i
 *     collegamenti verso norme che non ci sono più;
 *  2. **restare condivisibile** — i filtri stanno nell'URL, quindi un link
 *     mandato a qualcuno riapre esattamente quello che si stava guardando;
 *  3. **uscire come immagine** — perché la maggior parte delle persone questo
 *     grafo lo vedrà in una chat, non qui.
 */

export type Filtri = {
  tipo: string | null;
  soloRotti: boolean;
  minGrado: number;
};

const COLORI = {
  vivo: 'var(--verderame)',
  morto: 'var(--ossido)',
  rotto: 'var(--ossido)',
  normale: 'var(--bordo-forte)',
};

function raggio(nodo: NodoGrafo): number {
  // Radice del grado: con centocinquanta nodi e un grado che va da uno a
  // cinquanta, una scala lineare renderebbe invisibile tutto tranne i due hub.
  // Le norme abrogate sono grandi a prescindere: sono i buchi, e il disegno
  // esiste per farli vedere.
  const base = 3 + Math.sqrt(nodo.grado) * 1.5;
  return nodo.abrogato ? Math.max(base, 16) : base;
}

export function GrafoForze({ grafo, base }: { grafo: Grafo; base: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);

  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [statoImmagine, setStatoImmagine] = useState<string | null>(null);

  /*
   * I filtri stanno nello stato, e l'URL li **rispecchia**.
   *
   * Il verso opposto — l'URL come unica fonte, letto da `useSearchParams` — è
   * più elegante e su questa pagina non funziona: è generata staticamente, e un
   * `router.replace` fa un giro dal server che non riporta indietro i parametri
   * aggiornati. Il risultato è una casella che si clicca e non cambia stato.
   *
   * Qui l'interfaccia risponde subito e `history.replaceState` tiene l'URL
   * allineato senza ricaricare niente: il link condiviso riapre esattamente
   * quello che si stava guardando, che è tutto il punto di questa pagina.
   */
  const [filtri, setFiltri] = useState<Filtri>(() => ({
    tipo: searchParams.get('tipo'),
    soloRotti: searchParams.get('rotti') === '1',
    minGrado: Number(searchParams.get('grado') ?? '0') || 0,
  }));

  // Alla prima resa in statico i parametri possono non esserci ancora: si
  // rileggono dall'indirizzo vero appena il componente è montato, altrimenti un
  // link con i filtri si aprirebbe senza filtri.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setFiltri({
      tipo: p.get('tipo'),
      soloRotti: p.get('rotti') === '1',
      minGrado: Number(p.get('grado') ?? '0') || 0,
    });
  }, []);

  const aggiorna = useCallback(
    (patch: Partial<Filtri>) => {
      setFiltri((precedenti) => {
        const nuovi = { ...precedenti, ...patch };
        const p = new URLSearchParams();
        if (nuovi.tipo) p.set('tipo', nuovi.tipo);
        if (nuovi.soloRotti) p.set('rotti', '1');
        if (nuovi.minGrado > 0) p.set('grado', String(nuovi.minGrado));
        const query = p.toString();
        window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
        return nuovi;
      });
    },
    [pathname],
  );

  const { archiVisibili, nodiVisibili } = useMemo(() => {
    const archi = grafo.archi.filter((a) => {
      if (filtri.tipo && a.tipo !== filtri.tipo) return false;
      if (filtri.soloRotti && !a.rotto) return false;
      return true;
    });
    const toccati = new Set(archi.flatMap((a) => [a.da, a.a]));
    const nodi = grafo.nodi.filter((n) => toccati.has(n.urn) && n.grado >= filtri.minGrado);
    const urnVisibili = new Set(nodi.map((n) => n.urn));
    return {
      archiVisibili: archi.filter((a) => urnVisibili.has(a.da) && urnVisibili.has(a.a)),
      nodiVisibili: nodi,
    };
  }, [grafo, filtri]);

  const posizione = useMemo(() => new Map(grafo.nodi.map((n) => [n.urn, n])), [grafo]);

  const vicini = useMemo(() => {
    if (!selezionato) return null;
    const insieme = new Set<string>([selezionato]);
    for (const a of archiVisibili) {
      if (a.da === selezionato) insieme.add(a.a);
      if (a.a === selezionato) insieme.add(a.da);
    }
    return insieme;
  }, [selezionato, archiVisibili]);

  const dettaglio = selezionato ? posizione.get(selezionato) : null;

  /**
   * L'immagine da condividere.
   *
   * L'SVG viene ridisegnato su una tela e trasformato in PNG **nel browser**,
   * senza librerie e senza mandare niente a nessuno. I colori sono variabili
   * CSS, che dentro un'immagine isolata non esistono più: vanno risolti prima,
   * altrimenti esce un rettangolo nero.
   */
  const condividiImmagine = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setStatoImmagine('Preparo l’immagine…');

    try {
      const stile = getComputedStyle(document.documentElement);
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', String(grafo.larghezza));
      clone.setAttribute('height', String(grafo.altezza));

      for (const el of clone.querySelectorAll<SVGElement>('*')) {
        for (const prop of ['fill', 'stroke'] as const) {
          const valore = el.getAttribute(prop);
          if (valore?.startsWith('var(')) {
            const nome = valore.slice(4, -1).trim();
            el.setAttribute(prop, stile.getPropertyValue(nome).trim() || '#14201c');
          }
        }
      }

      const sfondo = stile.getPropertyValue('--carta').trim() || '#f5f6f4';
      const sorgente = new XMLSerializer().serializeToString(clone);
      const immagine = new Image();
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sorgente)}`;

      await new Promise<void>((risolvi, rifiuta) => {
        immagine.onload = () => risolvi();
        immagine.onerror = () => rifiuta(new Error('immagine non caricata'));
        immagine.src = url;
      });

      const tela = document.createElement('canvas');
      // Il doppio della risoluzione: un PNG condiviso finisce su schermi
      // fitti, e una mappa sgranata non la guarda nessuno.
      tela.width = grafo.larghezza * 2;
      tela.height = grafo.altezza * 2;
      const ctx = tela.getContext('2d');
      if (!ctx) throw new Error('tela non disponibile');
      ctx.fillStyle = sfondo;
      ctx.fillRect(0, 0, tela.width, tela.height);
      ctx.drawImage(immagine, 0, 0, tela.width, tela.height);

      const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, 'image/png'));
      if (!blob) throw new Error('conversione fallita');

      const file = new File([blob], 'leggi-che-non-tornano.png', { type: 'image/png' });
      const url_pagina = `${base}${window.location.pathname}${window.location.search}`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Le leggi che non tornano',
          text: 'Le leggi italiane in vigore, e i collegamenti a norme che non esistono più.',
          url: url_pagina,
        });
        setStatoImmagine(null);
        return;
      }

      // Niente foglio di condivisione: si scarica, e il link resta negli
      // appunti perché l'immagine da sola non porta da nessuna parte.
      const scarica = document.createElement('a');
      scarica.href = URL.createObjectURL(blob);
      scarica.download = 'leggi-che-non-tornano.png';
      scarica.click();
      URL.revokeObjectURL(scarica.href);
      try {
        await navigator.clipboard.writeText(url_pagina);
        setStatoImmagine('Immagine scaricata, e il link è negli appunti.');
      } catch {
        setStatoImmagine('Immagine scaricata.');
      }
    } catch {
      setStatoImmagine('Non è stato possibile creare l’immagine su questo browser.');
    }
  }, [base, grafo.altezza, grafo.larghezza]);

  useEffect(() => {
    if (!statoImmagine) return;
    const t = window.setTimeout(() => setStatoImmagine(null), 6000);
    return () => window.clearTimeout(t);
  }, [statoImmagine]);

  const rotti = archiVisibili.filter((a) => a.rotto).length;

  return (
    <div className="grafo">
      <div className="grafo__comandi">
        <div className="grafo__filtro">
          <label htmlFor="grafo-tipo">Tipo di collegamento</label>
          <select
            id="grafo-tipo"
            value={filtri.tipo ?? ''}
            onChange={(e) => aggiorna({ tipo: e.target.value || null })}
          >
            <option value="">Tutti</option>
            {grafo.tipi.map((t) => (
              <option key={t} value={t}>
                {t.toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="grafo__filtro">
          <label htmlFor="grafo-grado">Solo norme con almeno {filtri.minGrado} collegamenti</label>
          <input
            id="grafo-grado"
            type="range"
            min={0}
            max={40}
            step={5}
            value={filtri.minGrado}
            onChange={(e) => aggiorna({ minGrado: Number(e.target.value) })}
          />
        </div>

        <div className="grafo__filtro grafo__filtro--interruttore">
          <input
            id="grafo-rotti"
            type="checkbox"
            checked={filtri.soloRotti}
            onChange={(e) => aggiorna({ soloRotti: e.target.checked })}
          />
          <label htmlFor="grafo-rotti">Solo i collegamenti a norme cancellate</label>
        </div>

        <button type="button" className="bottone bottone--primario" onClick={condividiImmagine}>
          Condividi come immagine
        </button>
      </div>

      <p className="grafo__conteggio" role="status" aria-live="polite">
        <strong>{nodiVisibili.length}</strong> norme in vigore,{' '}
        <strong>{archiVisibili.length}</strong> collegamenti, di cui{' '}
        <strong className="grafo__rosso">{rotti}</strong> verso norme che non esistono più.
        {statoImmagine ? ` ${statoImmagine}` : ''}
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${grafo.larghezza} ${grafo.altezza}`}
        className="grafo__tela"
        role="img"
        aria-label={`Grafo di ${nodiVisibili.length} norme italiane in vigore e ${archiVisibili.length} collegamenti fra loro. ${rotti} collegamenti puntano a norme abrogate e sono disegnati in rosso.`}
      >
        <g className="grafo__archi">
          {archiVisibili.map((a) => {
            const da = posizione.get(a.da);
            const verso = posizione.get(a.a);
            if (!da || !verso) return null;
            const attenuato = vicini ? !(vicini.has(a.da) && vicini.has(a.a)) : false;
            return (
              <line
                key={`${a.da}|${a.a}|${a.tipo}`}
                x1={da.x}
                y1={da.y}
                x2={verso.x}
                y2={verso.y}
                stroke={a.rotto ? COLORI.rotto : COLORI.normale}
                strokeWidth={a.rotto ? 1 : 0.4}
                opacity={attenuato ? 0.04 : a.rotto ? 0.45 : 0.1}
              />
            );
          })}
        </g>

        <g className="grafo__nodi">
          {[...nodiVisibili]
            // Ordine di disegno: chi è in ordine sotto, chi punta al vuoto
            // sopra, i buchi sopra a tutti. Senza, i due nodi che raccontano la
            // storia finiscono sepolti sotto cento cerchi rossi.
            .sort(
              (x, y) =>
                Number(x.abrogato) - Number(y.abrogato) ||
                Number(x.puntaAlVuoto) - Number(y.puntaAlVuoto),
            )
            .map((n) => {
              const attenuato = vicini ? !vicini.has(n.urn) : false;
              const colore = n.abrogato
                ? COLORI.morto
                : n.puntaAlVuoto
                  ? COLORI.morto
                  : COLORI.vivo;
              return (
                <circle
                  key={n.urn}
                  cx={n.x}
                  cy={n.y}
                  r={raggio(n)}
                  /* Un buco si disegna come un buco: chiaro al centro e cerchiato
                     di rosso. Fra cento cerchi rossi pieni, un altro cerchio
                     rosso pieno non si distingue — e sono proprio questi due i
                     nodi per cui la pagina esiste. */
                  fill={n.abrogato ? 'var(--carta)' : colore}
                  opacity={attenuato ? 0.1 : n.abrogato ? 1 : n.puntaAlVuoto ? 0.62 : 0.3}
                  stroke={n.abrogato ? COLORI.morto : 'none'}
                  strokeWidth={n.abrogato ? 7 : 0}
                  /* Nessun `tabIndex` e nessun `role` sui cerchi.
                     La tela è un `role="img"` con una descrizione completa, e
                     dentro un'immagine non possono stare controlli
                     raggiungibili da tastiera: axe lo segnala come
                     `nested-interactive`, ed è una violazione vera — uno screen
                     reader annuncerebbe centocinquanta bottoni dentro qualcosa
                     che ha già detto di essere una figura.
                     Il passaggio del mouse resta una comodità per chi vede;
                     l'equivalente accessibile è la tabella qui sotto, che dà le
                     stesse cifre in forma leggibile e citabile. */
                  onMouseEnter={() => setSelezionato(n.urn)}
                  onMouseLeave={() => setSelezionato(null)}
                />
              );
            })}
        </g>

        {/* Le scritte dentro l'immagine, non accanto.
            Questa pagina è fatta per essere condivisa come PNG, e un PNG
            viaggia senza la sua pagina: se il disegno non si spiega da solo,
            in una chat non dice niente. Titolo, legenda e i nomi dei due
            buchi stanno quindi dentro l'SVG, e finiscono nell'immagine. */}
        <g className="grafo__scritte" aria-hidden="true">
          <text x={24} y={38} className="grafo__titolo-tela">
            Le leggi italiane in vigore, e i loro collegamenti
          </text>
          <text x={24} y={60} className="grafo__sottotitolo-tela">
            In rosso i rinvii a norme che non esistono più — {rotti} su {archiVisibili.length}
          </text>

          {nodiVisibili
            .filter((n) => n.abrogato)
            .map((n, i) => {
              // Le etichette partono da due nodi vicinissimi e finirebbero una
              // sopra l'altra: si sfalsano, una in alto e una in basso, con una
              // linea di richiamo che dice a chi si riferiscono.
              const dy = i % 2 === 0 ? -95 : 105;
              return (
                <g key={`etichetta-${n.urn}`}>
                  <line
                    x1={n.x}
                    y1={n.y}
                    x2={n.x + 115}
                    y2={n.y + dy}
                    stroke="var(--carta)"
                    strokeWidth={0.7}
                    opacity={0.5}
                  />
                  <text x={n.x + 121} y={n.y + dy - 2} className="grafo__etichetta-tela">
                    {n.nome}
                  </text>
                  <text
                    x={n.x + 121}
                    y={n.y + dy + 13}
                    className="grafo__etichetta-tela grafo__etichetta-tela--debole"
                  >
                    abrogata, ancora richiamata da {n.grado} norme
                  </text>
                </g>
              );
            })}

          <text x={24} y={grafo.altezza - 20} className="grafo__firma-tela">
            leggichenontornano.it
          </text>
        </g>
      </svg>

      <div className="grafo__dettaglio" role="status" aria-live="polite">
        {dettaglio ? (
          <>
            <strong>{dettaglio.nome}</strong> — {dettaglio.grado} collegamenti
            {dettaglio.abrogato ? ', e non è più in vigore' : ''}
            {dettaglio.puntaAlVuoto && !dettaglio.abrogato
              ? ', rinvia ad almeno una norma cancellata'
              : ''}
            {dettaglio.segnalazioni > 0
              ? ` · ${dettaglio.segnalazioni} segnalazion${dettaglio.segnalazioni === 1 ? 'e' : 'i'}`
              : ''}
          </>
        ) : (
          'Passa sopra un nodo — o raggiungilo da tastiera — per sapere quale norma è.'
        )}
      </div>
    </div>
  );
}
