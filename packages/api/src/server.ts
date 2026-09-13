#!/usr/bin/env node
/**
 * Processo autonomo che espone l'API.
 *
 *   DATABASE_URL=... antinomia-api                 # legge da PostgreSQL
 *   ANTINOMIA_SNAPSHOT=data/snapshot antinomia-api # legge dal dataset JSONL
 *
 * La seconda forma non richiede alcun database: chi scarica il dataset può
 * alzare la stessa API sul proprio portatile e verificare che risponda come la
 * nostra. È il senso di pubblicare un dataset.
 */
import { createServer } from 'node:http';
import { DatabaseSource, SnapshotSource } from './source.js';
import { createRouter } from './router.js';

const port = Number(process.env['PORT'] ?? 4000);
const snapshotDir = process.env['ANTINOMIA_SNAPSHOT'];

const source = snapshotDir
  ? SnapshotSource.fromDirectory(snapshotDir)
  : new DatabaseSource();

const handle = createRouter({ source });

const server = createServer((req, res) => {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  const request = new Request(url, { method: req.method ?? 'GET' });
  handle(request)
    .then(async (response) => {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    })
    .catch((err: unknown) => {
      process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
      res.writeHead(500, { 'content-type': 'application/problem+json' });
      res.end(JSON.stringify({ status: 500, title: 'Errore interno' }));
    });
});

server.listen(port, () => {
  process.stdout.write(
    `API in ascolto su http://localhost:${port}/v1 — sorgente: ${source.kind}\n`,
  );
});
