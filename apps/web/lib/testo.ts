/**
 * Formattazione dei testi mostrati nel sito.
 *
 * Regola generale: niente prosa generata. Tutto quello che compare nel sito o è
 * testo normativo citato alla lettera, o è un template scritto qui, o è un campo
 * del dataset. Le funzioni di questo file sono la terza categoria, e sono poche
 * di proposito.
 */
import { humanLabel, tryParseUrn } from '@leggichenontornano/akn-parser';

const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

/** `2016-04-18` → «18 aprile 2016». */
export function data(iso: string | null | undefined): string {
  if (!iso) return 'data non nota';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${MESI[Number(m) - 1] ?? m} ${y}`;
}

/** `2026-09` → «settembre 2026». */
export function mese(iso: string): string {
  const [y, m] = iso.split('-');
  if (!y || !m) return iso;
  return `${MESI[Number(m) - 1] ?? m} ${y}`;
}

/** Finestra di vigenza in lingua comune. */
export function finestra(from: string | null, to: string | null): string {
  if (!from) return 'periodo non determinato';
  if (!to) return `dal ${data(from)}, tuttora in vigore`;
  return `dal ${data(from)} al ${data(to)}`;
}

/** Etichetta leggibile di un URN, con la partizione quando c'è. */
export function nomeNorma(urn: string): string {
  const parsed = tryParseUrn(urn);
  if (!parsed) return urn;
  return humanLabel(parsed);
}

/** URN dell'atto, senza partizione: serve per i collegamenti al lettore. */
export function urnAtto(urn: string): string {
  return urn.split('~')[0] ?? urn;
}

/** Numero di articolo contenuto nella partizione di un URN, se c'è. */
export function articoloDi(urn: string): string | null {
  const m = /~art(\d+(?:-(?:bis|ter|quater|quinquies))?)/i.exec(urn);
  return m?.[1] ?? null;
}

/** Percorso del lettore norma per un URN, con l'eventuale data di vigenza. */
export function percorsoNorma(urn: string, vigenza?: string | null): string {
  const base = `/norma/${encodeURIComponent(urn)}`;
  return vigenza ? `${base}?v=${vigenza}` : base;
}

/** Percorso della scheda anomalia. */
export function percorsoAnomalia(id: string): string {
  return `/anomalia/${encodeURIComponent(id)}`;
}

/**
 * Etichetta del livello della tassonomia.
 *
 * Il livello 4 dice «confronto assistito» e non «livello 4»: il numero da solo
 * suggerisce che sia il più avanzato, mentre quello che il lettore deve capire
 * è che lì il confronto l'ha fatto un modello e non una query. Sono due gradi
 * di fiducia diversi, e vanno detti diversamente.
 */
export function livello(n: number): string {
  switch (n) {
    case 1:
      return 'Livello 1 — deterministico';
    case 2:
      return 'Livello 2 — gerarchia e competenza';
    case 3:
      return 'Livello 3 — estrazione e query';
    default:
      return 'Confronto assistito da un modello';
  }
}

/** Classe CSS dell'etichetta in base alla gravità dichiarata. */
export function classeGravita(severity: string): string {
  if (severity === 'alta') return 'etichetta etichetta--antinomia';
  if (severity === 'bassa') return 'etichetta etichetta--neutra';
  return 'etichetta etichetta--area-grigia';
}

/**
 * Percentuale con una cifra, o un trattino esplicito quando non è misurata.
 *
 * Passa da `Intl` e non da `toFixed` per lo stesso motivo di `numeroDecimale`:
 * `toFixed` scrive «16.8%», che in una pagina italiana non si legge come un
 * decimale ma come un refuso — e un refuso su una cifra fa dubitare della
 * cifra.
 */
export function percentuale(value: number | null): string {
  if (value === null) return 'non misurata';
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

/** Numero con separatore delle migliaia all'italiana. */
export function numero(value: number): string {
  return new Intl.NumberFormat('it-IT').format(value);
}

/**
 * Un numero con i decimali, all'italiana: virgola, non punto.
 *
 * Interpolare un numero JavaScript direttamente in una pagina italiana produce
 * «14.2 anni», che a un lettore italiano non sembra un decimale: sembra un
 * errore, e un errore di forma su una cifra fa dubitare della cifra.
 */
export function numeroDecimale(value: number, decimali = 1): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(value);
}

/**
 * I campi di una pronuncia che ne determinano l'indirizzo.
 *
 * È un'interfaccia minima e non il record del dataset: così queste funzioni
 * restano usabili anche da chi legge il JSONL da solo — i test e i percorsi di
 * verifica — senza passare dal lettore del dataset.
 */
export interface PronunciaIndirizzabile {
  ecli: string;
  numero: string;
  anno: string;
  /** `S` sentenza, `O` ordinanza. */
  tipologia: string;
}

/**
 * Minuscole, cifre e trattini: tutto il resto diventa un trattino.
 *
 * Da qui dipende la proprietà che conta — un segmento che non ha bisogno di
 * essere codificato — e per questo lavora per sottrazione: non elenca i
 * caratteri da togliere, tiene solo quelli sicuri. Un carattere nuovo nel dato
 * non può così reintrodurre una percentuale nell'indirizzo.
 */
function senzaCaratteriDaCodificare(valore: string): string {
  return valore
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Come si dice una decisione a voce: `sentenza-121-2026`.
 *
 * Numero e poi anno perché è l'ordine con cui la si cita e con cui la si cerca
 * — «sentenza 121 del 2026», mai «sentenza 2026 121».
 */
function formaLeggibile(p: PronunciaIndirizzabile): string {
  const tipo = p.tipologia === 'O' ? 'ordinanza' : 'sentenza';
  return `${tipo}-${senzaCaratteriDaCodificare(p.numero)}-${senzaCaratteriDaCodificare(p.anno)}`;
}

/**
 * L'ECLI ridotto a segmento di percorso: `ECLI:IT:COST:2001:251` diventa
 * `ecli-it-cost-2001-251`.
 *
 * Serve solo ai vecchi indirizzi: è la forma in cui arrivano fin qui dopo che
 * il middleware ha tolto di mezzo i due punti.
 */
export function ecliNelPercorso(ecli: string): string {
  return senzaCaratteriDaCodificare(ecli);
}

/**
 * Lo slug di una pronuncia, univoco sull'insieme in cui vive.
 *
 * Vuole tutte le pronunce e non solo la sua perché l'univocità non è una
 * proprietà di un record: numero, anno e tipologia identificano una decisione
 * sola in tutto il dataset di oggi, ma è un fatto misurato sul dato, non una
 * garanzia della Corte. Se due decisioni si chiamassero allo stesso modo,
 * entrambe prendono in coda il proprio ECLI — che è unico per definizione — e
 * nessuna delle due cambia indirizzo per colpa dell'altra. Meglio un indirizzo
 * brutto per due pronunce che due pronunce a un indirizzo solo.
 */
export function slugPronuncia<T extends PronunciaIndirizzabile>(
  pronuncia: T,
  tutte: readonly T[],
): string {
  const forma = formaLeggibile(pronuncia);
  const omonime = tutte.filter((altra) => formaLeggibile(altra) === forma);
  return omonime.length > 1 ? `${forma}--${ecliNelPercorso(pronuncia.ecli)}` : forma;
}

/** Percorso della pagina di una pronuncia. */
export function percorsoPronuncia<T extends PronunciaIndirizzabile>(
  pronuncia: T,
  tutte: readonly T[],
): string {
  return `/corte/${slugPronuncia(pronuncia, tutte)}`;
}

/** L'inversa di `slugPronuncia`: dallo slug alla decisione che indirizza. */
export function pronunciaDaSlug<T extends PronunciaIndirizzabile>(
  slug: string,
  tutte: readonly T[],
): T | null {
  return tutte.find((p) => slugPronuncia(p, tutte) === slug) ?? null;
}

/**
 * La pronuncia a cui punta un vecchio indirizzo, comunque sia scritto.
 *
 * In giro ci sono tre forme dello stesso indirizzo — `ECLI:IT:COST:2001:251`,
 * la stessa con i due punti codificati, e quella che il middleware riscrive —
 * e sono la stessa cosa. Si confrontano tutte sulla forma normalizzata invece
 * di indovinare quale sia arrivata.
 */
export function pronunciaDaEcli<T extends PronunciaIndirizzabile>(
  segmento: string,
  tutte: readonly T[],
): T | null {
  const cercato = ecliNelPercorso(decodificato(segmento));
  if (!cercato) return null;
  return tutte.find((p) => ecliNelPercorso(p.ecli) === cercato) ?? null;
}

/** Un segmento malformato non è un errore del server: è un indirizzo che non esiste. */
function decodificato(segmento: string): string {
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
}

/**
 * Una cifra di denaro, all'italiana e con la valuta detta.
 *
 * La valuta è un parametro e non una costante perché l'API del modello si paga
 * in dollari: scrivere «€ 12,35» su un costo fatturato in dollari sarebbe una
 * conversione che non abbiamo fatto, a un cambio che non conosciamo, su una
 * pagina che chiede agli altri di dichiarare da dove vengono i propri numeri.
 *
 * I decimali sono due, come su qualunque prezzo, tranne quando due
 * arrotonderebbero a «0,00» una spesa che c'è stata: quello sarebbe scrivere
 * «gratis» senza volerlo. Sopra quella soglia si resta a due anche per le cifre
 * piccole — in una colonna, «3,76» accanto a «0,0419» fa sembrare che le due
 * righe misurino cose diverse.
 */
export function denaro(valore: number, valuta = 'USD'): string {
  const rischioZero = valore !== 0 && Math.abs(valore) < 0.005;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: valuta,
    minimumFractionDigits: 2,
    maximumFractionDigits: rischioZero ? 4 : 2,
  }).format(valore);
}

/**
 * Come si cita una decisione della Corte: «Sentenza n. 251/2001».
 *
 * È la forma con cui la si cerca e con cui la citano gli atti, e non coincide
 * con l'ECLI — che è l'identificatore giusto per una macchina e illeggibile
 * per chiunque altro.
 */
export function titoloPronuncia(p: { tipologia: string; numero: string; anno: string }): string {
  return `${p.tipologia === 'O' ? 'Ordinanza' : 'Sentenza'} n. ${p.numero}/${p.anno}`;
}
