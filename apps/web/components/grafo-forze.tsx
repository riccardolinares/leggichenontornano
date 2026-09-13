'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ETICHETTA_FAMIGLIA, type Famiglia, type Grafo, type NodoGrafo } from '@/lib/grafo-tipi';

/**
 * Il grafo, nel browser.
 *
 * **Nessuna simulazione gira qui dentro.** Le coordinate arrivano già calcolate
 * dal server (`lib/grafo.ts`), in modo deterministico: questo componente
 * disegna, filtra, evidenzia e lascia avvicinare. È la differenza fra
 * un'immagine che si può citare e una che cambia a ogni caricamento.
 *
 * Lo zoom non contraddice quella regola, e vale la pena dire perché: cambia il
 * **punto di vista**, non il disegno. Due persone che aprono lo stesso link
 * vedono le stesse norme nelle stesse posizioni; una delle due ci sta più
 * vicino. Ed è indispensabile, perché duecento nodi in una schermata sono
 * leggibili come forma e illeggibili come nomi: senza avvicinarsi, la domanda
 * «e quella lì quale sarebbe?» non ha risposta.
 *
 * Tre cose che il disegno deve fare, in ordine di importanza:
 *
 *  1. **far vedere la forma in un secondo** — pochi perni fittissimi, e attorno
 *     tutto il resto che li tira in ballo;
 *  2. **dire che cosa sono i legami** — un colore per famiglia, e il rosso
 *     riservato a una cosa sola: il bersaglio non c'è più;
 *  3. **restare condivisibile** — i filtri stanno nell'URL e il disegno esce
 *     come immagine, perché la maggior parte delle persone lo vedrà in una chat.
 */

export type Filtri = {
  famiglia: Famiglia | null;
  soloRotti: boolean;
  minGrado: number;
};

/**
 * Un colore per famiglia, e il rosso che non si divide con nessuno.
 *
 * Il rosso vuol dire «il bersaglio non esiste più», e basta. Se lo usassimo
 * anche per «questa norma ne cancella un'altra» — che è un atto legittimo e
 * quotidiano — il disegno direbbe due cose con lo stesso segno, cioè non ne
 * direbbe nessuna.
 */
const COLORE_FAMIGLIA: Record<Famiglia, string> = {
  rinvio: 'var(--grafo-rinvio)',
  modifica: 'var(--grafo-modifica)',
  abrogazione: 'var(--grafo-abrogazione)',
  attuazione: 'var(--grafo-attuazione)',
  illegittimita: 'var(--grafo-illegittimita)',
};

const COLORE_ROTTO = 'var(--grafo-rotto)';
const COLORE_MORTO = 'var(--grafo-rotto)';
const COLORE_VIVO = 'var(--grafo-vivo)';
const COLORE_SFONDO = 'var(--grafo-fondo)';

/** Quante norme portano il nome scritto sul disegno. */
const QUANTE_ETICHETTE = 7;

const ZOOM_MIN = 1;
const ZOOM_MAX = 12;

function raggio(nodo: NodoGrafo): number {
  /* Radice del grado: con duecento nodi e un grado che va da uno a qualche
     centinaio, una scala lineare renderebbe invisibile tutto tranne i perni.
     Le norme abrogate hanno comunque un minimo: sono i buchi, ed è per farli
     vedere che questa pagina esiste. */
  const base = 3 + Math.sqrt(nodo.grado) * 1.6;
  return nodo.abrogato ? Math.max(base, 18) : base;
}

export function GrafoForze({ grafo, base }: { grafo: Grafo; base: string }) {
  const pathname = usePathname();
  const svgRef = useRef<SVGSVGElement>(null);
  const telaRef = useRef<HTMLDivElement>(null);

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
   * **Lo stato iniziale non guarda l'URL, e non è una svista.** La pagina è
   * generata una volta sola, senza parametri: il server disegna il grafo
   * intero. Se qui leggessimo i filtri, il browser partirebbe da uno stato
   * diverso da quello che il server ha appena scritto nell'HTML, e React
   * butterebbe via l'idratazione con l'errore 418 — visibile aprendo
   * `/grafo?rotti=1` con la console aperta.
   *
   * I filtri dell'indirizzo si applicano quindi subito **dopo** il montaggio,
   * qui sotto. Il prezzo è che per un istante si vede il grafo intero prima di
   * quello filtrato; l'alternativa era una pagina che si ricostruisce da capo
   * nel browser, su duecento nodi e millecinquecento archi.
   */
  const [filtri, setFiltri] = useState<Filtri>({
    famiglia: null,
    soloRotti: false,
    minGrado: 0,
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const famiglia = (p.get('legame') as Famiglia | null) ?? null;
    const soloRotti = p.get('rotti') === '1';
    const minGrado = Number(p.get('grado') ?? '0') || 0;
    if (!famiglia && !soloRotti && !minGrado) return;
    setFiltri({ famiglia, soloRotti, minGrado });
  }, []);

  const aggiorna = useCallback(
    (patch: Partial<Filtri>) => {
      setFiltri((precedenti) => {
        const nuovi = { ...precedenti, ...patch };
        const p = new URLSearchParams();
        if (nuovi.famiglia) p.set('legame', nuovi.famiglia);
        if (nuovi.soloRotti) p.set('rotti', '1');
        if (nuovi.minGrado > 0) p.set('grado', String(nuovi.minGrado));
        const query = p.toString();
        window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
        return nuovi;
      });
    },
    [pathname],
  );

  /*
   * Il punto di vista: quanto si è vicini, e a cosa.
   *
   * `k` è l'ingrandimento, `x` e `y` lo spostamento **in coordinate della
   * tela**. Tenerli qui e non in un `transform` scritto a mano sul DOM serve
   * perché l'immagine da condividere possa ignorarli: quella deve uscire
   * sempre intera, altrimenti chi la riceve vede un dettaglio senza sapere di
   * cosa è il dettaglio.
   */
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 });
  const trascinamento = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const limitaVista = useCallback(
    (v: { x: number; y: number; k: number }) => {
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k));
      /* Il disegno non si può portare fuori dalla finestra: oltre il bordo non
         c'è niente da vedere, e chi ci finisce crede di aver rotto qualcosa. */
      const maxX = 0;
      const minX = grafo.larghezza * (1 - k);
      const maxY = 0;
      const minY = grafo.altezza * (1 - k);
      return {
        k,
        x: Math.min(maxX, Math.max(minX, v.x)),
        y: Math.min(maxY, Math.max(minY, v.y)),
      };
    },
    [grafo.larghezza, grafo.altezza],
  );

  /** Ingrandisce tenendo fermo un punto: quello sotto il puntatore, o il centro. */
  const zooma = useCallback(
    (fattore: number, fuocoX?: number, fuocoY?: number) => {
      setVista((v) => {
        const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * fattore));
        const cx = fuocoX ?? grafo.larghezza / 2;
        const cy = fuocoY ?? grafo.altezza / 2;
        // Il punto sotto il puntatore deve restare sotto il puntatore: è
        // l'unico zoom che non fa perdere il segno di dove si stava guardando.
        return limitaVista({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k });
      });
    },
    [grafo.larghezza, grafo.altezza, limitaVista],
  );

  /** Da coordinate del puntatore a coordinate della tela. */
  const nellaTela = useCallback(
    (clientX: number, clientY: number) => {
      const riquadro = telaRef.current?.getBoundingClientRect();
      if (!riquadro) return { x: grafo.larghezza / 2, y: grafo.altezza / 2 };
      return {
        x: ((clientX - riquadro.left) / riquadro.width) * grafo.larghezza,
        y: ((clientY - riquadro.top) / riquadro.height) * grafo.altezza,
      };
    },
    [grafo.larghezza, grafo.altezza],
  );

  /*
   * La rotella si ascolta con un listener non passivo.
   *
   * React registra `onWheel` come passivo, e da un listener passivo
   * `preventDefault()` non ha effetto: la rotella ingrandirebbe il grafo **e**
   * scorrerebbe la pagina insieme, che è il modo più rapido di perdere di vista
   * quello che si stava guardando.
   */
  useEffect(() => {
    const tela = telaRef.current;
    if (!tela) return;
    const suRotella = (e: WheelEvent) => {
      e.preventDefault();
      const punto = nellaTela(e.clientX, e.clientY);
      zooma(e.deltaY < 0 ? 1.18 : 1 / 1.18, punto.x, punto.y);
    };
    tela.addEventListener('wheel', suRotella, { passive: false });
    return () => tela.removeEventListener('wheel', suRotella);
  }, [nellaTela, zooma]);

  const iniziaTrascinamento = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    trascinamento.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const trascina = (e: React.PointerEvent) => {
    const inizio = trascinamento.current;
    if (!inizio) return;
    const riquadro = telaRef.current?.getBoundingClientRect();
    if (!riquadro) return;
    const scalaX = grafo.larghezza / riquadro.width;
    const scalaY = grafo.altezza / riquadro.height;
    setVista(
      limitaVista({
        k: vista.k,
        x: inizio.vx + (e.clientX - inizio.x) * scalaX,
        y: inizio.vy + (e.clientY - inizio.y) * scalaY,
      }),
    );
  };

  const fermaTrascinamento = (e: React.PointerEvent) => {
    trascinamento.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  /** Frecce per spostarsi, `+` e `-` per avvicinarsi, `0` per tornare indietro. */
  const suTasto = (e: React.KeyboardEvent) => {
    const passo = 80 * vista.k;
    const mosse: Record<string, () => void> = {
      ArrowLeft: () => setVista((v) => limitaVista({ ...v, x: v.x + passo })),
      ArrowRight: () => setVista((v) => limitaVista({ ...v, x: v.x - passo })),
      ArrowUp: () => setVista((v) => limitaVista({ ...v, y: v.y + passo })),
      ArrowDown: () => setVista((v) => limitaVista({ ...v, y: v.y - passo })),
      '+': () => zooma(1.3),
      '=': () => zooma(1.3),
      '-': () => zooma(1 / 1.3),
      '0': () => setVista({ x: 0, y: 0, k: 1 }),
    };
    const mossa = mosse[e.key];
    if (!mossa) return;
    e.preventDefault();
    mossa();
  };

  const { archiVisibili, nodiVisibili } = useMemo(() => {
    const archi = grafo.archi.filter((a) => {
      if (filtri.famiglia && a.famiglia !== filtri.famiglia) return false;
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

  /* Le norme da nominare sul disegno: i buchi sempre, poi i perni più tirati
     in ballo. Scriverne duecento renderebbe illeggibile tutto; scriverne zero
     farebbe di questa una figura astratta. */
  const daNominare = useMemo(() => {
    const morti = nodiVisibili.filter((n) => n.abrogato);
    const perni = nodiVisibili
      .filter((n) => !n.abrogato)
      .sort((a, b) => b.entranti - a.entranti || b.grado - a.grado)
      .slice(0, Math.max(0, QUANTE_ETICHETTE - morti.length));
    return [...morti, ...perni];
  }, [nodiVisibili]);

  /**
   * L'immagine da condividere.
   *
   * L'SVG viene ridisegnato su una tela e trasformato in PNG **nel browser**,
   * senza librerie e senza mandare niente a nessuno. Due cose vanno sistemate
   * nel clone: i colori, che sono variabili CSS e dentro un'immagine isolata
   * non esistono più, e il punto di vista, che va azzerato — un dettaglio
   * ingrandito, staccato dalla sua pagina, non dice di che cosa è il dettaglio.
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
      clone.querySelector('.grafo__vista')?.setAttribute('transform', 'translate(0 0) scale(1)');

      for (const el of clone.querySelectorAll<SVGElement>('*')) {
        for (const prop of ['fill', 'stroke'] as const) {
          const valore = el.getAttribute(prop);
          if (valore?.startsWith('var(')) {
            const nome = valore.slice(4, -1).trim();
            el.setAttribute(prop, stile.getPropertyValue(nome).trim() || '#14201c');
          }
        }
      }

      // Lo sfondo dell'immagine è quello della tela, non quello della pagina:
      // un PNG con il fondo chiaro e i fili chiari sopra è un rettangolo vuoto.
      const sfondo = stile.getPropertyValue('--grafo-fondo').trim() || '#101715';
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
      const indirizzo = `${base}${window.location.pathname}${window.location.search}`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Le leggi che non tornano',
          text: 'Come le leggi italiane si tengono fra loro, e dove il filo si spezza.',
          url: indirizzo,
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
        await navigator.clipboard.writeText(indirizzo);
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
  const ingrandito = Math.round(vista.k * 10) / 10;

  return (
    <div className="grafo">
      <div className="grafo__comandi">
        <div className="grafo__filtro">
          <label htmlFor="grafo-legame">Che cosa fa una norma all’altra</label>
          <select
            id="grafo-legame"
            value={filtri.famiglia ?? ''}
            onChange={(e) => aggiorna({ famiglia: (e.target.value as Famiglia) || null })}
          >
            <option value="">Tutti i legami</option>
            {grafo.famiglie.map((f) => (
              <option key={f} value={f}>
                {ETICHETTA_FAMIGLIA[f]}
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
            max={60}
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
          <label htmlFor="grafo-rotti">Solo i collegamenti a norme che non ci sono più</label>
        </div>

        {/* I comandi dello zoom sono bottoni veri, e stanno **fuori** dalla
            tela. Dentro un `role="img"` non possono stare controlli
            raggiungibili da tastiera: uno screen reader annuncerebbe dei
            bottoni dentro qualcosa che ha già detto di essere una figura. */}
        <div className="grafo__zoom" role="group" aria-label="Ingrandimento del disegno">
          <button type="button" className="bottone" onClick={() => zooma(1 / 1.4)}>
            <span aria-hidden="true">−</span>
            <span className="solo-lettori-schermo">Allontana</span>
          </button>
          <span className="grafo__zoom-valore" aria-hidden="true">
            {ingrandito}×
          </span>
          <button type="button" className="bottone" onClick={() => zooma(1.4)}>
            <span aria-hidden="true">+</span>
            <span className="solo-lettori-schermo">Avvicina</span>
          </button>
          <button
            type="button"
            className="bottone"
            onClick={() => setVista({ x: 0, y: 0, k: 1 })}
            disabled={vista.k === 1 && vista.x === 0 && vista.y === 0}
          >
            Tutto il grafo
          </button>
        </div>

        <button type="button" className="bottone bottone--primario" onClick={condividiImmagine}>
          Condividi come immagine
        </button>
      </div>

      <p className="grafo__conteggio" role="status" aria-live="polite">
        <strong>{nodiVisibili.length}</strong> norme e <strong>{archiVisibili.length}</strong>{' '}
        collegamenti fra loro, di cui <strong className="grafo__rosso">{rotti}</strong> verso norme
        che non esistono più.
        {statoImmagine ? ` ${statoImmagine}` : ''}
      </p>

      <div
        ref={telaRef}
        className={`grafo__tela-contenitore${trascinamento.current ? ' grafo__tela-contenitore--trascina' : ''}`}
        onPointerDown={iniziaTrascinamento}
        onPointerMove={trascina}
        onPointerUp={fermaTrascinamento}
        onPointerCancel={fermaTrascinamento}
        onKeyDown={suTasto}
        onDoubleClick={(e) => {
          const punto = nellaTela(e.clientX, e.clientY);
          zooma(1.8, punto.x, punto.y);
        }}
        tabIndex={0}
        role="img"
        aria-label={`Mappa di ${nodiVisibili.length} norme italiane e ${archiVisibili.length} collegamenti fra loro. ${rotti} collegamenti puntano a norme che non esistono più e sono disegnati in rosso. Usa le frecce per spostarti, più e meno per avvicinarti.`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${grafo.larghezza} ${grafo.altezza}`}
          className="grafo__tela"
          aria-hidden="true"
          focusable="false"
        >
          <g
            className="grafo__vista"
            transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}
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
                    stroke={a.rotto ? COLORE_ROTTO : COLORE_FAMIGLIA[a.famiglia]}
                    strokeWidth={a.rotto ? 1.1 : 0.45}
                    opacity={
                      attenuato ? 0.03 : a.rotto ? 0.55 : a.famiglia === 'rinvio' ? 0.09 : 0.42
                    }
                  />
                );
              })}
            </g>

            <g className="grafo__nodi">
              {[...nodiVisibili]
                // Ordine di disegno: chi è in ordine sotto, chi punta al vuoto
                // sopra, i buchi sopra a tutti. Senza, i nodi che raccontano la
                // storia finiscono sepolti sotto duecento cerchi.
                .sort(
                  (x, y) =>
                    Number(x.abrogato) - Number(y.abrogato) ||
                    Number(x.puntaAlVuoto) - Number(y.puntaAlVuoto),
                )
                .map((n) => {
                  const attenuato = vicini ? !vicini.has(n.urn) : false;
                  /* Il rosso pieno è dei buchi. Chi punta a un buco lo segnala
                     con lo stesso colore ma molto più tenue: sono un centinaio
                     di norme, e dipingerle tutte come i due buchi farebbe
                     sparire proprio i due buchi. */
                  const colore = n.abrogato
                    ? COLORE_MORTO
                    : n.puntaAlVuoto
                      ? COLORE_MORTO
                      : COLORE_VIVO;
                  return (
                    <circle
                      key={n.urn}
                      className={n.abrogato ? 'grafo__buco' : undefined}
                      cx={n.x}
                      cy={n.y}
                      r={raggio(n)}
                      /* Un buco si disegna come un buco: chiaro al centro e
                         cerchiato di rosso. Fra duecento cerchi pieni, un altro
                         cerchio pieno non si distingue — e sono proprio questi
                         i nodi per cui la pagina esiste.
                         Una norma di cui non abbiamo il testo è vuota anche
                         lei, ma con il bordo sottile: promettere un testo che
                         non abbiamo sarebbe la bugia più facile da fare con un
                         disegno. */
                      fill={
                        n.abrogato ? 'var(--grafo-carta)' : n.fuoriCorpus ? COLORE_SFONDO : colore
                      }
                      opacity={
                        attenuato
                          ? 0.08
                          : n.abrogato
                            ? 1
                            : n.fuoriCorpus
                              ? 0.5
                              : n.puntaAlVuoto
                                ? 0.62
                                : 0.32
                      }
                      stroke={n.abrogato ? COLORE_MORTO : n.fuoriCorpus ? COLORE_VIVO : 'none'}
                      strokeWidth={n.abrogato ? 7 : n.fuoriCorpus ? 1.2 : 0}
                      /* Nessun `tabIndex` e nessun `role` sui cerchi: la tela è
                         già una figura con la sua descrizione, e l'equivalente
                         accessibile è la tabella qui sotto. Il passaggio del
                         mouse resta una comodità per chi vede. */
                      onMouseEnter={() => setSelezionato(n.urn)}
                      onMouseLeave={() => setSelezionato(null)}
                    />
                  );
                })}
            </g>

            {/* I nomi delle norme che contano, dentro il disegno.
                Questa pagina è fatta per essere condivisa come PNG, e un PNG
                viaggia senza la sua pagina: se il disegno non si spiega da
                solo, in una chat non dice niente. */}
            <g className="grafo__scritte" aria-hidden="true">
              {daNominare.map((n, i) => {
                /* I nomi vanno portati **fuori dal groviglio**, non appoggiati
                   accanto al nodo: i nodi da nominare stanno quasi tutti al
                   centro, dove il disegno è più fitto, e lì un nome si legge
                   sopra altri cento cerchi.
                   Ognuno esce dalla parte da cui è più vicino al bordo, e le
                   quote verticali si distribuiscono in ordine: due etichette
                   sulla stessa riga sono due etichette illeggibili. */
                const versoDestra = n.x >= grafo.larghezza / 2;
                const xTesto = versoDestra ? grafo.larghezza - 330 : 150;
                const yTesto = 190 + (i * (grafo.altezza - 320)) / Math.max(daNominare.length, 1);
                return (
                  <g key={`etichetta-${n.urn}`}>
                    <line
                      x1={n.x}
                      y1={n.y}
                      x2={xTesto - (versoDestra ? 8 : -8)}
                      y2={yTesto - 4}
                      stroke="var(--grafo-carta)"
                      strokeWidth={0.6}
                      opacity={0.32}
                    />
                    <text x={xTesto} y={yTesto} className="grafo__etichetta-tela">
                      {n.nome}
                    </text>
                    <text
                      x={xTesto}
                      y={yTesto + 15}
                      className="grafo__etichetta-tela grafo__etichetta-tela--debole"
                    >
                      {n.abrogato
                        ? `non è più in vigore, e ${n.entranti} norme la richiamano ancora`
                        : `tirata in ballo da ${n.entranti} norme`}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>

          {/* Titolo, legenda e firma **fuori** dalla vista che si sposta:
              devono restare al loro posto mentre ci si muove dentro il
              disegno, e devono finire nell'immagine condivisa. */}
          <g className="grafo__scritte" aria-hidden="true">
            <text x={24} y={40} className="grafo__titolo-tela">
              Come le leggi italiane si tengono fra loro
            </text>
            <text x={24} y={64} className="grafo__sottotitolo-tela">
              {nodiVisibili.length} norme, {archiVisibili.length} collegamenti — in rosso i {rotti}{' '}
              che puntano a qualcosa che non esiste più
            </text>

            {grafo.famiglie.map((f, i) => (
              <g key={f} transform={`translate(24 ${96 + i * 22})`}>
                <line
                  x1={0}
                  y1={-4}
                  x2={26}
                  y2={-4}
                  stroke={COLORE_FAMIGLIA[f]}
                  strokeWidth={f === 'rinvio' ? 1.4 : 2.4}
                  opacity={0.9}
                />
                <text x={34} y={0} className="grafo__etichetta-tela grafo__etichetta-tela--debole">
                  {ETICHETTA_FAMIGLIA[f]}
                </text>
              </g>
            ))}

            <text x={24} y={grafo.altezza - 22} className="grafo__firma-tela">
              leggichenontornano.it
            </text>
          </g>
        </svg>
      </div>

      <div className="grafo__dettaglio" role="status" aria-live="polite">
        {dettaglio ? (
          <>
            <strong>{dettaglio.nome}</strong> — {dettaglio.entranti} norme la richiamano,{' '}
            {dettaglio.uscenti} ne richiama
            {dettaglio.abrogato ? ', e non è più in vigore' : ''}
            {dettaglio.fuoriCorpus ? ', di cui non abbiamo ancora il testo' : ''}
            {dettaglio.puntaAlVuoto && !dettaglio.abrogato
              ? ', rinvia ad almeno una norma cancellata'
              : ''}
            {dettaglio.segnalazioni > 0
              ? ` · ${dettaglio.segnalazioni} segnalazion${dettaglio.segnalazioni === 1 ? 'e' : 'i'}`
              : ''}
          </>
        ) : (
          'Passa sopra un nodo per sapere quale norma è. Trascina per spostarti, rotella o doppio clic per avvicinarti.'
        )}
      </div>
    </div>
  );
}
