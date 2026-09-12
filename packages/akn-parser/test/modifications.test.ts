import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAkn } from '../src/akn.js';
import { parseModificationNarrative, parseModifications } from '../src/modifications.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

describe('parseModificationNarrative', () => {
  it('legge un’abrogazione di comma', () => {
    const [mod] = parseModificationNarrative(
      "ha disposto (con l'art. 217, comma 1, lettera ff)) l'abrogazione del comma 1 dell'art. 6.",
    );
    expect(mod?.action).toBe('abrogazione');
    expect(mod?.confidence).toBe('alta');
    expect(mod?.by.article).toBe('217');
    expect(mod?.by.paragraphs).toEqual(['1']);
    expect(mod?.target.article).toBe('6');
    expect(mod?.target.paragraphs).toEqual(['1']);
  });

  it('legge un’abrogazione di articolo', () => {
    const [mod] = parseModificationNarrative(
      "ha disposto (con l'art. 358, comma 1, lettera a)) l'abrogazione dell'art. 337 dell'Allegato F.",
    );
    expect(mod?.action).toBe('abrogazione');
    expect(mod?.target.article).toBe('337');
    expect(mod?.target.annex).toBe('F');
  });

  it('legge l’abrogazione dell’intero provvedimento', () => {
    const [mod] = parseModificationNarrative(
      "ha disposto (con l'art. 2269, comma 1) l'abrogazione dell'intero provvedimento.",
    );
    expect(mod?.action).toBe('abrogazione');
    expect(mod?.target.wholeAct).toBe(true);
    expect(mod?.target.article).toBeNull();
  });

  it('spezza una narrativa con più disposizioni', () => {
    const mods = parseModificationNarrative(
      "ha disposto (con l'art. 204, comma 1, lettera a)) la modifica dell'art. 120, comma 1; " +
        "(con l'art. 204, comma 1, lettera b)) l'introduzione del comma 2-bis all'art. 120; " +
        "(con l'art. 204, comma 1, lettera c)) la modifica dell'art. 120, comma 5.",
    );
    expect(mods).toHaveLength(3);
    expect(mods.map((m) => m.action)).toEqual(['modifica', 'introduzione', 'modifica']);
    expect(mods[1]?.target.paragraphs).toEqual(['2-bis']);
    expect(mods.every((m) => m.target.article === '120')).toBe(true);
  });

  it('legge la soppressione di lettere', () => {
    const [mod] = parseModificationNarrative(
      "ha disposto (con l'art. 177, comma 4) la soppressione delle lettere d) ed e) del comma 1 dell'art. 5.",
    );
    expect(mod?.action).toBe('abrogazione');
    expect(mod?.target.article).toBe('5');
    expect(mod?.target.paragraphs).toEqual(['1']);
    expect(mod?.target.letters).toEqual(['d', 'e']);
  });

  it('normalizza i suffissi ordinali', () => {
    const [mod] = parseModificationNarrative(
      "ha disposto (con l'art. 1, comma 1) la modifica dell'art. 3 bis, comma 2 ter.",
    );
    expect(mod?.target.article).toBe('3-bis');
    expect(mod?.target.paragraphs).toEqual(['2-ter']);
  });

  it('marca a bassa confidenza ciò che non riconosce', () => {
    const mods = parseModificationNarrative(
      "ha disposto (con l'art. 1, comma 1) qualcosa di non previsto dalla grammatica.",
    );
    expect(mods[0]?.confidence).toBe('bassa');
    expect(mods[0]?.action).toBe('altro');
  });

  it('non inventa nulla su input vuoto', () => {
    expect(parseModificationNarrative(null)).toEqual([]);
    expect(parseModificationNarrative('   ')).toEqual([]);
  });
});

describe('parseModifications sul d.lgs. 198/2006', () => {
  const act = parseAkn(readFileSync(join(FIXTURES, '2006-05-31_006G0216_ORIGINALE_V0.xml'), 'utf8'));
  const parsed = parseModifications(act.activeModifications);

  it('produce almeno una modifica per ogni textualMod con narrativa', () => {
    expect(parsed.length).toBeGreaterThanOrEqual(act.activeModifications.length);
  });

  it('la grande maggioranza è ad alta confidenza', () => {
    const alta = parsed.filter((m) => m.confidence === 'alta').length;
    expect(alta / parsed.length).toBeGreaterThan(0.9);
  });

  it('conserva sorgente e destinazione URN', () => {
    const withUrn = parsed.filter((m) => m.destination?.startsWith('urn:nir:'));
    expect(withUrn.length).toBeGreaterThan(0);
  });
});
