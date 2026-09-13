import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAkn } from '../src/akn.js';
import { parseVersionFileName } from '../src/filenames.js';
import {
  articleAt,
  articleHistory,
  buildTimeline,
  daysBetween,
  intersectWindows,
  nextDay,
  previousDay,
  versionAt,
  windowsOverlap,
  MultivigenzaError,
  type VersionInput,
} from '../src/multivigenza.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function loadVersions(prefix: string): VersionInput[] {
  return readdirSync(FIXTURES)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.xml'))
    .map((f) => ({
      act: parseAkn(readFileSync(join(FIXTURES, f), 'utf8')),
      inForceFrom: parseVersionFileName(f)?.inForceFrom ?? null,
    }));
}

describe('buildTimeline sulle quattro versioni della l. cost. 1/1953', () => {
  const timeline = buildTimeline(loadVersions('1953-03-14_053C0001'));

  it('ordina le versioni e chiude le finestre', () => {
    expect(timeline.versions.map((v) => v.inForceFrom)).toEqual([
      '1953-03-14',
      '1967-12-10',
      '1989-01-17',
      '1989-01-18',
    ]);
    expect(timeline.versions[0]?.inForceTo).toBe('1967-12-09');
    expect(timeline.versions.at(-1)?.inForceTo).toBeNull();
  });

  it('registra la discordanza fra nome del file e data FRBR', () => {
    // Il file `VIGENZA_1989-01-17_V2` dichiara `1967-12-10` nel FRBRExpression.
    const conflicting = timeline.versions.filter((v) => v.dateConflict);
    expect(conflicting.length).toBeGreaterThan(0);
    expect(conflicting[0]?.dateConflict?.fromFileName).not.toBe(
      conflicting[0]?.dateConflict?.fromExpression,
    );
  });

  it('risolve la versione vigente a una data', () => {
    expect(versionAt(timeline, '1960-01-01')?.inForceFrom).toBe('1953-03-14');
    expect(versionAt(timeline, '1989-01-17')?.inForceFrom).toBe('1989-01-17');
    expect(versionAt(timeline, '2030-01-01')?.inForceFrom).toBe('1989-01-18');
  });

  it('restituisce null prima dell’entrata in vigore', () => {
    expect(versionAt(timeline, '1900-01-01')).toBeNull();
  });

  it('risolve il testo di un articolo a una data', () => {
    const first = timeline.versions[0]!.act.articles[0]!;
    const resolved = articleAt(timeline, first.number!, '1960-01-01');
    expect(resolved?.article.number).toBe(first.number);
    expect(resolved?.version.inForceFrom).toBe('1953-03-14');
  });

  it('collassa le versioni in cui l’articolo non cambia', () => {
    const number = timeline.versions[0]!.act.articles[0]!.number!;
    const history = articleHistory(timeline, number);
    expect(history.length).toBeGreaterThan(0);
    expect(history.length).toBeLessThanOrEqual(timeline.versions.length);
    expect(history[0]?.from).toBe('1953-03-14');
  });

  it('rifiuta versioni di atti diversi', () => {
    const other = parseAkn(
      readFileSync(join(FIXTURES, '2006-05-31_006G0216_ORIGINALE_V0.xml'), 'utf8'),
    );
    expect(() => buildTimeline([...loadVersions('1953-03-14_053C0001'), { act: other }])).toThrow(
      MultivigenzaError,
    );
  });
});

describe('finestre temporali', () => {
  it('interseca due finestre chiuse', () => {
    expect(
      intersectWindows({ from: '2010-01-01', to: '2015-12-31' }, { from: '2013-01-01', to: '2020-01-01' }),
    ).toEqual({ from: '2013-01-01', to: '2015-12-31' });
  });

  it('gestisce le finestre aperte a destra', () => {
    expect(
      intersectWindows({ from: '2010-01-01', to: null }, { from: '2013-01-01', to: null }),
    ).toEqual({ from: '2013-01-01', to: null });
  });

  it('restituisce null quando non si sovrappongono', () => {
    expect(
      intersectWindows({ from: '2010-01-01', to: '2012-12-31' }, { from: '2013-01-01', to: null }),
    ).toBeNull();
  });

  it('windowsOverlap è il filtro temporale del motore', () => {
    // Due norme mai vigenti insieme non sono in contraddizione.
    expect(
      windowsOverlap({ from: '1990-01-01', to: '1999-12-31' }, { from: '2000-01-01', to: null }),
    ).toBe(false);
    expect(
      windowsOverlap({ from: '1990-01-01', to: '2005-12-31' }, { from: '2000-01-01', to: null }),
    ).toBe(true);
  });

  it('gestisce le finestre che si toccano per un solo giorno', () => {
    expect(
      windowsOverlap({ from: '1990-01-01', to: '2000-01-01' }, { from: '2000-01-01', to: null }),
    ).toBe(true);
  });
});

describe('aritmetica delle date', () => {
  it('giorno precedente e successivo attraversano i mesi', () => {
    expect(previousDay('2016-03-01')).toBe('2016-02-29');
    expect(nextDay('2015-12-31')).toBe('2016-01-01');
  });

  it('conta i giorni fra due date', () => {
    expect(daysBetween('2020-01-01', '2020-12-31')).toBe(365);
    expect(daysBetween('2020-01-01', '2019-12-31')).toBe(-1);
  });
});
