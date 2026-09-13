/**
 * Il controllo che può rifiutare un articolo.
 *
 * Questo file è il motivo per cui un modello linguistico può scrivere sul sito
 * di un progetto la cui prima regola è «niente prosa generata». Il modello non
 * decide niente: riceve una scheda di fatti già stabiliti da query
 * deterministiche e ci scrive attorno. Questa verifica controlla che non abbia
 * fatto altro.
 *
 * È volutamente severa e volutamente stupida. Non valuta se l'articolo è
 * scritto bene — valuta se contiene qualcosa che i fatti non sostengono. Un
 * articolo rifiutato non si pubblica: il lavoro quotidiano salta, e saltare un
 * giorno costa infinitamente meno di pubblicare una frase sbagliata su una
 * legge.
 */
import type { Articolo } from './articolo.js';
import type { Fatti } from './fatti.js';
import { fattiInTesto } from './fatti.js';

export interface Esito {
  ok: boolean;
  motivi: string[];
}

/**
 * Parole che trasformano un resoconto in un verdetto.
 *
 * Il progetto non dichiara nulla illegittimo, non dice che una norma «viola»
 * qualcosa e non prescrive cosa il legislatore dovrebbe fare. Sono i confini
 * dichiarati in METODO.md, e qui diventano un controllo che fallisce.
 */
const PAROLE_VIETATE = [
  'incostituzionale',
  'illegittim',
  'illegale',
  'viola la costituzione',
  'va abrogat',
  'dovrebbe essere abrogat',
  'il legislatore dovrebbe',
  'è un abuso',
  'è uno scandalo',
  'certamente',
  'senza dubbio',
  'sicuramente',
];

/**
 * Numeri che possono comparire senza stare nei fatti.
 *
 * Sono quelli che un testo italiano usa per contare le proprie parti — «due
 * norme», «il primo caso» — e che non affermano niente sul mondo. Restano
 * esclusi tutti gli altri, cioè date, numeri di articolo, numeri di legge e
 * quantità: quelli devono venire dalla scheda.
 */
const NUMERI_INNOCUI = new Set(['1', '2', '3', '4', '5']);

function numeriIn(testo: string): string[] {
  return [...testo.matchAll(/\d+/g)].map((m) => m[0]);
}

/** Le porzioni fra virgolette basse, che il progetto usa solo per le citazioni. */
function citazioniIn(testo: string): string[] {
  return [...testo.matchAll(/«([^»]+)»/g)].map((m) => m[1]!.trim());
}

function normalizza(testo: string): string {
  return testo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

export function verifica(articolo: Articolo, fatti: Fatti): Esito {
  const motivi: string[] = [];
  const scheda = fattiInTesto(fatti);
  const schedaNorm = normalizza(scheda);
  const numeriAmmessi = new Set(numeriIn(scheda));

  const prosa = [
    articolo.titolo,
    articolo.sommario,
    ...articolo.sezioni.flatMap((s) => [s.titolo, ...s.paragrafi]),
  ].join('\n');

  // 1. Ogni cifra deve venire dalla scheda.
  for (const n of numeriIn(prosa)) {
    if (numeriAmmessi.has(n) || NUMERI_INNOCUI.has(n)) continue;
    motivi.push(
      `il numero ${n} non compare nella scheda dei fatti: o viene da un'altra fonte, o è inventato`,
    );
  }

  // 2. Ogni virgolettato deve essere una citazione della scheda.
  for (const c of citazioniIn(prosa)) {
    if (schedaNorm.includes(normalizza(c))) continue;
    motivi.push(`la citazione «${c.slice(0, 60)}…» non corrisponde a nessun testo della scheda`);
  }

  // 3. Niente verdetti.
  const prosaNorm = normalizza(prosa);
  for (const parola of PAROLE_VIETATE) {
    if (prosaNorm.includes(parola)) {
      motivi.push(`la parola «${parola}» trasforma un resoconto in un verdetto`);
    }
  }

  // 4. L'articolo deve esistere davvero.
  if (articolo.titolo.trim().length < 15) motivi.push('il titolo è troppo corto per dire qualcosa');
  if (articolo.sommario.trim().length < 120) {
    motivi.push('il sommario è più corto di quanto serva a reggere da solo in un’anteprima');
  }
  if (articolo.sezioni.length < 2) motivi.push('servono almeno due sezioni');
  for (const s of articolo.sezioni) {
    if (s.paragrafi.length === 0) motivi.push(`la sezione «${s.titolo}» è vuota`);
    for (const p of s.paragrafi) {
      if (p.trim().length < 40) motivi.push(`un paragrafo della sezione «${s.titolo}» è mozzo`);
    }
  }

  // 5. Il legame con la segnalazione non si perde.
  if (articolo.anomaliaId !== fatti.anomaliaId) {
    motivi.push('l’articolo non è legato alla segnalazione da cui doveva nascere');
  }

  return { ok: motivi.length === 0, motivi };
}
