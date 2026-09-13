#!/usr/bin/env node
/**
 * CLI del corpus.
 *
 *   antinomia-corpus collections                  elenca le collezioni Normattiva
 *   antinomia-corpus fetch <nome> [--format M]    scarica ed estrae una collezione
 *   antinomia-corpus ingest <cartella>            ingerisce una collezione estratta
 *   antinomia-corpus export [--only-anomalie]     esporta il dataset in JSONL
 *   antinomia-corpus stats                        conteggi del corpus
 *
 * Le opzioni lunghe sono in italiano perché il pubblico di questo strumento è
 * italiano e il costo di tradurre «--only-anomalies» nella testa a ogni uso è
 * pagato da chi legge, non da chi scrive.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NormattivaClient, type CollectionFormat } from './normattiva/client.js';
import { downloadCollection } from './normattiva/collections.js';
import { ensureSearchIndexes, ingestDirectory } from './pipeline.js';
import { disconnectPrisma } from './store/client.js';
import { corpusStats } from './store/read.js';
import { exportSnapshot } from './snapshot/export.js';
import { ingestConsulta } from './consulta/ingest.js';
import { verificaDichiarazioni } from './consulta/verifica.js';

const USAGE = `antinomia-corpus — ingestione del corpus normativo

Comandi:
  collections                      elenca le collezioni predefinite di Normattiva
  fetch <nome> [opzioni]           scarica ed estrae una collezione in data/corpus/
  ingest <cartella> [opzioni]      ingerisce una collezione estratta nel database
  consulta [opzioni]               ingerisce le pronunce della Corte costituzionale
  consulta verifica                accordo fra i dispositivi e le note di Normattiva
  export [opzioni]                 esporta il dataset derivato in JSONL
  stats                            conteggi del corpus

Opzioni di fetch:
  --formato <O|M|V>                originale, multivigente (default), vigente
  --dest <cartella>                cartella di destinazione

Opzioni di ingest:
  --limite <n>                     numero massimo di atti (giri di prova)
  --collezione <nome>              nome da registrare sugli atti
  --senza-rinvii                   non genera gli archi RINVIA

Opzioni di consulta:
  --periodo <a,b>                  1956-1980, 1981-2000, 2001-oggi (default: tutti)
  --senza-scrittura                legge e misura senza toccare il database

Opzioni di export:
  --dest <cartella>                cartella di destinazione (default data/snapshot)
  --solo-anomalie                  solo gli atti toccati da un'anomalia
  --campione <n>                   atti aggiuntivi da includere nel campione
  --max-articoli <n>               tetto agli articoli esportati

I dati normativi provengono da Normattiva (dati.normattiva.it), licenza CC BY 4.0.
La banca dati Normattiva non ha carattere di ufficialita'.
Le pronunce provengono dalla Corte costituzionale (dati.cortecostituzionale.it),
licenza CC BY-SA 3.0.
`;

interface Args {
  positional: string[];
  flags: Map<string, string | true>;
}

function parseArgs(argv: readonly string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags.set(name, next);
        i++;
      } else {
        flags.set(name, true);
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function main(): Promise<number> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];

  if (!command || command === 'help' || flags.has('help')) {
    process.stdout.write(USAGE);
    return 0;
  }

  switch (command) {
    case 'collections': {
      const client = new NormattivaClient();
      const collections = await client.listCollections();
      const byName = new Map<string, string[]>();
      for (const c of collections) {
        const list = byName.get(c.nomeCollezione) ?? [];
        list.push(`${c.formatoCollezione}:${c.numeroAtti}`);
        byName.set(c.nomeCollezione, list);
      }
      for (const [name, formats] of byName) {
        process.stdout.write(`${name.padEnd(48)} ${formats.join('  ')}\n`);
      }
      process.stdout.write(
        `\n${byName.size} collezioni. Formati: O originale, M multivigente, V vigente.\n`,
      );
      return 0;
    }

    case 'consulta': {
      if (positional[1] === 'verifica') {
        const r = await verificaDichiarazioni();
        if (r.totali === 0) {
          process.stdout.write('Nessuna declaratoria nel grafo: esegui prima `consulta`.\n');
          return 0;
        }
        process.stdout.write(
          [
            '',
            'Accordo con le note di aggiornamento di Normattiva.',
            'Due fonti indipendenti: il dispositivo della Corte e la nota che Normattiva',
            'scrive in coda all\'articolo colpito. L\'accordo misura la nostra lettura del',
            'dispositivo; il disaccordo non prova che la lettura sia sbagliata, perche\' la',
            'nota puo\' stare su un altro articolo o mancare dalla versione ingerita.',
            '',
            ...r.perConfidenza.map(
              (c) =>
                `  confidenza ${c.confidence.padEnd(6)} ${String(c.confermate).padStart(4)}/${String(c.archi).padEnd(4)}  ` +
                `${(c.accordo * 100).toFixed(1)}% di accordo`,
            ),
            '',
            `  totale            ${r.confermate}/${r.totali}`,
            '',
          ].join('\n'),
        );
        return 0;
      }
      const periodi = flags.get('periodo');
      const rapporto = await ingestConsulta({
        ...(typeof periodi === 'string' ? { periodi: periodi.split(',') } : {}),
        persist: !flags.has('senza-scrittura'),
        onProgress: (m) => process.stdout.write(`  ${m}\n`),
      });
      process.stdout.write(
        [
          '',
          `pronunce lette:       ${rapporto.pronunce}`,
          `dichiarazioni:        ${rapporto.dichiarazioni}`,
          `con atto statale:     ${rapporto.risolte}`,
          `archi scritti:        ${rapporto.relazioniScritte}`,
          `voci gold standard:   ${rapporto.voceGoldScritte}`,
          '',
          'Dichiarazioni che non producono un arco:',
          ...rapporto.scartate.map((s) => `  ${String(s.quante).padStart(5)}  ${s.motivo}`),
          '',
          rapporto.licenza,
          '',
        ].join('\n'),
      );
      return 0;
    }

    case 'fetch': {
      const name = positional[1];
      if (!name) {
        process.stderr.write('Manca il nome della collezione.\n');
        return 2;
      }
      const format = (flags.get('formato') as CollectionFormat | undefined) ?? 'M';
      const dest = resolve(String(flags.get('dest') ?? `data/corpus/${slug(name)}-${format}`));
      mkdirSync(dest, { recursive: true });
      process.stdout.write(`Scarico «${name}» (formato ${format}) in ${dest}\n`);
      const result = await downloadCollection(name, { destDir: dest, format });
      process.stdout.write(
        `${result.files.length} file, ${(result.bytes / 1e6).toFixed(1)} MB\nsha256 archivio: ${result.sha256}\n`,
      );
      return 0;
    }

    case 'ingest': {
      const dir = positional[1];
      if (!dir) {
        process.stderr.write('Manca la cartella da ingerire.\n');
        return 2;
      }
      await ensureSearchIndexes();
      const report = await ingestDirectory({
        dir: resolve(dir),
        collection: flags.get('collezione') ? String(flags.get('collezione')) : undefined,
        ...(flags.has('limite') ? { limit: Number(flags.get('limite')) } : {}),
        includeReferences: !flags.has('senza-rinvii'),
        onProgress: (m) => process.stdout.write(`  ${m}\n`),
      });
      process.stdout.write(
        [
          '',
          `atti:        ${report.stats.acts}`,
          `versioni:    ${report.stats.versionsInserted} nuove, ${report.stats.versionsUnchanged} invariate, ${report.stats.versionsSuperseded} soppiantate`,
          `articoli:    ${report.stats.articles}`,
          `commi:       ${report.stats.provisions}`,
          `relazioni:   ${report.stats.relationsInserted} nuove, ${report.stats.relationsSuperseded} chiuse`,
          `errori:      ${report.errors.length}`,
          `durata:      ${(report.durationMs / 1000).toFixed(1)}s`,
          '',
        ].join('\n'),
      );
      for (const err of report.errors.slice(0, 10)) {
        process.stderr.write(`  ! ${err.path}: ${err.message}\n`);
      }
      return 0;
    }

    case 'export': {
      const dest = resolve(String(flags.get('dest') ?? 'data/snapshot'));
      const manifest = await exportSnapshot({
        dir: dest,
        onlyAnomalyActs: flags.has('solo-anomalie'),
        ...(flags.has('campione') ? { sampleActs: Number(flags.get('campione')) } : {}),
        ...(flags.has('max-articoli') ? { maxArticles: Number(flags.get('max-articoli')) } : {}),
      });
      process.stdout.write(
        `Dataset scritto in ${dest}\n${JSON.stringify(manifest.counts, null, 2)}\n`,
      );
      return 0;
    }

    case 'stats': {
      const stats = await corpusStats();
      process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
      return 0;
    }

    default:
      process.stderr.write(`Comando sconosciuto: ${command}\n\n${USAGE}`);
      return 2;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

main()
  .then(async (code) => {
    await disconnectPrisma();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    await disconnectPrisma();
    process.exit(1);
  });
