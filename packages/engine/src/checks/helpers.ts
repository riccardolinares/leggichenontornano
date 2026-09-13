/**
 * Utilità condivise dai controlli: identificatori stabili, etichette leggibili,
 * costruzione delle prove.
 *
 * Le etichette sono qui e non dentro i singoli controlli perché la scheda
 * anomalia deve suonare allo stesso modo qualunque controllo l'abbia prodotta:
 * il lettore impara a leggerne una e le sa leggere tutte.
 */
import { createHash } from 'node:crypto';
import { humanLabel, tryParseUrn } from '@antinomia/akn-parser';
import type { ActView } from '../corpus-view.js';
import type { EvidenceItem } from '../types.js';

/** Identificatore stabile di una segnalazione: dipende solo da cosa segnala. */
export function findingId(checkId: string, ...parts: (string | null | undefined)[]): string {
  const hash = createHash('sha256')
    .update([checkId, ...parts.map((p) => p ?? '')].join('|'))
    .digest('hex')
    .slice(0, 20);
  return `${checkId}.${hash}`;
}

/**
 * Nome dell'atto come si direbbe parlando: «il decreto legislativo 50 del 2016».
 * Se l'URN non è analizzabile si mostra l'URN, che è brutto ma vero.
 */
export function actLabel(act: ActView | null, urn: string): string {
  const parsed = tryParseUrn(urn);
  if (!parsed) return urn;
  const base = humanLabel({
    authority: parsed.authority,
    measureType: parsed.measureType,
    date: parsed.date,
    number: parsed.number,
  });
  if (!act?.title) return base;
  return base;
}

/**
 * Genere grammaticale del tipo di atto, per concordare l'articolo.
 *
 * «Chi applica decreto legislativo 15 marzo 2010, n. 66» non è italiano, e una
 * scheda che deve reggere la lettura di un giurista non può permettersi di
 * suonare come una traduzione automatica. Sono due righe di codice e cambiano il
 * tono di ogni segnalazione.
 */
function femminile(measureType: string): boolean {
  return /^(legge|costituzione|deliberazione|circolare|ordinanza|direttiva)/.test(measureType);
}

/** «il decreto legislativo 15 marzo 2010, n. 66», «la legge 7 agosto 1990, n. 241». */
export function actLabelConArticolo(act: ActView | null, urn: string): string {
  const parsed = tryParseUrn(urn);
  if (!parsed) return urn;
  const nome = actLabel(act, urn);
  const minuscolo = `${nome.charAt(0).toLowerCase()}${nome.slice(1)}`;
  return `${femminile(parsed.measureType) ? 'la' : 'il'} ${minuscolo}`;
}

/** «al decreto legislativo …», «alla legge …»: la preposizione articolata. */
export function actLabelPreposizioneA(act: ActView | null, urn: string): string {
  const parsed = tryParseUrn(urn);
  if (!parsed) return `a ${urn}`;
  const nome = actLabel(act, urn);
  const minuscolo = `${nome.charAt(0).toLowerCase()}${nome.slice(1)}`;
  return `${femminile(parsed.measureType) ? 'alla' : 'al'} ${minuscolo}`;
}

/** Titolo breve dell'atto, troncato in modo leggibile. */
export function actTitle(act: ActView | null, max = 120): string {
  const title = act?.title ?? '';
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1).trimEnd()}…`;
}

/**
 * «art. 6, comma 1» oppure «art. 6», a seconda di cosa sappiamo.
 *
 * Quando l'articolo non c'è la relazione riguarda l'intero atto, e la frase va
 * costruita diversamente: «rinvia a l'intero atto di X» non è italiano. Chi
 * chiama questa funzione deve gestire il caso, e per ricordarglielo il valore
 * restituito è una locuzione che in una frase suona sbagliata se incollata senza
 * pensarci.
 */
export function partitionLabel(article: string | null, paragraphs: readonly string[] = []): string {
  if (!article) return 'l’intero atto';
  if (paragraphs.length === 0) return `art. ${article}`;
  if (paragraphs.length === 1) return `art. ${article}, comma ${paragraphs[0]}`;
  return `art. ${article}, commi ${paragraphs.join(', ')}`;
}

/** Data in forma leggibile: `2016-04-18` → «18 aprile 2016». */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return 'data non nota';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const mese = MESI[Number(m) - 1] ?? m;
  return `${Number(d)} ${mese} ${y}`;
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
];

/** Costruisce una prova tratta dal grafo. */
export function graphEvidence(
  urn: string,
  label: string,
  quote: string,
  window?: { from?: string | null; to?: string | null },
): EvidenceItem {
  return {
    urn,
    label,
    quote,
    inForceFrom: window?.from ?? null,
    inForceTo: window?.to ?? null,
    kind: 'grafo',
  };
}

/** Costruisce una prova tratta dal testo normativo, troncata ma mai riscritta. */
export function textEvidence(
  urn: string,
  label: string,
  text: string,
  window?: { from?: string | null; to?: string | null },
  max = 700,
): EvidenceItem {
  const quote = text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  return {
    urn,
    label,
    quote,
    inForceFrom: window?.from ?? null,
    inForceTo: window?.to ?? null,
    kind: 'testo',
  };
}

/** URN con partizione, es. `urn:nir:...;50~art3`. */
export function withPartition(urn: string, article: string | null): string {
  return article ? `${urn}~art${article}` : urn;
}
