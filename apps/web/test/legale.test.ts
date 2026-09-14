import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGINE_LEGALI, PERCORSI_LEGALI } from '../lib/legale';

/**
 * Le pagine legali non pubblicano segnaposto.
 *
 * Per giorni l'informativa privacy ha mostrato in produzione le parentesi
 * quadre del modello: «[Nome e cognome o ragione sociale del titolare]». Il
 * codice lo diceva — «da riempire prima di pubblicare il sito» — e il sito è
 * stato pubblicato lo stesso, perché quella frase era un commento e non un
 * controllo.
 *
 * Chi arrivava lì non leggeva «questo dato manca»: leggeva una pagina che
 * sembrava un modello mai finito, e da lì non sapeva più cosa credere del
 * resto del sito. Su una pagina legale è il danno peggiore possibile, perché è
 * esattamente la pagina che qualcuno apre quando ha un dubbio.
 *
 * Una lacuna si dichiara a parole. Un segnaposto no.
 */

const RADICE = join(import.meta.dirname, '..', 'app', 'legal');

function sorgenti(): { file: string; testo: string }[] {
  const trovati: { file: string; testo: string }[] = [];
  for (const voce of readdirSync(RADICE, { withFileTypes: true, recursive: true })) {
    if (!voce.isFile() || !voce.name.endsWith('.tsx')) continue;
    const percorso = join(voce.parentPath ?? RADICE, voce.name);
    trovati.push({
      file: percorso.slice(RADICE.length + 1),
      testo: readFileSync(percorso, 'utf8'),
    });
  }
  return trovati;
}

describe('pagine legali', () => {
  it('non contengono segnaposto fra parentesi quadre', () => {
    /* Si cercano le parentesi quadre che racchiudono una frase in italiano:
       sono la forma in cui arrivano i modelli. Restano fuori le parentesi del
       codice — indici, array, tipi — che in un `.tsx` sono ovunque e non
       c'entrano niente. */
    const segnaposto = /\[[A-ZÀ-Ù][^\]]{12,}\]/g;
    const colti: string[] = [];
    for (const { file, testo } of sorgenti()) {
      for (const m of testo.matchAll(segnaposto)) colti.push(`${file}: ${m[0]}`);
    }
    expect(
      colti,
      'Queste pagine legali pubblicano un segnaposto. Una lacuna si dichiara a parole — ' +
        'il titolare non ancora indicato si scrive, non si lascia fra parentesi quadre.',
    ).toEqual([]);
  });

  it('ogni pagina dichiarata ha una data di revisione e un sommario', () => {
    // L'elenco dei percorsi e quello delle pagine devono restare d'accordo:
    // l'indice legge dal primo, le pagine dal secondo.
    expect(PERCORSI_LEGALI.length).toBe(PAGINE_LEGALI.length + 1);
    for (const p of PAGINE_LEGALI) {
      expect(p.aggiornataIl, `${p.percorso} senza data`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.sommario.length, `${p.percorso} senza sommario`).toBeGreaterThan(30);
    }
  });
});
