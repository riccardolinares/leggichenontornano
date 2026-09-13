import { dataset } from './dataset';
import { nomeNorma } from './testo';
import { FAMIGLIA_DI, type ArcoGrafo, type Grafo, type NodoGrafo } from './grafo-tipi';

export * from './grafo-tipi';

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

/* La tela è grande perché il disegno è grande: duecento nodi e millecinquecento
   archi su mille pixel diventano una palla di lana. Le coordinate sono
   arbitrarie — l'SVG si adatta alla larghezza disponibile — ma il rapporto fra
   la tela e la distanza a riposo degli archi decide quanto il disegno respira,
   ed è quello che queste due costanti governano. */
const LARGHEZZA = 1600;
const ALTEZZA = 1100;

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

  /* Gli archi sono a livello di **atto**: le versioni e le partizioni non sono
     nodi. Qui interessa come le leggi si tengono fra loro, non la cronologia
     delle modifiche di ciascuna — che è un'altra cosa e ha già una pagina sua,
     il lettore norma.

     Non si filtra più niente. La prima versione teneva solo i rinvii che
     partivano da una norma in vigore, e il risultato era un disegno in cui
     l'unica cosa visibile erano due atti abrogati: tutto il resto era grigio
     indistinto, perché il colore segnava una cosa sola e quella cosa nel
     corpus capita due volte. Un grafo delle leggi deve far vedere **come le
     leggi si tengono**, e quello si vede solo se ci sono tutte e se ogni tipo
     di legame ha il suo colore. Quanti nodi e quanti archi restano fuori è una
     domanda a cui la pagina deve saper rispondere, non una scelta silenziosa
     del codice. */
  const archiPerChiave = new Map<string, ArcoGrafo>();
  let relazioni = 0;
  for (const r of reader.data.relations) {
    const da = r.sourceUrn.split('~')[0]!;
    const a = r.targetUrn.split('~')[0]!;
    if (da === a) continue;
    const famiglia = FAMIGLIA_DI[r.type];
    // Un tipo di relazione che non sappiamo disegnare non si disegna a caso:
    // finirebbe nel colore di qualcun altro e direbbe una cosa falsa.
    if (!famiglia) continue;
    relazioni++;

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
      famiglia,
      peso: 1,
      /* «Rotto» vuol dire una cosa sola: **il bersaglio non è più in vigore**.
         Ci avevo messo dentro anche le declaratorie di illegittimità, ed era
         un errore che si vede solo guardando il risultato: una pronuncia della
         Corte è un fatto normale e frequente, e contandola fra i legami rotti
         il disegno diventava rosso quasi ovunque. Il rosso che segna tutto non
         segna niente — è esattamente l'obiezione per cui ADR 0003 non voleva
         questo grafo. Le declaratorie hanno il colore della loro famiglia. */
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

  const uscenti = new Map<string, number>();
  const entranti = new Map<string, number>();
  const puntaAlVuoto = new Set<string>();
  for (const arco of archi) {
    uscenti.set(arco.da, (uscenti.get(arco.da) ?? 0) + 1);
    entranti.set(arco.a, (entranti.get(arco.a) ?? 0) + 1);
    if (arco.rotto) puntaAlVuoto.add(arco.da);
  }

  const urnDeiNodi = new Set([...uscenti.keys(), ...entranti.keys()]);
  const nodi: NodoGrafo[] = [...urnDeiNodi].map((urn) => ({
    urn,
    nome: nomeNorma(urn),
    grado: (uscenti.get(urn) ?? 0) + (entranti.get(urn) ?? 0),
    uscenti: uscenti.get(urn) ?? 0,
    entranti: entranti.get(urn) ?? 0,
    abrogato: perUrn.get(urn)?.abrogated ?? false,
    fuoriCorpus: !perUrn.has(urn),
    segnalazioni: segnalazioniPerAtto.get(urn) ?? 0,
    puntaAlVuoto: puntaAlVuoto.has(urn),
    x: 0,
    y: 0,
  }));

  /* L'ordine di disegno è l'ordine di lettura: i nodi più collegati stanno
     sopra gli altri, così un perno non finisce coperto da una foglia. */
  nodi.sort((a, b) => a.grado - b.grado);

  disponi(nodi, archi);

  cache = {
    nodi,
    archi,
    tipi: [...new Set(archi.map((a) => a.tipo))].sort(),
    famiglie: [...new Set(archi.map((a) => a.famiglia))].sort(),
    relazioni,
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
    const raggio = 320 + casuale() * 180;
    x[i] = LARGHEZZA / 2 + Math.cos(angolo) * raggio;
    y[i] = ALTEZZA / 2 + Math.sin(angolo) * raggio;
  }

  const PASSI = 700;
  /* Repulsione alta e molle lunghe. Con millecinquecento archi su duecento nodi
     la tentazione delle molle è di schiacciare tutto in una palla, e una palla
     non fa vedere niente: quello che deve emergere è la **forma** — pochi perni
     fittissimi al centro, e attorno le norme che li tirano in ballo.

     I valori sono tarati sul dataset di oggi guardando il risultato, non
     dedotti: una simulazione a forze non ha parametri «giusti», ha parametri
     che su un certo grafo producono un disegno leggibile. Se il corpus cresce
     di un ordine di grandezza vanno ritarati, e il disegno ripensato. */
  const REPULSIONE = 46000;
  const MOLLA = 0.009;
  const CENTRO = 0.0026;
  /** Lunghezza a riposo di un arco: sotto si respingono, sopra si attirano. */
  const RIPOSO = 210;

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
  const margine = 60;
  const scala = Math.min(
    (LARGHEZZA - margine * 2) / Math.max(maxX - minX, 1),
    (ALTEZZA - margine * 2) / Math.max(maxY - minY, 1),
  );
  /* La scala conserva le proporzioni, quindi su un asse avanza dello spazio:
     va diviso in due. Senza, il disegno si appoggia all'angolo in alto a
     sinistra e metà tela resta vuota — che in un'immagine condivisa si legge
     come un errore di ritaglio. */
  const avanzoX = LARGHEZZA - margine * 2 - (maxX - minX) * scala;
  const avanzoY = ALTEZZA - margine * 2 - (maxY - minY) * scala;
  for (let i = 0; i < n; i++) {
    nodi[i]!.x = Math.round((margine + avanzoX / 2 + (x[i]! - minX) * scala) * 10) / 10;
    nodi[i]!.y = Math.round((margine + avanzoY / 2 + (y[i]! - minY) * scala) * 10) / 10;
  }
}
