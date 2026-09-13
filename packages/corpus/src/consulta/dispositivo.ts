/**
 * Lettura del dispositivo di una pronuncia della Corte costituzionale.
 *
 * Il dispositivo è la parte in cui la Corte scrive cosa ha deciso, con una
 * formula fissa da settant'anni:
 *
 *   «dichiara l'illegittimità costituzionale dell'art. 42, comma 5, del decreto
 *    legislativo 26 marzo 2001, n. 151 (…), nella parte in cui non include…»
 *
 * Questo modulo estrae **gli estremi della norma nominata**. Non riassume la
 * motivazione, non valuta la questione, non decide niente: il giudizio è già
 * stato dato dall'unico organo che può darlo, e noi copiamo il riferimento.
 *
 * Tre cose che il parser si rifiuta di fare, tutte per lo stesso motivo — una
 * relazione sbagliata qui direbbe che una norma vigente è caduta, che è la cosa
 * più dannosa che questo progetto possa dire:
 *
 *  1. Le leggi **regionali** e provinciali non entrano. Il nostro spazio di URN
 *     è statale: «legge della Regione Lazio 23 gennaio 2006, n. 2» diventerebbe
 *     `urn:nir:stato:legge:2006-01-23;2`, che è una legge dello Stato diversa e
 *     probabilmente esistente.
 *  2. Quando la formula nomina **più atti** (il decreto-legge, la sua legge di
 *     conversione, la norma che il decreto modificava) la relazione nasce a
 *     confidenza bassa. Il primo atto nominato è quasi sempre quello
 *     dichiarato illegittimo, ma «quasi sempre» non basta per l'alta.
 *  3. Le **pronunce interpretative di rigetto** e le declaratorie di
 *     inammissibilità o infondatezza non producono niente. Solo la formula
 *     «dichiara l'illegittimità costituzionale» produce una relazione.
 */
import { parseActCitations, type ActCitation } from '@leggichenontornano/akn-parser';

/** Una dichiarazione di illegittimità, come sta scritta nel dispositivo. */
export interface DichiarazioneIllegittimita {
  /** ECLI della pronuncia. */
  ecli: string;
  /** URN dell'atto dichiarato illegittimo, o `null` se non statale/riconoscibile. */
  actUrn: string | null;
  /** Articoli nominati, nell'ordine in cui compaiono. */
  articles: string[];
  /** Commi nominati, quando la formula li specifica. */
  paragraphs: string[];
  /** Lettere nominate, quando la declaratoria colpisce singole lettere di un comma. */
  letters: string[];
  /**
   * `parziale` quando la Corte limita la declaratoria («nella parte in cui»,
   * «limitatamente a»): la norma resta, cambia il suo contenuto. `totale`
   * quando cade per intero. La distinzione è della Corte, non nostra: sta nella
   * presenza della formula limitativa.
   */
  scope: 'totale' | 'parziale';
  /** Alta quando il dispositivo nomina un solo atto; bassa quando ne nomina più d'uno. */
  confidence: 'alta' | 'bassa';
  /** Perché la confidenza è quella che è, in lingua comune. */
  confidenceReason: string;
  /** La frase da cui tutto questo è stato letto, per poterla rileggere. */
  quote: string;
  /** Motivo per cui non si è prodotto un URN, quando `actUrn` è `null`. */
  skipped: string | null;
}

const FORMULA = /dichiara\s+l['’]illegittimit[aà]\s+costituzionale\s*/gi;

/** Dove finisce una statuizione e comincia la successiva. */
const PROSSIMA_STATUIZIONE =
  /(?:;|\.)\s*(?:\d+\)|[a-z]\)|\d+\.\d*)?\s*(?:dichiara|riservata|riuniti|ordina|sospende|così\s+deciso)\b/i;

/**
 * Formule con cui la Corte **limita** la declaratoria.
 *
 * Il testo che segue queste formule non contiene la norma dichiarata
 * illegittima: contiene le norme che servono a delimitare la declaratoria. Le
 * citazioni che stanno lì dentro non devono diventare relazioni.
 */
// Attenzione al confine finale: `limitatamente\s+a\b` non corrisponde mai in
// «limitatamente alle parole», perché fra la «a» e la «l» non c'è alcun
// confine di parola. È lo stesso inciampo di `\bpuò\b` sull'accento, e anche
// qui l'effetto era silenzioso: la declaratoria parziale veniva registrata
// come totale, cioè come se la norma fosse caduta per intero.
const LIMITAZIONE =
  /\b(?:nella\s+parte\s+in\s+cui\b|nei\s+limiti\s+in\s+cui\b|limitatamente\s+a|nella\s+misura\s+in\s+cui\b|in\s+quanto\s+(?:non\s+)?prevede\b|nei\s+sensi\s+di\s+cui\s+in\s+motivazione\b)/i;

/**
 * Atti che non appartengono allo spazio di URN statale.
 *
 * Non solo «legge della Regione X»: anche le deliberazioni statutarie, gli
 * statuti regionali e tutto ciò che un Consiglio regionale o provinciale adotta.
 * Trovato sul corpus reale, ed è il caso peggiore di tutti — vedi `TITOLI`.
 */
const NON_STATALE =
  /\blegg[ei]\s+(?:della\s+)?(?:regione|regionale|provincia\s+autonoma|provinciale)\b|\blegg[ei]\s+regional[ei]\b|\blegg[ei]\s+provincial[ei]\b|\blegge\s+della\s+Provincia\b|\bconsiglio\s+(?:regionale|provinciale)\b|\bdeliberazione\s+legislativa\b|\bstatut[oi]\s+(?:della\s+)?region|\bdella\s+Regione\s+[A-Z]|\bdella\s+Provincia\s+autonoma\b/i;

/**
 * Titoli di atti citati dentro la statuizione: parentesi e virgolette.
 *
 * Vanno rimossi **prima** di cercare la norma dichiarata illegittima, e il
 * motivo è un caso reale che questo parser ha sbagliato:
 *
 *   «Dichiara l'illegittimità costituzionale della deliberazione legislativa
 *    statutaria adottata […] dal Consiglio regionale della Regione Marche e
 *    recante "Disciplina transitoria in attuazione dell'articolo 3 della legge
 *    costituzionale 22 novembre 1999, n. 1".»
 *
 * L'unica citazione datata sta **dentro il titolo** dell'atto regionale, e
 * presa per buona faceva dire al grafo che l'art. 3 di una legge costituzionale
 * era stato dichiarato illegittimo. Una legge costituzionale vigente, marcata
 * come caduta, da un arco solo.
 *
 * La stessa rimozione toglie anche il rumore innocuo: i titoli dei codici
 * citano le direttive che attuano, e quelle non c'entrano niente.
 */
const TITOLI = /\([^()]*\)|«[^»]*»|"[^"]*"|“[^”]*”/g;

/**
 * «convertito, con modificazioni, nella legge 29 novembre 2007, n. 222».
 *
 * La legge di conversione non è l'atto dichiarato illegittimo: è l'atto che ha
 * convertito quello dichiarato illegittimo. Tutto ciò che segue questa formula
 * nomina altri atti, e nessuno di essi è il bersaglio.
 */
const CONVERSIONE = /\bconvertit[oa]\b|\bconversione\s+in\s+legge\b|\bcome\s+modificat[oa]\s+da/i;

/** «art. 4», «articolo 42», «artt. 8, 13 e 14», «art. 15-nonies», «art. 168-bis». */
const ARTICOLO_RE =
  /\bart(?:icol[oi]|t?)\.?\s*(\d+(?:[-\s]?(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?)/gi;

const SUFFISSO = '(?:[-\\s]?(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies))?';

const COMMA_RE = new RegExp(String.raw`\bcomma\s+(\d+${SUFFISSO})`, 'gi');

/**
 * «commi 1, 2, 3 e 4»: la Corte elenca i commi colpiti in un blocco solo.
 *
 * Senza questa forma il comma esatto si perdeva in silenzio proprio nelle
 * declaratorie più ampie, cioè quelle che colpiscono più commi insieme.
 */
const COMMI_ELENCO_RE = new RegExp(
  String.raw`\bcommi\s+((?:\d+${SUFFISSO}(?:\s*(?:,|e|ed)\s*)?)+)`,
  'gi',
);

/**
 * «art. 20, **sedicesimo comma**»: nelle leggi anteriori alla prassi corrente i
 * commi si contano a parole, e la Corte cita come cita la legge. Sono un decimo
 * delle declaratorie risolte: ignorarli perderebbe il comma esatto proprio
 * nelle norme più vecchie, che sono quelle con più rinvii addosso.
 */
const ORDINALI: Readonly<Record<string, string>> = {
  primo: '1',
  secondo: '2',
  terzo: '3',
  quarto: '4',
  quinto: '5',
  sesto: '6',
  settimo: '7',
  ottavo: '8',
  nono: '9',
  decimo: '10',
  undicesimo: '11',
  dodicesimo: '12',
  tredicesimo: '13',
  quattordicesimo: '14',
  quindicesimo: '15',
  sedicesimo: '16',
  diciassettesimo: '17',
  diciottesimo: '18',
  diciannovesimo: '19',
  ventesimo: '20',
};

const COMMA_ORDINALE_RE = new RegExp(
  String.raw`\b(${Object.keys(ORDINALI).join('|')})\s+comma\b`,
  'gi',
);

/** «lettera b)», «lettere b), c) e d)». */
const LETTERA_RE = /\blettere?\s+((?:[a-z]\)(?:\s*(?:,|e|ed)\s*)?)+)/gi;

/**
 * Le dichiarazioni di illegittimità contenute in un dispositivo.
 *
 * Un dispositivo può contenerne più d'una — è comune nei giudizi in via
 * principale, dove la Corte decide su molte disposizioni insieme.
 */
export function parseDispositivo(ecli: string, dispositivo: string): DichiarazioneIllegittimita[] {
  const testo = dispositivo.split(/Così\s+deciso/i)[0] ?? dispositivo;
  const out: DichiarazioneIllegittimita[] = [];
  const re = new RegExp(FORMULA.source, FORMULA.flags);
  let m: RegExpExecArray | null;

  while ((m = re.exec(testo)) !== null) {
    const resto = testo.slice(m.index + m[0].length);
    const fine = PROSSIMA_STATUIZIONE.exec(resto);
    const statuizione = fine ? resto.slice(0, fine.index) : resto;
    const dichiarazione = leggiStatuizione(ecli, statuizione);
    if (dichiarazione) out.push(dichiarazione);
  }
  return out;
}

function leggiStatuizione(ecli: string, statuizione: string): DichiarazioneIllegittimita | null {
  const limite = LIMITAZIONE.exec(statuizione);
  // Il riferimento sta **prima** della formula limitativa. Dopo ci sono le
  // norme che delimitano la declaratoria, che sono un'altra cosa.
  const conTitoli = limite ? statuizione.slice(0, limite.index) : statuizione;
  // I titoli degli atti citati non contengono la norma dichiarata illegittima:
  // contengono il nome di un altro atto. Si tolgono prima di cercare.
  const senzaTitoli = conTitoli.replace(TITOLI, ' ');
  // Ciò che segue la formula di conversione nomina la legge di conversione, non
  // la norma caduta.
  const conversione = CONVERSIONE.exec(senzaTitoli);
  const testa = conversione ? senzaTitoli.slice(0, conversione.index) : senzaTitoli;
  const quote = statuizione.trim().slice(0, 400);
  const scope: 'totale' | 'parziale' = limite ? 'parziale' : 'totale';

  const articles = uniq(matchAll(testa, ARTICOLO_RE).map(normalizzaNumero));
  const paragraphs = uniq([
    ...matchAll(testa, COMMA_RE).map(normalizzaNumero),
    ...matchAll(testa, COMMI_ELENCO_RE).flatMap((blocco) =>
      blocco
        .split(/\s*(?:,|\be\b|\bed\b)\s*/)
        .map(normalizzaNumero)
        .filter((n) => /^\d/.test(n)),
    ),
    ...matchAll(testa, COMMA_ORDINALE_RE).map(
      (o) => ORDINALI[o.toLowerCase()] ?? normalizzaNumero(o),
    ),
  ]);
  const letters = uniq(
    matchAll(testa, LETTERA_RE).flatMap((blocco) =>
      [...blocco.matchAll(/([a-z])\)/g)].map((m) => m[1]!),
    ),
  );

  if (NON_STATALE.test(conTitoli)) {
    return {
      ecli,
      actUrn: null,
      articles,
      paragraphs,
      letters,
      scope,
      confidence: 'bassa',
      confidenceReason: 'norma regionale o provinciale: fuori dallo spazio di URN statale',
      quote,
      skipped: 'legge regionale o provinciale',
    };
  }

  const citazioni: ActCitation[] = parseActCitations(testa);
  if (citazioni.length === 0) {
    return {
      ecli,
      actUrn: null,
      articles,
      paragraphs,
      letters,
      scope,
      confidence: 'bassa',
      confidenceReason:
        'il dispositivo non nomina un atto con data e numero: spesso è un codice, citato per nome',
      quote,
      skipped: 'nessun atto datato nel dispositivo',
    };
  }

  const piuAtti = citazioni.length > 1;
  return {
    ecli,
    actUrn: citazioni[0]!.urn,
    articles,
    paragraphs,
    letters,
    scope,
    confidence: piuAtti ? 'bassa' : 'alta',
    confidenceReason: piuAtti
      ? `il dispositivo nomina ${citazioni.length} atti (di solito il decreto, la sua legge di conversione e la norma modificata): il primo è quasi sempre quello dichiarato illegittimo, e «quasi sempre» non basta`
      : 'il dispositivo nomina un solo atto, con data e numero',
    quote,
    skipped: null,
  };
}

/**
 * I gruppi catturati, grezzi.
 *
 * Grezzi e non normalizzati: un elenco come «commi 1, 2 e 4» va spezzato prima
 * di poter normalizzare i pezzi, e normalizzare il blocco intero lo
 * trasformava in un unico numero senza senso.
 */
function matchAll(text: string, re: RegExp): string[] {
  const local = new RegExp(re.source, re.flags);
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = local.exec(text)) !== null) out.push(m[1]!);
  return out;
}

/** «3 bis» e «3-BIS» sono lo stesso comma. */
function normalizzaNumero(value: string): string {
  return value.trim().replace(/\s+/g, '-').toLowerCase();
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}
