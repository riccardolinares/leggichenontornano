/**
 * Il dataset derivato anche in Parquet.
 *
 * Il JSONL resta la forma **primaria**, e non è una scelta di comodo: si legge
 * con `grep`, si apre con un editor di testo e non richiede di installare
 * niente per verificare una nostra affermazione. Un dataset civico che si possa
 * controllare solo con gli strumenti giusti è un dataset che non si controlla.
 *
 * Il Parquet serve a chi quegli strumenti li ha già: un milione di articoli in
 * JSONL sono centinaia di megabyte da scorrere per intero a ogni domanda, in
 * Parquet sono colonne compresse che pandas, DuckDB o Polars leggono
 * selettivamente. Le due forme escono dalla stessa esportazione, quindi non
 * possono divergere.
 */
import { parquetWriteFile } from 'hyparquet-writer';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type {
  SnapshotAct,
  SnapshotAnomaly,
  SnapshotArticle,
  SnapshotPronuncia,
  SnapshotRelation,
  SnapshotVersion,
} from './types.js';

export interface TabelleParquet {
  acts: readonly SnapshotAct[];
  versions: readonly SnapshotVersion[];
  articles: readonly SnapshotArticle[];
  relations: readonly SnapshotRelation[];
  anomalies: readonly SnapshotAnomaly[];
  pronunce: readonly SnapshotPronuncia[];
}

export interface EsitoParquet {
  file: string;
  righe: number;
}

/**
 * Scrive le tabelle in Parquet, una per file, accanto ai JSONL.
 *
 * Le colonne annidate (gli array di URN di un'anomalia, le prove, i criteri di
 * risoluzione) vengono serializzate in JSON dentro una colonna di testo. È una
 * rinuncia dichiarata: Parquet reggerebbe le strutture annidate, ma renderle
 * qui significherebbe uno schema che i lettori più semplici non aprono, e chi
 * ha bisogno della struttura completa ha il JSONL, che è la forma primaria.
 */
export function scriviParquet(dir: string, tabelle: TabelleParquet): EsitoParquet[] {
  mkdirSync(dir, { recursive: true });
  const out: EsitoParquet[] = [];

  const scrivi = (nome: string, righe: readonly Record<string, unknown>[]): void => {
    // Un file Parquet senza righe non ha uno schema da cui dedurre le colonne:
    // non scriverlo è più onesto che scriverne uno illeggibile.
    if (righe.length === 0) return;
    const file = join(dir, `${nome}.parquet`);
    parquetWriteFile({ filename: file, columnData: colonne(righe) });
    out.push({ file: `${nome}.parquet`, righe: righe.length });
  };

  scrivi('acts', tabelle.acts as unknown as Record<string, unknown>[]);
  scrivi('versions', tabelle.versions as unknown as Record<string, unknown>[]);
  scrivi('articles', tabelle.articles as unknown as Record<string, unknown>[]);
  scrivi(
    'relations',
    tabelle.relations.map((r) => ({ ...r, targetParagraphs: r.targetParagraphs.join(',') })),
  );
  scrivi(
    'anomalies',
    tabelle.anomalies.map((a) => ({
      ...a,
      urns: a.urns.join(' '),
      evidence: JSON.stringify(a.evidence),
      resolutions: JSON.stringify(a.resolutions),
    })),
  );
  scrivi('pronunce', tabelle.pronunce as unknown as Record<string, unknown>[]);
  return out;
}

/** Da righe a colonne, che è il modo in cui Parquet vuole i dati. */
function colonne(righe: readonly Record<string, unknown>[]): Array<{
  name: string;
  data: unknown[];
}> {
  const nomi = [...new Set(righe.flatMap((r) => Object.keys(r)))];
  return nomi.map((name) => ({
    name,
    data: righe.map((r) => (r[name] === undefined ? null : r[name])),
  }));
}
