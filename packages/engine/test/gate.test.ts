import { describe, expect, it } from 'vitest';
import { applyGate, evaluateGate, THRESHOLD } from '../src/publication-gate.js';
import { CHECK_DEFINITIONS, checkById, checksByLevel } from '../src/registry.js';
import type { AnomalyFinding, CheckDefinition } from '../src/types.js';

const DETERMINISTICO: CheckDefinition = {
  id: 'det',
  level: 1,
  label: 'Controllo deterministico',
  description: 'Attraversa il grafo.',
  rule: 'SELECT 1',
  expectedPrecision: '~100%',
  deterministic: true,
};

const CON_ESTRAZIONE: CheckDefinition = {
  ...DETERMINISTICO,
  id: 'est',
  level: 3,
  deterministic: false,
};

describe('evaluateGate', () => {
  it('pubblica sopra soglia con campione sufficiente', () => {
    const d = evaluateGate(CON_ESTRAZIONE, { checkId: 'est', reviewed: 40, confirmed: 36 });
    expect(d.published).toBe(true);
    expect(d.precision).toBeCloseTo(0.9);
    expect(d.reason).toContain('90%');
  });

  it('non pubblica sotto soglia, anche con campione grande', () => {
    const d = evaluateGate(CON_ESTRAZIONE, { checkId: 'est', reviewed: 100, confirmed: 80 });
    expect(d.published).toBe(false);
    expect(d.reason).toContain('coda interna');
  });

  it('non pubblica con campione insufficiente, anche al 100%', () => {
    const d = evaluateGate(CON_ESTRAZIONE, { checkId: 'est', reviewed: 3, confirmed: 3 });
    expect(d.published).toBe(false);
    expect(d.reason).toContain('Campione insufficiente');
  });

  it('un controllo di livello 1 spiega perché tre casi non sono una precisione', () => {
    const d = evaluateGate(
      { ...DETERMINISTICO, id: 'l1', deterministic: false },
      { checkId: 'l1', reviewed: 3, confirmed: 3 },
    );
    expect(d.published).toBe(false);
    expect(d.reason).toContain('non è una precisione');
  });

  it('un controllo deterministico di livello 2 non ha l’esenzione', () => {
    // «Non usa un modello» e «non sbaglia» sono due cose diverse: il controllo
    // sulle fonti secondarie è deterministico e ha precisione attesa 70-85%.
    const d = evaluateGate({ ...DETERMINISTICO, id: 'l2', level: 2 }, undefined);
    expect(d.published).toBe(false);
    expect(d.reason).toContain('livello 2');
  });

  it('un controllo deterministico parte pubblicato e spiega perché', () => {
    const d = evaluateGate(DETERMINISTICO, undefined);
    expect(d.published).toBe(true);
    expect(d.reason).toContain('deterministico');
    expect(d.precision).toBeNull();
  });

  it('ma un controllo deterministico sotto soglia smette di pubblicare', () => {
    const d = evaluateGate(DETERMINISTICO, { checkId: 'det', reviewed: 40, confirmed: 20 });
    expect(d.published).toBe(false);
  });

  it('la soglia è quella dichiarata nel METODO', () => {
    expect(THRESHOLD.minPrecision).toBe(0.85);
    expect(THRESHOLD.minSample).toBe(30);
  });

  it('esattamente all’85% pubblica', () => {
    const d = evaluateGate(CON_ESTRAZIONE, { checkId: 'est', reviewed: 100, confirmed: 85 });
    expect(d.published).toBe(true);
  });

  it('sotto di un caso non pubblica', () => {
    const d = evaluateGate(CON_ESTRAZIONE, { checkId: 'est', reviewed: 100, confirmed: 84 });
    expect(d.published).toBe(false);
  });
});

describe('applyGate', () => {
  const finding = (checkId: string, id: string): AnomalyFinding => ({
    id,
    checkId,
    level: 1,
    title: 't',
    plainLanguage: 'p',
    urns: [],
    windowFrom: null,
    windowTo: null,
    rule: 'r',
    evidence: [],
    resolutions: [],
    severity: 'media',
  });

  it('separa senza scartare: la coda interna serve a far salire la precisione', () => {
    const decisions = new Map([
      ['a', evaluateGate({ ...DETERMINISTICO, id: 'a' }, undefined)],
      [
        'b',
        evaluateGate({ ...CON_ESTRAZIONE, id: 'b' }, { checkId: 'b', reviewed: 2, confirmed: 2 }),
      ],
    ]);
    const { published, queued } = applyGate(
      [finding('a', '1'), finding('b', '2'), finding('b', '3')],
      decisions,
    );
    expect(published.map((f) => f.id)).toEqual(['1']);
    expect(queued.map((f) => f.id)).toEqual(['2', '3']);
  });

  it('un controllo sconosciuto non pubblica', () => {
    const { published, queued } = applyGate([finding('ignoto', '1')], new Map());
    expect(published).toHaveLength(0);
    expect(queued).toHaveLength(1);
  });
});

describe('registro dei controlli', () => {
  it('ogni controllo dichiara la sua regola in chiaro', () => {
    for (const c of CHECK_DEFINITIONS) {
      expect(c.rule.length).toBeGreaterThan(20);
      expect(c.description.length).toBeGreaterThan(20);
      expect(c.expectedPrecision.length).toBeGreaterThan(3);
    }
  });

  it('gli identificatori sono unici', () => {
    const ids = CHECK_DEFINITIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('si trovano per id e per livello', () => {
    expect(checkById('modifica-ad-atto-abrogato')?.level).toBe(1);
    expect(checkById('inesistente')).toBeNull();
    expect(checksByLevel(1).length).toBeGreaterThan(0);
    expect(checksByLevel(3).every((c) => c.level === 3)).toBe(true);
  });

  it('nessun controllo di livello 1 dipende da un’estrazione', () => {
    expect(checksByLevel(1).every((c) => c.deterministic)).toBe(true);
  });
});
