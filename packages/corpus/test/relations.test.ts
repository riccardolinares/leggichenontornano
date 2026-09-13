import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAkn } from '@antinomia/akn-parser';
import { describe, expect, it } from 'vitest';
import { buildRelations, relationId } from '../src/graph/build-relations.js';
import { isHigherRank, isPrimarySource, sourceRank, sourceRankLabel } from '../src/source-rank.js';

const FIXTURE = join(
  import.meta.dirname,
  '../../akn-parser/test/fixtures/2006-05-31_006G0216_ORIGINALE_V0.xml',
);

describe('buildRelations', () => {
  const act = parseAkn(readFileSync(FIXTURE, 'utf8'));

  it('produce archi tipizzati e datati dalle modifiche dichiarate', () => {
    const relations = buildRelations(act, { includeReferences: false });
    expect(relations.length).toBeGreaterThan(0);
    expect(
      relations.every((r) => r.sourceUrn === 'urn:nir:stato:decreto.legislativo:2006-04-11;198'),
    ).toBe(true);
    expect(relations.every((r) => r.effectiveFrom !== null)).toBe(true);
    expect(new Set(relations.map((r) => r.type)).size).toBeGreaterThan(0);
  });

  it('conserva la prova testuale su ogni arco di modifica', () => {
    const relations = buildRelations(act, { includeReferences: false });
    expect(relations.every((r) => (r.evidence ?? '').length > 0)).toBe(true);
  });

  it('aggiunge gli archi RINVIA solo se richiesto', () => {
    const senza = buildRelations(act, { includeReferences: false });
    const con = buildRelations(act, { includeReferences: true });
    expect(con.length).toBeGreaterThan(senza.length);
    expect(senza.some((r) => r.type === 'RINVIA')).toBe(false);
    expect(con.some((r) => r.type === 'RINVIA')).toBe(true);
  });

  it('non crea archi verso se stesso', () => {
    const relations = buildRelations(act, { includeReferences: true });
    expect(relations.some((r) => r.type === 'RINVIA' && r.targetUrn === r.sourceUrn)).toBe(false);
  });

  it('produce identificatori stabili fra due esecuzioni', () => {
    const a = buildRelations(act, { includeReferences: true }).map((r) => r.id);
    const b = buildRelations(act, { includeReferences: true }).map((r) => r.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('relationId dipende da tutti i campi che distinguono un arco', () => {
    const base = {
      type: 'MODIFICA' as const,
      sourceUrn: 'urn:nir:stato:legge:2000-01-01;1',
      sourceArticle: '1',
      sourceParagraph: null,
      targetUrn: 'urn:nir:stato:legge:1990-01-01;2',
      targetArticle: '3',
      targetParagraphs: ['1'],
      targetLetters: [],
      targetAnnex: null,
      wholeAct: false,
      effectiveFrom: '2000-01-01',
      evidence: null,
      confidence: 'alta' as const,
      origin: 'activeModifications' as const,
    };
    expect(relationId(base)).not.toBe(relationId({ ...base, targetArticle: '4' }));
    expect(relationId(base)).not.toBe(relationId({ ...base, targetParagraphs: ['2'] }));
    // La prova e la data non entrano nell'identità: un arco che cambia solo
    // formulazione redazionale resta lo stesso arco.
    expect(relationId(base)).toBe(relationId({ ...base, evidence: 'altro testo' }));
  });
});

describe('gerarchia delle fonti', () => {
  it('ordina le fonti principali', () => {
    expect(sourceRank('costituzione')).toBeLessThan(sourceRank('legge'));
    expect(sourceRank('legge')).toBeLessThan(sourceRank('decreto_ministeriale'));
    expect(sourceRank('decreto_del_presidente_della_repubblica')).toBeLessThan(
      sourceRank('decreto_ministeriale'),
    );
  });

  it('assegna un rango prudente a ciò che non conosce', () => {
    expect(sourceRank('qualcosa_di_ignoto')).toBe(45);
    expect(sourceRank(null)).toBe(45);
    expect(sourceRankLabel('qualcosa_di_ignoto')).toBe('Fonte non classificata');
  });

  it('distingue fonti primarie e secondarie', () => {
    expect(isPrimarySource(sourceRank('legge'))).toBe(true);
    expect(isPrimarySource(sourceRank('decreto_ministeriale'))).toBe(false);
    expect(isHigherRank(sourceRank('legge'), sourceRank('decreto_ministeriale'))).toBe(true);
  });

  it('etichetta le fonti in modo leggibile', () => {
    expect(sourceRankLabel('legge_costituzionale')).toBe('Legge costituzionale');
    expect(sourceRankLabel('decreto_legislativo')).toBe('Decreto legislativo');
  });
});
