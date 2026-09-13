/**
 * Lettura e scrittura del dataset in JSONL.
 *
 * La lettura è sincrona e senza dipendenze: il sito la esegue al momento della
 * generazione statica, dove un flusso asincrono non aggiunge nulla e una
 * dipendenza in più sì.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SnapshotManifest } from './types.js';

export const SNAPSHOT_FILES = {
  acts: 'acts.jsonl',
  versions: 'versions.jsonl',
  articles: 'articles.jsonl',
  relations: 'relations.jsonl',
  anomalies: 'anomalies.jsonl',
  metrics: 'metrics.json',
  manifest: 'manifest.json',
  counter: 'contatore.json',
  verticals: 'verticali.json',
  pronunce: 'pronunce.jsonl',
  verifiche: 'verifiche.jsonl',
} as const;

export function writeJsonl(path: string, rows: readonly unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = rows.map((r) => JSON.stringify(r)).join('\n');
  writeFileSync(path, rows.length > 0 ? `${body}\n` : '', 'utf8');
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const out: T[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    out.push(JSON.parse(trimmed) as T);
  }
  return out;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function snapshotPath(dir: string, key: keyof typeof SNAPSHOT_FILES): string {
  return join(dir, SNAPSHOT_FILES[key]);
}

export function readManifest(dir: string): SnapshotManifest | null {
  const path = snapshotPath(dir, 'manifest');
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as SnapshotManifest) : null;
}
