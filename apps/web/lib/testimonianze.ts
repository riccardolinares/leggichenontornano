import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Le testimonianze, lette da un file versionato.
 *
 * **Nessuna voce può essere scritta da noi.** Ogni riga riporta parole che
 * qualcun altro ha scritto in pubblico, con il collegamento al posto dove le
 * ha scritte: chi legge deve poterle verificare senza fidarsi. Una citazione
 * elogiativa senza fonte è esattamente quello che questo progetto rimprovera a
 * chi cita una legge senza citarne la data.
 */

export type Fonte = 'linkedin' | 'x' | 'facebook' | 'telegram' | 'articolo' | 'video' | 'privata';

export interface Testimonianza {
  testo: string;
  autore: string;
  ruolo?: string;
  fonte: Fonte;
  /** Obbligatorio per tutte le fonti tranne «privata». */
  url?: string;
  data?: string;
}

const PERCORSO =
  process.env['LCNT_TESTIMONIANZE'] ??
  join(process.cwd(), '..', '..', 'data', 'testimonianze.json');

let cache: Testimonianza[] | null = null;

export function testimonianze(): Testimonianza[] {
  if (cache !== null) return cache;
  if (!existsSync(PERCORSO)) {
    cache = [];
    return cache;
  }
  const lette = JSON.parse(readFileSync(PERCORSO, 'utf8')) as Testimonianza[];

  /* Una testimonianza pubblica senza collegamento non si mostra. Non è
     pignoleria: sarebbe una frase fra virgolette che nessuno può controllare,
     su un sito che chiede agli altri di controllare tutto. */
  cache = lette.filter((t) => t.fonte === 'privata' || (t.url ?? '').length > 0);
  return cache;
}

export const ETICHETTA_FONTE: Readonly<Record<Fonte, string>> = {
  linkedin: 'su LinkedIn',
  x: 'su X',
  facebook: 'su Facebook',
  telegram: 'su Telegram',
  articolo: 'in un articolo',
  video: 'in un video',
  privata: 'scritto in privato, pubblicato con il suo consenso',
};
