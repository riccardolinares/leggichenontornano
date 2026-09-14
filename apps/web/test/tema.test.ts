import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La tavolozza scura è scritta due volte, e deve restare la stessa.
 *
 * Serve in due casi che il CSS non sa unire in un selettore solo: il sistema
 * scuro senza una scelta esplicita (una media query, che vale anche senza
 * JavaScript) e la scelta esplicita «scuro» (un attributo sulla radice, che
 * deve vincere sul sistema).
 *
 * Due blocchi che divergono di un colore producono un tema scuro sbagliato
 * solo per metà delle persone, a seconda di come ci sono arrivate. È un guasto
 * che non si vede provando il sito, perché chi lo prova è in uno dei due casi.
 */

const CSS = readFileSync(join(import.meta.dirname, '..', 'app', 'globals.css'), 'utf8');

/**
 * La fine del blocco che si apre in `apertura`, contando le graffe.
 *
 * La prima versione la cercava per forma — «una graffa rientrata di due
 * spazi» — e funzionava solo finché nel file non ce n'erano altre più avanti.
 * Il giorno in cui il foglio di stile ne ha guadagnate (i blocchi di Tailwind,
 * in coda), quel criterio ha inghiottito tutto quello che veniva dopo e il
 * test ha letto settantaquattro variabili al posto di sedici.
 *
 * Il guasto era del controllo, non di quello che controllava: un blocco CSS
 * finisce dove le graffe si chiudono, non dove qualcuno ha scelto di
 * rientrare. Contarle è l'unico criterio che non dipende da come è formattato
 * il resto del file.
 */
function fineBlocco(apertura: number): number {
  let profondita = 0;
  for (let i = apertura; i < CSS.length; i++) {
    if (CSS[i] === '{') profondita++;
    else if (CSS[i] === '}') {
      profondita--;
      if (profondita === 0) return i;
    }
  }
  throw new Error('blocco CSS non chiuso in globals.css');
}

function tavolozza(selettore: string): Map<string, string> {
  const inizio = CSS.indexOf(selettore);
  expect(inizio, `selettore «${selettore}» non trovato in globals.css`).toBeGreaterThan(-1);
  const apertura = CSS.indexOf('{', inizio);
  const corpo = CSS.slice(apertura + 1, fineBlocco(apertura));
  const valori = new Map<string, string>();
  for (const riga of corpo.split('\n')) {
    const m = /^\s*(--[a-z-]+):\s*([^;]+);/.exec(riga);
    if (m) valori.set(m[1]!, m[2]!.trim());
  }
  return valori;
}

describe('tema scuro', () => {
  it('le due tavolozze scure dicono gli stessi colori', () => {
    const daSistema = tavolozza(":root:not([data-theme='light']) {");
    const daScelta = tavolozza(":root[data-theme='dark'] {");

    expect(daSistema.size, 'la tavolozza dal sistema è vuota').toBeGreaterThan(10);
    expect([...daScelta.keys()].sort()).toEqual([...daSistema.keys()].sort());
    for (const [nome, valore] of daSistema) {
      expect(daScelta.get(nome), `${nome} diverge fra le due tavolozze`).toBe(valore);
    }
  });

  it('la tavolozza chiara non sta dentro una media query', () => {
    // Se il chiaro fosse definito solo sotto `prefers-color-scheme: light`,
    // chi sceglie «chiaro» avendo il sistema scuro resterebbe senza colori.
    const primaMediaQuery = CSS.indexOf('@media');
    const radice = CSS.indexOf(':root {');
    expect(radice).toBeGreaterThan(-1);
    expect(radice).toBeLessThan(primaMediaQuery);
  });
});
