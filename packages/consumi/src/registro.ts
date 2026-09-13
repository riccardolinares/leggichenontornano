/**
 * Il registro dei consumi: una riga per chiamata, in un file che si appende.
 *
 * Il progetto usa un modello linguistico in tre punti, e finora nessuno dei tre
 * lasciava traccia di quanto costasse. Un progetto civico che chiede agli altri
 * di dichiarare le fonti dei propri numeri non può poi dire «qualche decina di
 * euro al mese» a occhio: o la cifra si conta, o non si scrive.
 *
 * Le scelte di questo file discendono tutte da lì:
 *
 *  1. **File, non database.** Come il dataset e come il blog: un JSONL versionato
 *     nel repository si legge senza un servizio in piedi, si verifica riga per
 *     riga, e la cronologia di chi ha speso cosa la tiene git. Un consumo che
 *     vive in un cruscotto chiuso non è pubblicato, è solo misurato.
 *  2. **Append, mai riscrittura.** Una riga scritta non si tocca più. Se il
 *     listino cambia, cambia il listino (`prezzi.ts`), non il costo già
 *     registrato: quella riga dice quanto è costata quel giorno, ed è un fatto.
 *  3. **Un file al mese.** Un file unico che cresce per anni produce diff
 *     illeggibili e conflitti a ogni esecuzione parallela; `AAAA-MM.jsonl`
 *     tiene il diff a una riga e i conflitti a zero.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { costoChiamata, VALUTA } from './prezzi.js';

/**
 * A cosa serviva la chiamata.
 *
 * Le etichette stanno qui e non nella pagina perché sono un dato del registro:
 * una riga vecchia con un uso che oggi non esiste più deve restare leggibile.
 */
export const USI = {
  blog: 'Approfondimenti del blog',
  'estrazione-deontica': 'Estrazione deontica (livello 3)',
  'analisi-assistita': 'Confronto assistito (livello 4)',
  contributo: 'Lavoro di un contributore',
} as const;

export type Uso = keyof typeof USI;

/** L'uso in lingua comune, o l'identificatore nudo se è di una riga più vecchia. */
export function etichettaUso(uso: string): string {
  return (USI as Record<string, string>)[uso] ?? uso;
}

/**
 * Da dove viene la riga.
 *
 * `automatico` sono le chiamate che il progetto ha fatto da sé e ha misurato;
 * `dichiarato` sono quelle che un contributore ha dichiarato a mano lavorando
 * con un assistente. Sono due gradi di certezza diversi e non vanno sommati
 * senza dirlo: la pagina li tiene separati.
 */
export type Origine = 'automatico' | 'dichiarato';

export interface RigaConsumo {
  /** Quando è stata fatta la chiamata, in ISO con l'ora. */
  quando: string;
  /** Il modello esatto, come lo riporta l'API. */
  modello: string;
  uso: string;
  tokenIngresso: number;
  tokenUscita: number;
  tokenCacheScrittura: number;
  tokenCacheLettura: number;
  /** Il costo stimato, o `null` quando il modello non è a listino. */
  costo: number | null;
  valuta: string;
  /** La data del listino applicato: serve a rifare il conto a mano. */
  listino: string | null;
  /**
   * Chi ha speso: `progetto` per le chiamate automatiche, il nome utente
   * GitHub per quelle dichiarate da un contributore.
   */
  chi: string;
  origine: Origine;
  /** Una nota facoltativa: su cosa si stava lavorando. */
  nota?: string;
}

/** Dove vive il registro. Assoluto nei workflow, relativo alla radice in locale. */
export const CARTELLA_PREDEFINITA = process.env['LCNT_CONSUMI'] ?? join('data', 'consumi');

/** Il file del mese a cui una riga appartiene: `data/consumi/2026-09.jsonl`. */
export function fileDelMese(quando: string, cartella = CARTELLA_PREDEFINITA): string {
  return join(cartella, `${quando.slice(0, 7)}.jsonl`);
}

export interface DaRegistrare {
  modello: string;
  uso: string;
  tokenIngresso: number;
  tokenUscita: number;
  tokenCacheScrittura?: number;
  tokenCacheLettura?: number;
  /** Predefinito: adesso. Esplicito nei test e nelle dichiarazioni a posteriori. */
  quando?: string;
  chi?: string;
  origine?: Origine;
  nota?: string;
}

/** Costruisce la riga completa, costo compreso, senza scriverla. */
export function componiRiga(voce: DaRegistrare): RigaConsumo {
  const quando = voce.quando ?? new Date().toISOString();
  const token = {
    ingresso: voce.tokenIngresso,
    uscita: voce.tokenUscita,
    cacheScrittura: voce.tokenCacheScrittura ?? 0,
    cacheLettura: voce.tokenCacheLettura ?? 0,
  };
  const { costo, listino } = costoChiamata(voce.modello, quando, token);
  return {
    quando,
    modello: voce.modello,
    uso: voce.uso,
    tokenIngresso: token.ingresso,
    tokenUscita: token.uscita,
    tokenCacheScrittura: token.cacheScrittura,
    tokenCacheLettura: token.cacheLettura,
    costo,
    valuta: VALUTA,
    listino,
    chi: voce.chi ?? 'progetto',
    origine: voce.origine ?? 'automatico',
    ...(voce.nota ? { nota: voce.nota } : {}),
  };
}

/**
 * Appende una riga al registro e la restituisce.
 *
 * Le chiavi sono serializzate nell'ordine in cui `componiRiga` le costruisce:
 * un JSON con le chiavi in ordine variabile produce diff che cambiano righe
 * identiche, e un diff rumoroso è un diff che nessuno legge.
 */
export function registra(voce: DaRegistrare, cartella = CARTELLA_PREDEFINITA): RigaConsumo {
  const riga = componiRiga(voce);
  const file = fileDelMese(riga.quando, cartella);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(riga)}\n`, 'utf8');
  return riga;
}

/**
 * Tutte le righe del registro, in ordine di tempo.
 *
 * Una riga illeggibile viene saltata invece di far fallire la lettura: il
 * registro è append-only e alimentato da processi diversi, e una riga troncata
 * da un'interruzione non deve portarsi via la pagina intera.
 */
export function leggiRegistro(cartella = CARTELLA_PREDEFINITA): RigaConsumo[] {
  if (!existsSync(cartella)) return [];
  const righe: RigaConsumo[] = [];
  for (const nome of readdirSync(cartella).sort()) {
    if (!nome.endsWith('.jsonl')) continue;
    for (const linea of readFileSync(join(cartella, nome), 'utf8').split('\n')) {
      if (linea.trim().length === 0) continue;
      try {
        righe.push(JSON.parse(linea) as RigaConsumo);
      } catch {
        continue;
      }
    }
  }
  return righe.sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));
}

export interface Totali {
  chiamate: number;
  tokenIngresso: number;
  tokenUscita: number;
  tokenCacheScrittura: number;
  tokenCacheLettura: number;
  /** Somma dei costi stimati delle righe valutabili. */
  costo: number;
  /** Quante righe non hanno un prezzo a listino: il totale è una sottostima. */
  senzaPrezzo: number;
}

export interface Gruppo extends Totali {
  chiave: string;
}

function totaliVuoti(): Totali {
  return {
    chiamate: 0,
    tokenIngresso: 0,
    tokenUscita: 0,
    tokenCacheScrittura: 0,
    tokenCacheLettura: 0,
    costo: 0,
    senzaPrezzo: 0,
  };
}

function accumula(t: Totali, r: RigaConsumo): void {
  t.chiamate += 1;
  t.tokenIngresso += r.tokenIngresso;
  t.tokenUscita += r.tokenUscita;
  t.tokenCacheScrittura += r.tokenCacheScrittura;
  t.tokenCacheLettura += r.tokenCacheLettura;
  if (r.costo === null) t.senzaPrezzo += 1;
  else t.costo += r.costo;
}

function raggruppa(righe: readonly RigaConsumo[], chiave: (r: RigaConsumo) => string): Gruppo[] {
  const mappa = new Map<string, Totali>();
  for (const r of righe) {
    const k = chiave(r);
    const t = mappa.get(k) ?? totaliVuoti();
    accumula(t, r);
    mappa.set(k, t);
  }
  return [...mappa.entries()].map(([k, t]) => ({ chiave: k, ...t }));
}

/** Tutti i token di una riga, di qualunque tipo: è la cifra «quanto ne è passato». */
export function tokenTotali(t: Totali): number {
  return t.tokenIngresso + t.tokenUscita + t.tokenCacheScrittura + t.tokenCacheLettura;
}

export interface Riepilogo {
  /** Quante righe ci sono in tutto: zero è una risposta, e la pagina la dice. */
  righe: number;
  /** Il mese della prima e dell'ultima riga (`AAAA-MM`), o `null` se è vuoto. */
  dal: string | null;
  al: string | null;
  totali: Totali;
  /** Solo le righe automatiche: quello che il progetto ha speso da sé. */
  progetto: Totali;
  /** Solo le righe dichiarate da contributori. */
  dichiarato: Totali;
  perModello: Gruppo[];
  perUso: Gruppo[];
  /** Un gruppo per mese, in ordine di tempo e senza buchi. */
  perMese: Gruppo[];
  /** Un gruppo per contributore, solo sulle righe dichiarate. */
  perContributore: Gruppo[];
  /**
   * Quanto costa tenerlo acceso al mese, o `null` quando non si può dire.
   *
   * È la media sui **mesi conclusi**: il mese in corso è incompleto per
   * definizione, e includerlo abbasserebbe la media di una quota che dipende
   * solo da che giorno è oggi. Sotto un mese concluso non c'è nessuna media da
   * fare, e restituire una cifra lo stesso sarebbe inventarla.
   */
  costoMensile: number | null;
  /** Su quanti mesi conclusi è calcolata la media. */
  mesiCompleti: number;
}

/**
 * Riassume il registro.
 *
 * `meseCorrente` è un parametro e non `new Date()` dentro la funzione perché
 * una pagina statica si costruisce una volta e poi resta: il giorno in cui
 * «oggi» cambia, la media mensile deve poter essere ricalcolata dalla build e
 * verificata da un test, non dipendere dall'orologio di chi la chiama.
 */
export function riepiloga(
  righe: readonly RigaConsumo[],
  meseCorrente = new Date().toISOString().slice(0, 7),
): Riepilogo {
  const totali = totaliVuoti();
  const progetto = totaliVuoti();
  const dichiarato = totaliVuoti();
  for (const r of righe) {
    accumula(totali, r);
    accumula(r.origine === 'dichiarato' ? dichiarato : progetto, r);
  }

  const perMese = raggruppa(righe, (r) => r.quando.slice(0, 7)).sort((a, b) =>
    a.chiave < b.chiave ? -1 : 1,
  );
  const conclusi = perMese.filter((m) => m.chiave < meseCorrente);
  const costoMensile =
    conclusi.length > 0 ? conclusi.reduce((s, m) => s + m.costo, 0) / conclusi.length : null;

  return {
    righe: righe.length,
    dal: perMese[0]?.chiave ?? null,
    al: perMese.at(-1)?.chiave ?? null,
    totali,
    progetto,
    dichiarato,
    perModello: raggruppa(righe, (r) => r.modello).sort((a, b) => b.costo - a.costo),
    perUso: raggruppa(righe, (r) => r.uso).sort((a, b) => b.costo - a.costo),
    perMese,
    perContributore: raggruppa(
      righe.filter((r) => r.origine === 'dichiarato'),
      (r) => r.chi,
    ).sort((a, b) => b.costo - a.costo),
    costoMensile,
    mesiCompleti: conclusi.length,
  };
}
