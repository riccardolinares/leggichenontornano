import { describe, expect, it } from 'vitest';
import { fromAknPath, normalizeHref, readFragment } from '../src/graph/href.js';

describe('fromAknPath', () => {
  it('converte un path AKN statale in URN:NIR', () => {
    expect(fromAknPath('/akn/it/act/legge/stato/1988-08-23/400/!main')).toEqual({
      kind: 'nir',
      urn: 'urn:nir:stato:legge:1988-08-23;400',
    });
  });

  it('riporta il punto nei tipi composti', () => {
    expect(fromAknPath('/akn/it/act/decreto_legislativo/stato/2016-04-18/50/!main')).toEqual({
      kind: 'nir',
      urn: 'urn:nir:stato:decreto.legislativo:2016-04-18;50',
    });
  });

  it('tiene distinti i rinvii sovranazionali', () => {
    expect(fromAknPath('/akn/it/act/direttivaUe/eu/2014/23/!main')).toEqual({
      kind: 'eu',
      euId: 'eu:direttivaUe:2014;23',
    });
  });

  it('restituisce null su un path che non contiene `act`', () => {
    expect(fromAknPath('/qualcosa/altro')).toBeNull();
  });
});

describe('normalizeHref', () => {
  it('legge un href AKN con frammento di articolo', () => {
    const ref = normalizeHref('/akn/it/act/legge/stato/1988-08-23/400/!main#art_14');
    expect(ref.kind).toBe('nir');
    expect(ref.urn).toBe('urn:nir:stato:legge:1988-08-23;400');
    expect(ref.article).toBe('14');
  });

  it('legge un href già in forma URN con frammento redazionale', () => {
    const ref = normalizeHref(
      'urn:nir:stato:decreto.legislativo:2010-07-02;104#Allegato 1 Codice del processo amministrativo-art. 120',
    );
    expect(ref.kind).toBe('nir');
    expect(ref.urn).toBe('urn:nir:stato:decreto.legislativo:2010-07-02;104');
    expect(ref.article).toBe('120');
    expect(ref.annex).toBe('1');
  });

  it('non inventa nulla su un href vuoto', () => {
    expect(normalizeHref('#').kind).toBe('sconosciuto');
    expect(normalizeHref('').kind).toBe('sconosciuto');
  });

  it('marca sconosciuto quello che non riconosce', () => {
    expect(normalizeHref('https://esempio.it/qualcosa').kind).toBe('sconosciuto');
  });

  it('conserva sempre l’href originale come prova', () => {
    expect(normalizeHref('qualunque cosa').raw).toBe('qualunque cosa');
  });
});

describe('readFragment', () => {
  it('legge gli eId Akoma Ntoso', () => {
    expect(readFragment('art_1__para_2')).toEqual({
      article: '1',
      paragraph: '2',
      annex: null,
    });
  });

  it('legge il testo redazionale di Normattiva', () => {
    expect(readFragment('Allegato 1 Codice del processo amministrativo-art. 120')).toEqual({
      article: '120',
      paragraph: null,
      annex: '1',
    });
  });

  it('gestisce un frammento vuoto', () => {
    expect(readFragment('')).toEqual({ article: null, paragraph: null, annex: null });
  });
});
