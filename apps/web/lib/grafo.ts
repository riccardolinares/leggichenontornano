import { dataset } from './dataset';
import { nomeNorma } from './testo';

/**
 * Il grafo delle leggi in vigore, con le sue coordinate.
 *
 * ## Perché questo file esiste, visto che una ADR lo vietava
 *
 * [ADR 0003](../../../docs/adr/0003-niente-grafo-force-directed.md) escludeva i
 * grafi force-directed, e aveva ragione su una cosa precisa: una simulazione
 * che gira nel browser dà **un disegno diverso a ogni caricamento**. Su un sito
 * in cui ogni pagina deve essere citabile, un'immagine che cambia da sola non
 * si può citare — e un grafo che si muove è quasi sempre un modo elegante di
 * non dire niente.
 *
 * Quell'obiezione si risolve, e questo file la risolve: **il layout si calcola
 * qui, una volta, in modo deterministico**, e nel browser arrivano coordinate
 * fisse. Stesso dataset, stesso disegno, per chiunque e per sempre. Il browser
 * non simula niente: mostra, filtra e mette in evidenza.
 *
 * Resta vero che un grafo denso dice poco da solo. Per questo qui il colore non
 * è decorativo: **il rosso segna i collegamenti verso norme che non ci sono
 * più**, che è l'unica cosa che questo disegno deve far vedere in un secondo.
 */

export interface NodoGrafo {
  urn: string;
  nome: string;
  /** Quanti archi tocca: decide il raggio. */
  grado: number;
  /** `true` se l'atto non è più in vigore: sono i buchi verso cui puntano gli altri. */
  abrogato: boolean;
  /** Quante segnalazioni pubblicate lo coinvolgono. */
  segnalazioni: number;
  /** `true` se punta ad almeno una norma abrogata. */
  puntaAlVuoto: boolean;
  x: number;
  y: number;
}

export interface ArcoGrafo {
  da: string;
  a: string;
  tipo: string;
  /** Quante relazioni distinte stanno dietro questo arco. */
  peso: number;
  /** `true` se il bersaglio non è più in vigore. */
  rotto: boolean;
}

export interface Grafo {
  nodi: NodoGrafo[];
  archi: ArcoGrafo[];
  tipi: string[];
  /** Dimensioni della tela su cui le coordinate sono calcolate. */
  larghezza: number;
  altezza: number;
  /** Data del dataset da cui il disegno è stato calcolato. */
  conosciutoAl: string;
}

const LARGHEZZA = 1000;
const ALTEZZA = 700;

/**
 * Generatore pseudocasuale con seme.
 *
 * È il pezzo che rende il disegno riproducibile: le posizioni di partenza di
 * una simulazione a forze decidono il risultato finale, e `Math.random()` le
 * renderebbe diverse a ogni build.
 */
function casualeConSeme(seme: number): () => number {
  let stato = seme >>> 0;
  return () => {
    stato = (stato + 0x6d2b79f5) >>> 0;
    let t = stato;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tiene una velocità dentro limiti sensati, e neutralizza NaN e infiniti. */
function limita(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-40, Math.min(40, v));
}

let cache: Grafo | null = null;

export function grafo(): Grafo {
  if (cache !== null) return cache;

  const reader = dataset();
  const atti = reader.data.acts;
  const perUrn = new Map(atti.map((a) => [a.urn, a]));
  const inVigore = new Set(atti.filter((a) => !a.abrogated).map((a) => a.urn));

  /* Gli archi sono a livello di **atto**: le versioni e le partizioni non sono
     nodi. Il piano chiedeva le leggi in vigore collegate fra loro, non la
     cronologia delle loro modifiche — che è un'altra cosa e ha già una pagina
     sua, il lettore norma. */
  const archiPerChiave = new Map<string, ArcoGrafo>();
  for (const r of reader.data.relations) {
    const da = r.sourceUrn.split('~')[0]!;
    const a = r.targetUrn.split('~')[0]!;
    if (da === a) continue;
    // La sorgente deve essere una norma viva: un rinvio fatto da un atto
    // abrogato a un altro atto abrogato non riguarda nessuno, oggi.
    if (!inVigore.has(da) || !perUrn.has(a)) continue;

    const chiave = `${da}|${a}|${r.type}`;
    const esistente = archiPerChiave.get(chiave);
    if (esistente) {
      esistente.peso++;
      continue;
    }
    archiPerChiave.set(chiave, {
      da,
      a,
      tipo: r.type,
      peso: 1,
      rotto: perUrn.get(a)?.abrogated ?? false,
    });
  }
  const archi = [...archiPerChiave.values()];

  const segnalazioniPerAtto = new Map<string, number>();
  for (const anomalia of reader.publishedAnomalies()) {
    for (const urn of new Set(anomalia.urns.map((u) => u.split('~')[0]!))) {
      segnalazioniPerAtto.set(urn, (segnalazioniPerAtto.get(urn) ?? 0) + 1);
    }
  }

  const grado = new Map<string, number>();
  const puntaAlVuoto = new Set<string>();
  for (const arco of archi) {
    grado.set(arco.da, (grado.get(arco.da) ?? 0) + 1);
    grado.set(arco.a, (grado.get(arco.a) ?? 0) + 1);
    if (arco.rotto) puntaAlVuoto.add(arco.da);
  }

  const nodi: NodoGrafo[] = [...grado.keys()].map((urn) => ({
    urn,
    nome: nomeNorma(urn),
    grado: grado.get(urn) ?? 0,
    abrogato: perUrn.get(urn)?.abrogated ?? false,
    segnalazioni: segnalazioniPerAtto.get(urn) ?? 0,
    puntaAlVuoto: puntaAlVuoto.has(urn),
    x: 0,
    y: 0,
  }));

  disponi(nodi, archi);

  cache = {
    nodi,
    archi,
    tipi: [...new Set(archi.map((a) => a.tipo))].sort(),
    larghezza: LARGHEZZA,
    altezza: ALTEZZA,
    conosciutoAl: (reader.data.manifest?.knownAt ?? new Date().toISOString()).slice(0, 10),
  };
  return cache;
}

/**
 * Simulazione a forze, con un numero fisso di passi.
 *
 * Tre forze e niente di più: repulsione fra tutti i nodi, molle lungo gli
 * archi, e un richiamo al centro che tiene il disegno dentro la tela. Con
 * centocinquanta nodi la repulsione a coppie costa niente, e non serve un
 * albero di Barnes-Hut che aggiungerebbe approssimazione — cioè un'altra
 * sorgente di differenze fra un'esecuzione e l'altra.
 *
 * Il raffreddamento è lineare e il numero di passi è fisso: la simulazione non
 * si ferma «quando è abbastanza stabile», perché quella condizione dipende da
 * quanto è veloce la macchina che la esegue.
 */
function disponi(nodi: NodoGrafo[], archi: ArcoGrafo[]): void {
  const casuale = casualeConSeme(20260913);
  const n = nodi.length;
  if (n === 0) return;

  const indice = new Map(nodi.map((nodo, i) => [nodo.urn, i]));
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);

  // Partenza su un cerchio, con un po' di disordine: da una griglia regolare
  // la simulazione impiega molto più tempo a sciogliersi.
  for (let i = 0; i < n; i++) {
    const angolo = (i / n) * Math.PI * 2;
    const raggio = 200 + casuale() * 120;
    x[i] = LARGHEZZA / 2 + Math.cos(angolo) * raggio;
    y[i] = ALTEZZA / 2 + Math.sin(angolo) * raggio;
  }

  const PASSI = 500;
  /* Repulsione alta e molle lunghe. Con millecinquecento archi su
     centocinquanta nodi la tentazione delle molle è di schiacciare tutto in una
     palla, e una palla non fa vedere niente: quello che deve emergere è che due
     nodi stanno al centro e tutti gli altri ci puntano contro. */
  const REPULSIONE = 30000;
  const MOLLA = 0.01;
  const CENTRO = 0.0035;
  /** Lunghezza a riposo di un arco: sotto si respingono, sopra si attirano. */
  const RIPOSO = 170;

  for (let passo = 0; passo < PASSI; passo++) {
    const raffreddamento = 1 - passo / PASSI;

    for (let i = 0; i < n; i++) {
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        let dx = x[i]! - x[j]!;
        let dy = y[i]! - y[j]!;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Due nodi esattamente sovrapposti: si separano con uno scarto
          // deterministico, non casuale.
          dx = ((i % 7) - 3) * 0.1;
          dy = ((j % 7) - 3) * 0.1;
          d2 = dx * dx + dy * dy || 0.01;
        }
        const forza = REPULSIONE / d2;
        const d = Math.sqrt(d2);
        fx += (dx / d) * forza;
        fy += (dy / d) * forza;
      }

      fx += (LARGHEZZA / 2 - x[i]!) * CENTRO;
      fy += (ALTEZZA / 2 - y[i]!) * CENTRO;

      vx[i] = limita((vx[i]! + fx) * 0.82);
      vy[i] = limita((vy[i]! + fy) * 0.82);
    }

    for (const arco of archi) {
      const i = indice.get(arco.da);
      const j = indice.get(arco.a);
      if (i === undefined || j === undefined) continue;
      const dx = x[j]! - x[i]!;
      const dy = y[j]! - y[i]!;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      // Gli archi pesanti tirano un po' di più, ma con un tetto: senza, i due
      // atti più richiamati si attirerebbero addosso metà del disegno.
      /* La molla tira in proporzione allo **scostamento** dalla lunghezza a
         riposo, non alla distanza. Con la distanza la spinta cresce con il suo
         quadrato: con millecinquecento archi le velocità arrivano a infinito in
         una manciata di passi, e le coordinate finali sono tutte `NaN`. Si vede
         solo aprendo la pagina, dove il browser rifiuta ogni attributo. */
      const forza = MOLLA * (d - RIPOSO) * Math.min(arco.peso, 4);
      const spintaX = (dx / d) * forza;
      const spintaY = (dy / d) * forza;
      vx[i] = vx[i]! + spintaX;
      vy[i] = vy[i]! + spintaY;
      vx[j] = vx[j]! - spintaX;
      vy[j] = vy[j]! - spintaY;
    }

    for (let i = 0; i < n; i++) {
      vx[i] = limita(vx[i]!);
      vy[i] = limita(vy[i]!);
      x[i] = x[i]! + vx[i]! * raffreddamento * 0.35;
      y[i] = y[i]! + vy[i]! * raffreddamento * 0.35;
    }
  }

  // Riporta il disegno dentro la tela, con un margine per le etichette.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]!);
    maxX = Math.max(maxX, x[i]!);
    minY = Math.min(minY, y[i]!);
    maxY = Math.max(maxY, y[i]!);
  }
  const margine = 40;
  const scala = Math.min(
    (LARGHEZZA - margine * 2) / Math.max(maxX - minX, 1),
    (ALTEZZA - margine * 2) / Math.max(maxY - minY, 1),
  );
  for (let i = 0; i < n; i++) {
    nodi[i]!.x = Math.round((margine + (x[i]! - minX) * scala) * 10) / 10;
    nodi[i]!.y = Math.round((margine + (y[i]! - minY) * scala) * 10) / 10;
  }
}
