'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ETICHETTA_FAMIGLIA, type Famiglia } from '@/lib/grafo-tipi';

/**
 * Il grafo delle leggi con la simulazione accesa, dentro il browser.
 *
 * **Qui una simulazione gira davvero.** È la differenza con `/grafo`, dove le
 * coordinate arrivano calcolate dal server e non si muovono mai: là il disegno
 * è sempre lo stesso e si può citare, qui no. La decisione, e il prezzo che ha,
 * stanno in [ADR 0018](../../../docs/adr/0018-il-grafo-si-puo-muovere-se-si-rinuncia-a-citarlo.md);
 * [ADR 0012](../../../docs/adr/0012-il-grafo-si-puo-fare-se-non-si-muove.md)
 * continua a valere per `/grafo`, che non cambia di una riga.
 *
 * Quello che questa pagina fa e l'altra non può fare è una cosa sola, ed è il
 * motivo per cui esiste: **si possono prendere le norme con le mani**. Tirare
 * un perno e vedere cosa gli viene dietro dice quanto una legge sostiene
 * dell'ordinamento in un modo che un'immagine ferma non dice.
 *
 * La libreria è `force-graph` di vasturiano, con la sua simulazione d3-force,
 * e si carica **solo nel browser**: tocca DOM e canvas, e un import statico
 * romperebbe la generazione statica delle pagine.
 */

/** Il nodo come arriva dal server: nessuna coordinata, le calcola la simulazione. */
export interface NodoVivo {
  urn: string;
  nome: string;
  /** Percorso della scheda della norma: un grafo che non porta a niente è un salvaschermo. */
  percorso: string;
  grado: number;
  entranti: number;
  uscenti: number;
  abrogato: boolean;
  fuoriCorpus: boolean;
  puntaAlVuoto: boolean;
  segnalazioni: number;
}

export interface ArcoVivo {
  da: string;
  a: string;
  famiglia: Famiglia;
  peso: number;
  rotto: boolean;
}

/** Il nodo come lo vede `force-graph`: stesse cose, più le coordinate che scrive lui. */
interface NodoTela extends NodoVivo {
  x?: number;
  y?: number;
}

interface ArcoTela {
  source: string | NodoTela;
  target: string | NodoTela;
  famiglia: Famiglia;
  peso: number;
  rotto: boolean;
}

type Istanza = import('force-graph').default<NodoTela, ArcoTela>;

/**
 * La tavolozza, letta dai token `--grafo-*` del foglio di stile.
 *
 * Su una tela non si possono usare le variabili CSS: vanno risolte in colori
 * veri. Leggerle invece di riscriverle serve a una cosa precisa — **il colore
 * qui deve significare quello che significa su `/grafo`**, altrimenti due
 * pagine dello stesso sito direbbero due cose diverse con lo stesso segno.
 */
function tavolozza(): Record<string, string> {
  const stile = getComputedStyle(document.documentElement);
  const leggi = (nome: string, riserva: string) => stile.getPropertyValue(nome).trim() || riserva;
  return {
    /* Il carattere serve alla tela risolto: dentro un `canvas` la proprietà
       `font` non conosce le variabili CSS, e una `var()` non applicata manda
       le etichette in Times. */
    carattere: leggi('--grottesco', 'system-ui, sans-serif'),
    fondo: leggi('--grafo-fondo', '#101715'),
    carta: leggi('--grafo-carta', '#eef2f0'),
    rinvio: leggi('--grafo-rinvio', '#7f8d86'),
    modifica: leggi('--grafo-modifica', '#5fcdae'),
    abrogazione: leggi('--grafo-abrogazione', '#e3b869'),
    attuazione: leggi('--grafo-attuazione', '#7fc4ef'),
    illegittimita: leggi('--grafo-illegittimita', '#c79ad8'),
    rotto: leggi('--grafo-rotto', '#ef8b77'),
    vivo: leggi('--grafo-vivo', '#4f9d88'),
  };
}

/** `#eef2f0` più un'opacità, perché la tela vuole un colore solo per tratto. */
function conAlfa(colore: string, alfa: number): string {
  const esa = /^#([0-9a-f]{6})$/i.exec(colore.trim());
  if (!esa) return colore;
  const n = Number.parseInt(esa[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

/**
 * Il raggio di un nodo, in coordinate della simulazione.
 *
 * Radice del grado: i gradi vanno da uno a centoquindici, e una scala lineare
 * renderebbe i perni dei dischi e tutto il resto dei granelli.
 */
function raggio(n: NodoVivo): number {
  const base = 1.8 + Math.sqrt(n.grado);
  return n.abrogato ? Math.max(base, 7) : base;
}

/**
 * Una gravità verso l'origine, da aggiungere alle forze della libreria.
 *
 * `d3-force` la chiamerebbe `forceX(0) + forceY(0)`; scritta qui sono sei righe
 * e non aggiunge un altro pacchetto al peso della pagina.
 */
function gravita(forza: number) {
  let nodi: { x?: number; y?: number; vx?: number; vy?: number }[] = [];
  const applica = (alfa: number) => {
    for (const n of nodi) {
      if (n.x === undefined || n.y === undefined) continue;
      n.vx = (n.vx ?? 0) - n.x * forza * alfa;
      n.vy = (n.vy ?? 0) - n.y * forza * alfa;
    }
  };
  applica.initialize = (n: typeof nodi) => {
    nodi = n;
  };
  return applica;
}

/** Da quale ingrandimento in su si scrivono i nomi dei perni. */
const SCALA_ETICHETTE = 1.5;
/** Quanti collegamenti deve avere una norma per meritarsi il nome, da vicino. */
const GRADO_ETICHETTA = 40;

export function GrafoVivo({
  nodi,
  archi,
  famiglie,
}: {
  nodi: NodoVivo[];
  archi: ArcoVivo[];
  famiglie: Famiglia[];
}) {
  const router = useRouter();
  const contenitoreRef = useRef<HTMLDivElement>(null);
  const istanzaRef = useRef<Istanza | null>(null);

  /* L'insieme acceso quando il puntatore è sopra un nodo: quel nodo e i suoi
     vicini. Sta in un ref e non nello stato perché lo legge la funzione di
     disegno, che gira sessanta volte al secondo: farne dipendere una resa di
     React significherebbe ricostruire la tela a ogni movimento del mouse. */
  const accesiRef = useRef<Set<string> | null>(null);
  /* Anche il nodo sotto il puntatore serve alla funzione di disegno, e per la
     stessa ragione sta in un ref accanto allo stato che muove la pagina. */
  const dettaglioRef = useRef<NodoVivo | null>(null);
  const [dettaglio, setDettaglio] = useState<NodoVivo | null>(null);
  const [inMoto, setInMoto] = useState(false);
  const [motoRidotto, setMotoRidotto] = useState(false);
  const [pronto, setPronto] = useState(false);

  const rotti = useMemo(() => archi.filter((a) => a.rotto).length, [archi]);

  /**
   * La descrizione della tela, costruita dai dati.
   *
   * Un canvas è invisibile a uno screen reader: quello che passa di qui è solo
   * questa frase, quindi deve contenere le cifre e deve dire la cosa che
   * distingue questa pagina — il disegno non è lo stesso per tutti.
   */
  const descrizione =
    `Simulazione del grafo delle leggi: ${nodi.length} norme e ${archi.length} collegamenti, ` +
    `di cui ${rotti} verso norme che non sono più in vigore, disegnati in rosso. ` +
    `Il disegno si forma nel browser e non è mai due volte lo stesso: ` +
    `le stesse norme e gli stessi collegamenti stanno in tabella qui sotto.`;

  const descrizioneRef = useRef(descrizione);
  descrizioneRef.current = descrizione;

  /* `force-graph` scrive le coordinate **dentro** gli oggetti che riceve, e
     sostituisce `source` e `target` degli archi con i nodi veri. I dati che
     arrivano dal server non si toccano: la tela lavora su una copia sua. */
  const datiTela = useMemo(() => {
    const nodiTela: NodoTela[] = nodi.map((n) => ({ ...n }));
    const archiTela: ArcoTela[] = archi.map((a) => ({
      source: a.da,
      target: a.a,
      famiglia: a.famiglia,
      peso: a.peso,
      rotto: a.rotto,
    }));
    return { nodes: nodiTela, links: archiTela };
  }, [nodi, archi]);

  /** Rimette in moto la simulazione: alfa a uno, e si riparte da dove si era. */
  const rimescola = useCallback(() => {
    const g = istanzaRef.current;
    if (!g) return;
    g.cooldownTicks(Infinity).d3ReheatSimulation();
    setInMoto(true);
  }, []);

  /** Ferma la simulazione dove si trova: il prossimo giro di disegno la spegne. */
  const ferma = useCallback(() => {
    istanzaRef.current?.cooldownTicks(0);
    setInMoto(false);
  }, []);

  const inquadra = useCallback(() => {
    istanzaRef.current?.zoomToFit(motoRidotto ? 0 : 500, 40);
  }, [motoRidotto]);

  useEffect(() => {
    const contenitore = contenitoreRef.current;
    if (!contenitore) return;

    let vivo = true;
    let istanza: Istanza | null = null;
    let osservatore: ResizeObserver | null = null;

    /* Chi ha chiesto meno movimento al sistema operativo non deve trovare una
       palla che si agita: la simulazione gira tutta **prima** del primo
       disegno (`warmupTicks`) e poi si spegne al primo giro (`cooldownTicks(0)`).
       Il risultato è lo stesso disegno che gli altri vedono dopo qualche
       secondo, solo che compare già fermo. */
    const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMotoRidotto(ridotto);

    void (async () => {
      // Import dinamico: la libreria tocca `document` e `canvas`, e in fase di
      // generazione statica delle pagine non esiste né l'uno né l'altro.
      const { default: ForceGraph } = await import('force-graph');
      if (!vivo || !contenitoreRef.current) return;

      const tav = tavolozza();
      const coloreFamiglia: Record<Famiglia, string> = {
        rinvio: tav['rinvio']!,
        modifica: tav['modifica']!,
        abrogazione: tav['abrogazione']!,
        attuazione: tav['attuazione']!,
        illegittimita: tav['illegittimita']!,
      };

      /* I colori degli archi sono precalcolati, opacità compresa.
         Non è un vezzo: la libreria raggruppa gli archi per colore e li disegna
         in un tratto solo, quindi **poche stringhe distinte** valgono molti
         fotogrammi al secondo. Con millecinquecento archi ricalcolare una
         stringa per arco a ogni fotogramma è la prima cosa che si vede. */
      const coloreArco = (a: ArcoTela): string => {
        const accesi = accesiRef.current;
        if (accesi) {
          const da = typeof a.source === 'string' ? a.source : a.source.urn;
          const verso = typeof a.target === 'string' ? a.target : a.target.urn;
          if (!accesi.has(da) || !accesi.has(verso)) return conAlfa(tav['rinvio']!, 0.04);
          return conAlfa(a.rotto ? tav['rotto']! : coloreFamiglia[a.famiglia], 0.85);
        }
        if (a.rotto) return conAlfa(tav['rotto']!, 0.5);
        /* I rinvii sono milletrecento archi su millecinquecento: al colore
           pieno coprono tutto il resto e il disegno diventa una feltratura.
           Restano tutti — nessuno è nascosto — ma quasi trasparenti, così
           quello che si vede sopra sono le altre famiglie e i fili rossi. */
        return conAlfa(coloreFamiglia[a.famiglia], a.famiglia === 'rinvio' ? 0.1 : 0.32);
      };

      const larghezza = () => contenitoreRef.current?.clientWidth ?? 800;
      const altezza = () => Math.round(Math.min(680, Math.max(420, larghezza() * 0.62)));

      istanza = new ForceGraph<NodoTela, ArcoTela>(contenitoreRef.current)
        .width(larghezza())
        .height(altezza())
        .backgroundColor(tav['fondo']!)
        .graphData(datiTela)
        .nodeId('urn')
        // Niente fumetto della libreria: il nome della norma va nella riga qui
        // sotto, che è un'area viva e la leggono anche gli screen reader.
        .nodeLabel(() => '')
        .linkLabel(() => '')
        .linkColor(coloreArco)
        .linkWidth((a) => (a.rotto ? 1 : 0.4))
        // Gli archi non si devono poter puntare: dipingerli tutti sulla tela
        // nascosta del riconoscimento costa quanto disegnarli, e non serve a
        // niente — quello che si vuole prendere sono le norme.
        .linkPointerAreaPaint(() => {})
        .nodeCanvasObject((n, ctx, scala) => {
          if (n.x === undefined || n.y === undefined) return;
          const accesi = accesiRef.current;
          const acceso = !accesi || accesi.has(n.urn);
          const r = raggio(n);

          ctx.globalAlpha = acceso ? 1 : 0.1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);

          /* Il significato dei segni è quello di `/grafo`, alla lettera: un
             buco si disegna come un buco, una norma di cui non abbiamo il
             testo è vuota, e il rosso vuol dire una cosa sola. */
          if (n.abrogato) {
            ctx.fillStyle = tav['carta']!;
            ctx.fill();
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = tav['rotto']!;
            ctx.stroke();
          } else if (n.fuoriCorpus) {
            ctx.fillStyle = tav['fondo']!;
            ctx.fill();
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = conAlfa(tav['vivo']!, 0.8);
            ctx.stroke();
          } else {
            ctx.fillStyle = n.puntaAlVuoto
              ? conAlfa(tav['rotto']!, 0.62)
              : conAlfa(tav['vivo']!, 0.42);
            ctx.fill();
          }

          /* Le etichette compaiono quando servono e non prima: i due buchi
             sempre, il nodo sotto il puntatore sempre, i perni solo quando ci
             si è avvicinati abbastanza da poterli leggere. Duecento nomi
             stampati insieme sono una macchia grigia. */
          const nominare =
            n.abrogato ||
            (accesi?.has(n.urn) && dettaglioRef.current?.urn === n.urn) ||
            (scala >= SCALA_ETICHETTE && n.grado >= GRADO_ETICHETTA);
          if (nominare && acceso) {
            // Il corpo si divide per l'ingrandimento: così il nome resta della
            // stessa dimensione sullo schermo mentre ci si avvicina.
            const corpo = 11 / scala;
            ctx.font = `600 ${corpo}px ${tav['carattere']}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            // Un alone del colore del fondo, o il nome si legge sopra i fili
            // invece che sopra la tela.
            ctx.lineWidth = 3 / scala;
            ctx.strokeStyle = tav['fondo']!;
            ctx.lineJoin = 'round';
            ctx.strokeText(n.nome, n.x, n.y + r + 2 / scala);
            ctx.fillStyle = n.abrogato ? tav['rotto']! : tav['carta']!;
            ctx.fillText(n.nome, n.x, n.y + r + 2 / scala);
          }
          ctx.globalAlpha = 1;
        })
        .nodePointerAreaPaint((n, colore, ctx) => {
          if (n.x === undefined || n.y === undefined) return;
          ctx.fillStyle = colore;
          ctx.beginPath();
          // Un minimo di area: i nodi di grado uno sono granelli, e un granello
          // che si deve centrare col mouse non lo prende nessuno.
          ctx.arc(n.x, n.y, Math.max(raggio(n), 4), 0, 2 * Math.PI);
          ctx.fill();
        })
        /* Il decadimento della simulazione.
           Si ferma quando l'**energia** scende sotto una soglia, non dopo un
           tot di secondi: una macchina lenta disegna meno fotogrammi, e a
           tempo si fermerebbe a mezza strada con il grafo ancora aggrovigliato.
           Il tetto di tempo resta, ma molto più in là, come rete di sicurezza. */
        .d3AlphaDecay(0.018)
        .d3AlphaMin(0.008)
        .d3VelocityDecay(0.32)
        .cooldownTime(60_000)
        .warmupTicks(ridotto ? 400 : 8)
        .cooldownTicks(ridotto ? 0 : Infinity)
        .minZoom(0.15)
        .maxZoom(14)
        .onNodeHover((n) => {
          if (!n) {
            accesiRef.current = null;
            dettaglioRef.current = null;
            setDettaglio(null);
          } else {
            const insieme = new Set<string>([n.urn]);
            for (const a of datiTela.links) {
              const da = typeof a.source === 'string' ? a.source : a.source.urn;
              const verso = typeof a.target === 'string' ? a.target : a.target.urn;
              if (da === n.urn) insieme.add(verso);
              if (verso === n.urn) insieme.add(da);
            }
            accesiRef.current = insieme;
            dettaglioRef.current = n;
            setDettaglio(n);
          }
          /* Rimettere la stessa funzione di colore chiede un giro di disegno
             in più. Serve a simulazione ferma: lì la tela non si ridipinge da
             sola, e l'evidenziazione non comparirebbe mai. */
          istanza?.linkColor(coloreArco);
        })
        // Cliccare un nodo porta alla scheda della norma: è il punto di tutto.
        .onNodeClick((n) => router.push(n.percorso))
        .onEngineStop(() => {
          if (!vivo) return;
          setInMoto(false);
          istanza?.zoomToFit(ridotto ? 0 : 600, 40);
        });

      /*
       * Le tre forze, ritarate sul grafo di oggi.
       *
       * I valori di partenza della libreria sono pensati per qualche decina di
       * nodi: con duecentoquattro norme e millecinquecentottantotto archi
       * producono una pallina fitta in un angolo, dove la forma — pochi perni
       * e tutto il resto appeso — non si legge. Sono tarati guardando il
       * risultato, come tutti i parametri di una simulazione a forze: non
       * esistono valori giusti, esistono valori che su questo grafo danno un
       * disegno leggibile.
       */
      istanza.d3Force('charge')?.strength(-140).distanceMax(900);
      istanza.d3Force('link')?.distance(46);
      /* Una gravità verso il centro, che la libreria non ha.
         Serve alle isole: il corpus contiene coppie di norme che si citano fra
         loro e nient'altro, e senza niente che le richiami restano dove la
         repulsione le ha spinte — lontanissime. Il disegno si adatta al più
         lontano di tutti, e il grosso del grafo diventa un puntino in un
         angolo. Con la gravità le isole rientrano e restano isole, visibili ai
         bordi invece che fuori campo. */
      istanza.d3Force('gravita', gravita(0.16));

      /* La tela è una figura, e va detto cosa ci si vede: è l'unica cosa che
         arriva a chi non la guarda. Il testo lo mette il componente perché la
         libreria crea il `canvas` da sé. */
      const tela = contenitoreRef.current.querySelector('canvas');
      if (tela) {
        tela.setAttribute('role', 'img');
        tela.setAttribute('aria-label', descrizioneRef.current);
      }

      istanzaRef.current = istanza;
      setInMoto(!ridotto);
      setPronto(true);

      // La tela non si ridimensiona da sola: la libreria vuole due numeri.
      osservatore = new ResizeObserver(() => {
        istanza?.width(larghezza()).height(altezza());
      });
      osservatore.observe(contenitoreRef.current);
    })();

    return () => {
      vivo = false;
      osservatore?.disconnect();
      istanza?._destructor();
      istanzaRef.current = null;
      // La libreria svuota il nodo che le viene dato, ma il suo contenitore
      // interno resta: senza questo, un rientro nella pagina impila due tele.
      contenitore.innerHTML = '';
    };
  }, [datiTela, router]);

  return (
    <div className="grafo-vivo">
      <div className="grafo-vivo__comandi">
        {inMoto ? (
          <button type="button" className="bottone" onClick={ferma}>
            Ferma il disegno
          </button>
        ) : (
          <button type="button" className="bottone" onClick={rimescola}>
            Rimetti in moto
          </button>
        )}
        <button type="button" className="bottone" onClick={inquadra} disabled={!pronto}>
          Inquadra tutto
        </button>
        <p className="grafo-vivo__stato" role="status" aria-live="polite">
          {!pronto
            ? 'Carico la simulazione…'
            : motoRidotto
              ? 'Hai chiesto meno movimento al sistema: la simulazione è già ferma alla sua posizione finale.'
              : inMoto
                ? 'Le norme si stanno sistemando.'
                : 'Simulazione ferma. Le norme si possono ancora trascinare.'}
        </p>
      </div>

      {/* La tela vive qui dentro. Il nodo resta vuoto in partenza: la libreria
          lo svuota comunque quando si installa. */}
      <div className="grafo-vivo__tela" ref={contenitoreRef} />

      <p className="grafo-vivo__dettaglio" role="status" aria-live="polite">
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
            . Cliccala per aprirla.
          </>
        ) : (
          'Passa sopra una norma per sapere quale è; trascinala per vedere cosa le viene dietro; cliccala per aprirne la scheda. Rotella per avvicinarti.'
        )}
      </p>

      <ul className="grafo-vivo__legenda">
        {famiglie.map((f) => (
          <li key={f}>
            <span
              className="grafo-vivo__segno"
              style={{ background: `var(--grafo-${f})` }}
              aria-hidden="true"
            />
            {ETICHETTA_FAMIGLIA[f]}
          </li>
        ))}
        <li>
          <span
            className="grafo-vivo__segno grafo-vivo__segno--rotto"
            style={{ background: 'var(--grafo-rotto)' }}
            aria-hidden="true"
          />
          punta a una norma che non c’è più
        </li>
      </ul>
    </div>
  );
}
