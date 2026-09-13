/**
 * Come si scrive, in Gazzetta Ufficiale, il richiamo a una norma.
 *
 * Tutto quello che sta in questo file è deterministico e senza rete: dato un
 * URN e la posizione del mandato, produce le stringhe esatte da cercare. È la
 * parte che decide **cosa** chiediamo alla Gazzetta, ed è tenuta separata dalla
 * parte che gliela chiede perché è quella su cui si può ragionare leggendola.
 *
 * Il presupposto è una regola di tecnica legislativa, non una nostra ipotesi:
 * il preambolo di un provvedimento attuativo cita la disposizione che lo
 * prevede, e la cita per esteso.
 *
 *   Visto l'articolo 1, comma 5, della legge 22 maggio 2017, n. 81;
 *
 * È l'aggancio che rende la verifica possibile. Dove quell'aggancio non si può
 * costruire — l'atto non ha estremi citabili, il mandato non è agganciato a un
 * articolo, lo strumento non è nominato — la verifica non si fa, e si dice.
 */
import { tryParseUrn } from '@leggichenontornano/akn-parser';

/** Gli estremi di un atto, nella forma in cui la Gazzetta li scrive. */
export interface EstremiAtto {
  /** Tipo esteso senza trattini, es. `decreto legge`. Vedi `TIPI`. */
  tipo: string;
  /** Preposizione articolata da premettere al tipo: `della` o `del`. */
  preposizione: 'del' | 'della';
  /** Data del provvedimento, ISO. */
  data: string;
  /** Data come la scrive la Gazzetta, es. `22 maggio 2017`. */
  dataEstesa: string;
  numero: string;
  anno: number;
}

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
] as const;

/**
 * I tipi di atto che sappiamo citare.
 *
 * L'elenco è chiuso di proposito: un tipo che non sta qui produce
 * `non-verificabile`, che è l'esito giusto. Inventare la forma estesa di un
 * tipo sconosciuto significherebbe interrogare la Gazzetta con una stringa che
 * non compare in nessun preambolo e leggere lo zero risultati come una prova.
 */
const TIPI: Record<string, { tipo: string; preposizione: 'del' | 'della' }> = {
  legge: { tipo: 'legge', preposizione: 'della' },
  'legge.costituzionale': { tipo: 'legge costituzionale', preposizione: 'della' },
  // Il trattino di «decreto-legge» va tolto: il motore di ricerca della
  // Gazzetta lo interpreta come un operatore e la query degenera in
  // diciannovemila risultati. Verificato sul campo, ed è il tipo di dettaglio
  // che trasforma una verifica in un generatore di rumore.
  'decreto.legge': { tipo: 'decreto legge', preposizione: 'del' },
  'decreto.legislativo': { tipo: 'decreto legislativo', preposizione: 'del' },
  'decreto.del.presidente.della.repubblica': {
    tipo: 'decreto del Presidente della Repubblica',
    preposizione: 'del',
  },
  'decreto.del.presidente.del.consiglio.dei.ministri': {
    tipo: 'decreto del Presidente del Consiglio dei ministri',
    preposizione: 'del',
  },
  'regio.decreto': { tipo: 'regio decreto', preposizione: 'del' },
};

/** Estremi citabili di un atto, o `null` se l'URN non permette di costruirli. */
export function estremiDaUrn(urn: string): EstremiAtto | null {
  const parsed = tryParseUrn(urn);
  if (!parsed) return null;
  // Solo atti statali. La Serie Generale pubblica quelli, e una legge regionale
  // con la stessa data e lo stesso numero di una statale esiste eccome: senza
  // questo filtro si cercherebbe in Gazzetta un atto che in Gazzetta non c'è, e
  // si leggerebbe lo zero risultati come una prova.
  if (parsed.authority !== 'stato') return null;
  const tipo = TIPI[parsed.measureType];
  if (!tipo) return null;
  // Un numero con `bis` o una data parziale non si citano nella forma canonica:
  // meglio nessuna query che una query approssimata.
  if (!/^\d+$/.test(parsed.number)) return null;
  const [anno, mese, giorno] = parsed.date.split('-').map(Number) as [number, number, number];
  const nomeMese = MESI[mese - 1];
  if (!nomeMese || !giorno || !anno) return null;
  return {
    tipo: tipo.tipo,
    preposizione: tipo.preposizione,
    data: parsed.date,
    dataEstesa: `${giorno} ${nomeMese} ${anno}`,
    numero: parsed.number,
    anno,
  };
}

/**
 * La citazione più corta che identifica l'atto: data e numero, senza il tipo.
 *
 * Si usa per la domanda larga — «questo atto è mai citato in Gazzetta?» — e la
 * larghezza qui è una garanzia, non un difetto: se nemmeno questa stringa
 * compare da nessuna parte, allora certamente non compare la citazione di un
 * suo comma, e lo zero risultati diventa una prova invece di un sospetto.
 */
export function citazioneAtto(estremi: EstremiAtto): string {
  return `${estremi.dataEstesa}, n. ${estremi.numero}`;
}

/**
 * Le citazioni del singolo comma, dalla più probabile alla meno.
 *
 * Sono due forme, non dieci: `articolo` e `art.`. La Gazzetta cerca la frase
 * esatta, quindi ogni variante costa una richiesta, e una richiesta in più su
 * un sito pubblico va giustificata. Queste due coprono la stragrande
 * maggioranza dei preamboli; le altre producono un mancato ritrovamento, che
 * qui vale `non-verificabile` e non `non-adottato`.
 */
export function citazioniDelComma(
  estremi: EstremiAtto,
  articolo: string,
  comma: string | null,
): string[] {
  const coda = `${estremi.preposizione} ${estremi.tipo} ${citazioneAtto(estremi)}`;
  const posizione = comma ? `${articolo}, comma ${comma},` : `${articolo}`;
  return [`articolo ${posizione} ${coda}`, `art. ${posizione} ${coda}`];
}

/** Le famiglie di provvedimento che la Gazzetta distingue nel tipo dell'atto. */
export type FamigliaProvvedimento =
  'dpcm' | 'dpr' | 'ministeriale' | 'legislativo' | 'interministeriale';

/**
 * Che strumento chiede il mandato, letto dalla frase della legge.
 *
 * `null` quando la frase dice «con decreto» e basta. Non è un caso da
 * recuperare con un'euristica: senza sapere chi adotta non sappiamo in che
 * forma il provvedimento comparirà in Gazzetta, e una corrispondenza costruita
 * su questo sarebbe indovinata.
 */
export function famigliaAttesa(strumento: string): FamigliaProvvedimento[] | null {
  const s = strumento.toLowerCase().replace(/\s+/g, ' ');
  if (/d\.?\s?p\.?\s?c\.?\s?m\.?/.test(s) || /presidente del consiglio/.test(s)) return ['dpcm'];
  if (/presidente della repubblica/.test(s)) return ['dpr'];
  if (/ministr|minister/.test(s)) return ['ministeriale', 'interministeriale'];
  // Un regolamento statale si adotta con decreto del Presidente della
  // Repubblica o con decreto ministeriale (legge 400/1988, art. 17): le due
  // forme sono entrambe ammissibili e non c'è modo di stringere oltre.
  if (/^regolamento/.test(s)) return ['dpr', 'ministeriale', 'interministeriale'];
  return null;
}

/**
 * A quale famiglia appartiene il tipo che la Gazzetta stampa sopra il titolo.
 *
 * `null` per tutto ciò che non è un provvedimento — errata corrige, comunicati,
 * testi coordinati — e per le leggi: una legge non è mai l'attuazione di un
 * mandato che prevede un decreto.
 */
export function famigliaDalTipo(tipoGazzetta: string): FamigliaProvvedimento | null {
  const t = tipoGazzetta.toUpperCase().replace(/\s+/g, ' ').trim();
  if (t.startsWith('DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI')) return 'dpcm';
  if (t.startsWith('DECRETO DEL PRESIDENTE DELLA REPUBBLICA')) return 'dpr';
  if (t.startsWith('DECRETO LEGISLATIVO')) return 'legislativo';
  if (t.startsWith('DECRETO INTERMINISTERIALE')) return 'interministeriale';
  if (t.startsWith('DECRETO MINISTERIALE')) return 'ministeriale';
  // «DECRETO 3 marzo 2011» senza altro: è la forma con cui la Gazzetta stampa i
  // decreti ministeriali, e l'amministrazione che l'ha adottato sta nel titolo.
  if (/^DECRETO\s+\d/.test(t)) return 'ministeriale';
  return null;
}

/**
 * La clausola del preambolo che cita **questo** articolo e **questo** comma.
 *
 * È il controllo che regge l'intera verifica, e serve perché la ricerca della
 * Gazzetta è più larga di quanto sembri: interrogata con «articolo 2 del
 * decreto legge 29 dicembre 2010, n. 225» restituisce anche gli atti che
 * scrivono «Visto il comma 37, dell'articolo 2, del decreto-legge 29 dicembre
 * 2010, n. 225» — stessa citazione, altro ordine — e, con altrettanta
 * disinvoltura, atti che nominano quell'articolo e quella legge senza che
 * l'uno riguardi l'altra. Prendere per buono il risultato di ricerca
 * significherebbe pubblicare corrispondenze che non esistono.
 *
 * Qui si guarda il testo. Si cerca la clausola — i preamboli sono sequenze di
 * «Visto…» separate da punto e virgola — che contenga insieme gli estremi
 * dell'atto, il numero dell'articolo e il numero del comma. Se non c'è, la
 * corrispondenza non è dimostrata e la verifica lo dice.
 *
 * Si restituisce la clausola intera: una citazione tagliata a metà non si può
 * contestare, e una prova che non si può contestare non è una prova.
 */
export function clausolaDelPreambolo(
  preambolo: string,
  estremi: EstremiAtto,
  articolo: string,
  comma: string,
): string | null {
  for (const clausola of preambolo.replace(/\s+/g, ' ').split(';')) {
    if (citaIlMandato(clausola, estremi, articolo, comma)) return `${clausola.trim()};`;
  }
  return null;
}

/**
 * Un frammento di testo richiama insieme quell'atto, quell'articolo e quel comma?
 *
 * Le tre condizioni vanno verificate sullo stesso frammento, non sul documento
 * intero: una legge nominata all'inizio e un «comma 5» trecento righe più sotto
 * non sono una citazione, sono due cose che stanno nella stessa pagina.
 */
export function citaIlMandato(
  frammento: string,
  estremi: EstremiAtto,
  articolo: string,
  comma: string,
): boolean {
  const rifAtto = new RegExp(
    `${fuga(estremi.dataEstesa)}\\s*,?\\s*n\\.\\s*${fuga(estremi.numero)}(?![\\w-])`,
    'i',
  );
  const rifArticolo = new RegExp(`\\bart(?:icolo|\\.|\\b)\\s*${fuga(articolo)}(?![\\w-])`, 'i');
  return rifAtto.test(frammento) && rifArticolo.test(frammento) && citaIlComma(frammento, comma);
}

/**
 * Il frammento nomina proprio quel comma?
 *
 * Non basta che il numero compaia da qualche parte dopo la parola «comma»: in
 * «Visti i commi 2-novies, 2-decies e 2-undecies dell'articolo 2» un confronto
 * approssimato trova il «2» dell'articolo e conclude che si parli del comma 2,
 * che è una cosa diversa. Si legge invece l'elenco che segue la parola — i
 * preamboli scrivono «commi 107, 108, 109, 156» — e si guarda se il comma
 * cercato è fra quelli.
 */
function citaIlComma(frammento: string, comma: string): boolean {
  const NUMERO = String.raw`\d+(?:-[a-zà-ù]+)*`;
  const elenchi = frammento.matchAll(
    new RegExp(String.raw`\bcomm[aoi]\b\s*(${NUMERO}(?:\s*(?:,|e|ed)\s*${NUMERO})*)`, 'gi'),
  );
  const cercato = comma.toLowerCase();
  for (const elenco of elenchi) {
    const numeri = elenco[1]!.toLowerCase().split(/\s*(?:,|\be\b|\bed\b)\s*/);
    if (numeri.some((n) => n.trim() === cercato)) return true;
  }
  return false;
}

function fuga(valore: string): string {
  return valore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
