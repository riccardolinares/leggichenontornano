import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeArticleNumber, parseAkn, parseFrbrPath } from '../src/akn.js';
import { parseVersionFileName } from '../src/filenames.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

const LCOST_V0 = '1953-03-14_053C0001_ORIGINALE_V0.xml';
const DLGS198 = '2006-05-31_006G0216_ORIGINALE_V0.xml';

describe('parseAkn su dati reali di Normattiva', () => {
  const act = parseAkn(read(LCOST_V0));

  it('estrae l’URN:NIR', () => {
    expect(act.urn).toBe('urn:nir:stato:legge.costituzionale:1953-03-11;1');
  });

  it('estrae l’ELI', () => {
    expect(act.eli).not.toBeNull();
    expect(act.eli?.editorialCode).toBe('053C0001');
    expect(act.eli?.versionKind).toBe('ORIGINAL');
  });

  it('estrae il titolo senza il codice redazionale', () => {
    expect(act.title.length).toBeGreaterThan(10);
    expect(act.title).not.toMatch(/\(\w{8}\)$/);
  });

  it('estrae tipo di atto e autorità dal path FRBR', () => {
    expect(act.actType).toBe('legge_costituzionale');
    expect(act.authority).toBe('stato');
  });

  it('estrae le date, distinguendo pubblicazione ed entrata in vigore', () => {
    expect(act.workDate).toBe('1953-03-11');
    expect(act.publication?.date).toBe('1953-03-14');
    // Il testo originale entra in vigore dopo la vacatio legis: l'Expression
    // porta la data di entrata in vigore, non quella di pubblicazione.
    expect(act.expressionDate).toBe('1953-03-29');
  });

  it('estrae gli articoli con numero normalizzato', () => {
    expect(act.articles.length).toBeGreaterThan(0);
    expect(act.articles[0]?.number).toBe('1');
    expect(act.articles[0]?.text.length).toBeGreaterThan(20);
  });

  it('marca la versione originale come non consolidata', () => {
    expect(act.consolidated).toBe(false);
  });
});

describe('parseAkn su una versione consolidata', () => {
  const act = parseAkn(read('1953-03-14_053C0001_VIGENZA_1989-01-18_V3.xml'));

  it('riconosce la versione consolidata', () => {
    expect(act.consolidated).toBe(true);
    expect(act.eli?.inForceAt).toBe('1989-01-18');
  });

  it('porta la data di vigenza sull’Expression', () => {
    expect(act.expressionDate).toBe('1989-01-18');
  });

  it('ha lo stesso URN del testo originale', () => {
    expect(act.urn).toBe('urn:nir:stato:legge.costituzionale:1953-03-11;1');
  });
});

describe('parseAkn: relazioni', () => {
  const act = parseAkn(read(DLGS198));

  it('estrae le modifiche attive verso altri atti', () => {
    expect(act.activeModifications.length).toBeGreaterThan(0);
    const mod = act.activeModifications[0]!;
    expect(mod.destination).toMatch(/^urn:nir:/);
    expect(mod.narrative).toBeTruthy();
  });

  it('estrae i rinvii con href', () => {
    expect(act.references.length).toBeGreaterThan(0);
    expect(act.references.every((r) => r.href.length > 0)).toBe(true);
  });
});

describe('helper', () => {
  it('normalizza i numeri di articolo', () => {
    expect(normalizeArticleNumber('Art. 12.')).toBe('12');
    expect(normalizeArticleNumber('Art. 3-bis.')).toBe('3-bis');
    expect(normalizeArticleNumber('Art. 3 bis')).toBe('3-bis');
    expect(normalizeArticleNumber(null)).toBeNull();
  });

  it('legge il path FRBR', () => {
    expect(parseFrbrPath('/akn/it/act/decreto_legislativo/stato/2016-04-18/50/!main')).toEqual({
      actType: 'decreto_legislativo',
      authority: 'stato',
    });
  });

  it('legge i nomi dei file di versione', () => {
    expect(parseVersionFileName('1963-02-01_063C0001_VIGENZA_2013-03-03_V12.xml')).toEqual({
      publicationDate: '1963-02-01',
      editorialCode: '063C0001',
      kind: 'vigenza',
      inForceFrom: '2013-03-03',
      ordinal: 12,
    });
    expect(parseVersionFileName('1963-02-01_063C0001_ORIGINALE_V0.xml')?.kind).toBe('originale');
    expect(parseVersionFileName('qualcosaltro.xml')).toBeNull();
  });
});
