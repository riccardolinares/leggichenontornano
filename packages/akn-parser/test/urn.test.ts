import { describe, expect, it } from 'vitest';
import {
  actUrn,
  articleOf,
  formatPartition,
  formatUrn,
  humanLabel,
  paragraphOf,
  parseUrn,
  pathSegmentToUrn,
  sameAct,
  tryParseUrn,
  urnToPathSegment,
  UrnParseError,
} from '../src/urn.js';

describe('parseUrn', () => {
  it('legge un URN di atto', () => {
    expect(parseUrn('urn:nir:stato:legge:1990-08-07;241')).toEqual({
      authority: 'stato',
      measureType: 'legge',
      date: '1990-08-07',
      number: '241',
    });
  });

  it('legge un tipo composto', () => {
    const urn = parseUrn('urn:nir:stato:decreto.legislativo:2016-04-18;50');
    expect(urn.measureType).toBe('decreto.legislativo');
    expect(urn.number).toBe('50');
  });

  it('legge partizione, versione e lingua', () => {
    const urn = parseUrn('urn:nir:stato:legge:1990-08-07;241~art3-com2@2013-04-20$it');
    expect(urn.partition).toBe('art3-com2');
    expect(urn.version).toBe('2013-04-20');
    expect(urn.language).toBe('it');
  });

  it('legge un numero con suffisso ordinale', () => {
    expect(parseUrn('urn:nir:stato:legge:2020-01-01;7-bis').number).toBe('7-bis');
  });

  it('rifiuta un prefisso sbagliato', () => {
    expect(() => parseUrn('urn:lex:it:stato:legge:1990-08-07;241')).toThrow(UrnParseError);
  });

  it('rifiuta una data non ISO', () => {
    expect(() => parseUrn('urn:nir:stato:legge:07-08-1990;241')).toThrow(UrnParseError);
  });

  it('rifiuta una stringa vuota', () => {
    expect(() => parseUrn('')).toThrow(UrnParseError);
  });

  it('tryParseUrn non lancia', () => {
    expect(tryParseUrn('non un urn')).toBeNull();
  });
});

describe('formatUrn', () => {
  it('è l’inversa di parseUrn', () => {
    const s = 'urn:nir:stato:decreto.legislativo:2016-04-18;50~art3@2019-01-01$it';
    expect(formatUrn(parseUrn(s))).toBe(s);
  });
});

describe('actUrn e sameAct', () => {
  it('toglie partizione, versione e lingua', () => {
    expect(actUrn('urn:nir:stato:legge:1990-08-07;241~art3@2013-04-20$it')).toBe(
      'urn:nir:stato:legge:1990-08-07;241',
    );
  });

  it('riconosce due partizioni dello stesso atto', () => {
    expect(
      sameAct(
        'urn:nir:stato:legge:1990-08-07;241~art3',
        'urn:nir:stato:legge:1990-08-07;241~art10',
      ),
    ).toBe(true);
  });

  it('distingue atti diversi', () => {
    expect(
      sameAct('urn:nir:stato:legge:1990-08-07;241', 'urn:nir:stato:legge:1990-08-07;242'),
    ).toBe(false);
  });
});

describe('URL', () => {
  it('non percentifica i separatori dell’URN', () => {
    const seg = urnToPathSegment('urn:nir:stato:legge:1990-08-07;241~art3@2013-04-20');
    expect(seg).toBe('urn:nir:stato:legge:1990-08-07;241~art3@2013-04-20');
  });

  it('sopravvive al giro completo, anche con spazi', () => {
    const urn = 'urn:nir:stato:decreto.legislativo:2010-07-02;104:Allegato 1';
    expect(formatUrn(pathSegmentToUrn(urnToPathSegment(urn)))).toBe(urn);
  });
});

describe('humanLabel', () => {
  it('produce una frase leggibile ad alta voce', () => {
    expect(humanLabel('urn:nir:stato:legge:1990-08-07;241')).toBe('Legge 7 agosto 1990, n. 241');
  });

  it('antepone la partizione', () => {
    expect(humanLabel('urn:nir:stato:legge:1990-08-07;241~art3-com2')).toBe(
      'art. 3, comma 2 legge 7 agosto 1990, n. 241',
    );
  });
});

describe('partizioni', () => {
  it('formatta articolo, comma e lettera', () => {
    expect(formatPartition('art3-com2-let-a')).toBe('art. 3, comma 2, lett. a)');
  });

  it('estrae articolo e comma', () => {
    expect(articleOf('art3-com2')).toBe('3');
    expect(paragraphOf('art3-com2')).toBe('2');
    expect(articleOf('art3-bis')).toBe('3-bis');
    expect(paragraphOf('art3')).toBeNull();
    expect(articleOf(undefined)).toBeNull();
  });
});
