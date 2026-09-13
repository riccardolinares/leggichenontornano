import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { describe, expect, it } from 'vitest';
import { scriviParquet } from '../src/snapshot/parquet.js';

const vuoto = {
  acts: [],
  versions: [],
  articles: [],
  relations: [],
  anomalies: [],
  pronunce: [],
};

const anomalia = {
  id: 'test.1',
  checkId: 'rinvio-ad-atto-abrogato',
  level: 1,
  title: 'Una segnalazione',
  plainLanguage: 'Spiegazione in lingua comune.',
  urns: ['urn:nir:stato:legge:2020-01-01;1~art3', 'urn:nir:stato:legge:1990-01-01;2'],
  windowFrom: '2020-01-01',
  windowTo: null,
  rule: 'SELECT …',
  evidence: [{ urn: 'urn:nir:stato:legge:2020-01-01;1', kind: 'grafo' }],
  resolutions: [{ criterion: 'posteriorita', status: 'si-applica' }],
  severity: 'alta',
  published: true,
  computedAt: '2026-09-13T00:00:00.000Z',
};

function cartella(): string {
  return mkdtempSync(join(tmpdir(), 'antinomia-parquet-'));
}

describe('esportazione in Parquet', () => {
  it('non scrive file per le tabelle vuote', () => {
    // Un Parquet senza righe non ha uno schema da cui dedurre le colonne:
    // scriverne uno illeggibile sarebbe peggio che non scriverlo.
    const dir = cartella();
    expect(scriviParquet(dir, vuoto)).toEqual([]);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('scrive un file leggibile, con le stesse righe del JSONL', async () => {
    const dir = cartella();
    const esito = scriviParquet(dir, { ...vuoto, anomalies: [anomalia] });
    expect(esito).toEqual([{ file: 'anomalies.parquet', righe: 1 }]);

    const righe = await parquetReadObjects({
      file: await asyncBufferFromFile(join(dir, 'anomalies.parquet')),
    });
    expect(righe).toHaveLength(1);
    expect(righe[0]?.['id']).toBe('test.1');
    expect(righe[0]?.['title']).toBe('Una segnalazione');
    expect(righe[0]?.['published']).toBe(true);
  });

  it('serializza le colonne annidate invece di perderle', async () => {
    // È una rinuncia dichiarata: chi ha bisogno della struttura completa usa il
    // JSONL, che resta la forma primaria. Quello che non deve succedere è che
    // un campo sparisca in silenzio.
    const dir = cartella();
    scriviParquet(dir, { ...vuoto, anomalies: [anomalia] });
    const righe = await parquetReadObjects({
      file: await asyncBufferFromFile(join(dir, 'anomalies.parquet')),
    });
    expect(righe[0]?.['urns']).toBe(anomalia.urns.join(' '));
    expect(JSON.parse(String(righe[0]?.['evidence']))).toEqual(anomalia.evidence);
    expect(JSON.parse(String(righe[0]?.['resolutions']))).toEqual(anomalia.resolutions);
  });

  it('scrive un file Parquet vero, non un file che sembra tale', () => {
    const dir = cartella();
    scriviParquet(dir, { ...vuoto, anomalies: [anomalia] });
    const bytes = readFileSync(join(dir, 'anomalies.parquet'));
    // «PAR1» in testa e in coda: è la firma del formato.
    expect(bytes.subarray(0, 4).toString()).toBe('PAR1');
    expect(bytes.subarray(-4).toString()).toBe('PAR1');
  });
});
