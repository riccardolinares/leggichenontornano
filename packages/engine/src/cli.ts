#!/usr/bin/env node
/**
 * CLI del motore.
 *
 *   antinomia-engine run [--oggi 2026-09-12] [--limite 50] [--senza-scrittura]
 *   antinomia-engine metriche
 *   antinomia-engine coda [--controllo <id>] [--quante 30] [--seme 1]
 *   antinomia-engine revisiona <idAnomalia> <esito> --revisore <nome>
 *   antinomia-engine contatore
 *   antinomia-engine controlli
 */
import { disconnectPrisma, exportSnapshot, getPrisma } from '@antinomia/corpus';
import { buildNationalCounter, computeMetrics } from './metrics.js';
import { CHECK_DEFINITIONS } from './registry.js';
import { recordReview, sampleForReview, type ReviewVerdict } from './review/queue.js';
import { allMandates, buildViewFromDatabase, runEngine } from './index.js';

const USAGE = `antinomia-engine — motore delle anomalie

Comandi:
  run                     esegue tutti i controlli e scrive le segnalazioni
  metriche                precisione per controllo e stato del cancello di pubblicazione
  coda                    estrae un campione di segnalazioni da revisionare
  revisiona <id> <esito>  registra una revisione umana
  contatore               contatore nazionale dei giorni di ritardo
  controlli               elenco dei controlli con le loro regole
  esporta                 esporta il dataset con le metriche calcolate

Opzioni di esporta:
  --dest <cartella>       destinazione (default data/snapshot)
  --solo-anomalie         solo gli atti toccati da un'anomalia
  --campione <n>          atti aggiuntivi oltre a quelli delle anomalie
  --max-articoli <n>      tetto agli articoli esportati

Esiti ammessi per «revisiona»:
  CONFERMATA  NON_E_UN_CONFLITTO  ESTRAZIONE_ERRATA  DA_APPROFONDIRE

Opzioni di run:
  --oggi <YYYY-MM-DD>     data di riferimento (riproducibilita')
  --limite <n>            massimo di segnalazioni per controllo
  --senza-scrittura       calcola senza scrivere nel database
  --con-commi             carica anche i commi (serve ai controlli di livello 3)
`;

function parseArgs(argv: readonly string[]): { positional: string[]; flags: Map<string, string | true> } {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags.set(arg.slice(2), next);
        i++;
      } else flags.set(arg.slice(2), true);
    } else positional.push(arg);
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
    case 'run': {
      const report = await runEngine({
        ...(flags.has('oggi') ? { today: String(flags.get('oggi')) } : {}),
        ...(flags.has('limite') ? { limitPerCheck: Number(flags.get('limite')) } : {}),
        persist: !flags.has('senza-scrittura'),
        withProvisions: flags.has('con-commi'),
        onProgress: (m) => process.stdout.write(`  ${m}\n`),
      });
      process.stdout.write('\nSegnalazioni per controllo:\n');
      for (const [checkId, count] of Object.entries(report.byCheck)) {
        const decision = report.decisions.find((d) => d.checkId === checkId);
        const stato = decision?.published ? 'pubblicabile' : 'coda interna';
        process.stdout.write(`  ${checkId.padEnd(36)} ${String(count).padStart(6)}  ${stato}\n`);
      }
      process.stdout.write(
        `\ntotale ${report.findings.length} — pubblicabili ${report.published.length}, in coda ${report.queued.length}\n` +
          `durata ${(report.durationMs / 1000).toFixed(1)}s\n`,
      );
      return 0;
    }

    case 'metriche': {
      const metrics = await computeMetrics();
      for (const m of metrics) {
        const precision = m.precision === null ? 'non misurata' : `${(m.precision * 100).toFixed(1)}%`;
        process.stdout.write(
          `\n${m.checkId}  [livello ${m.level}]\n` +
            `  segnalazioni: ${m.found}\n` +
            `  revisioni:    ${m.reviewed} (${m.confirmed} conferme)\n` +
            `  precisione:   ${precision}\n` +
            `  pubblicato:   ${m.published ? 'si' : 'no'}\n` +
            `  perche':      ${m.reason}\n`,
        );
      }
      return 0;
    }

    case 'coda': {
      const items = await sampleForReview({
        ...(flags.has('controllo') ? { checkId: String(flags.get('controllo')) } : {}),
        ...(flags.has('quante') ? { take: Number(flags.get('quante')) } : {}),
        ...(flags.has('seme') ? { seed: Number(flags.get('seme')) } : {}),
      });
      for (const item of items) {
        process.stdout.write(
          `\n${item.anomalyId}\n  ${item.title}\n  ${item.plainLanguage}\n  urn: ${item.urns.join(' | ')}\n`,
        );
      }
      process.stdout.write(`\n${items.length} segnalazioni nel campione.\n`);
      return 0;
    }

    case 'revisiona': {
      const [, anomalyId, verdict] = positional;
      const reviewer = flags.get('revisore');
      if (!anomalyId || !verdict || typeof reviewer !== 'string') {
        process.stderr.write('Uso: revisiona <idAnomalia> <esito> --revisore <nome>\n');
        return 2;
      }
      await recordReview({
        anomalyId,
        verdict: verdict as ReviewVerdict,
        reviewer,
        ...(flags.has('nota') ? { note: String(flags.get('nota')) } : {}),
      });
      process.stdout.write('Revisione registrata.\n');
      return 0;
    }

    case 'contatore': {
      const view = await buildViewFromDatabase(true);
      const today = flags.has('oggi')
        ? String(flags.get('oggi'))
        : new Date().toISOString().slice(0, 10);
      const prisma = getPrisma();
      const verified = new Set(
        (
          await prisma.goldItem.findMany({
            where: { expectCheck: 'attuazione-mancante' },
            select: { urns: true },
          })
        ).flatMap((r) => r.urns),
      );
      const counter = buildNationalCounter(allMandates(view), today, verified);
      process.stdout.write(`${JSON.stringify(counter, null, 2)}\n`);
      return 0;
    }

    case 'esporta': {
      // L'esportazione sta qui e non nella CLI del corpus perché il manifesto
      // deve contenere le metriche di precisione, e quelle le calcola il motore.
      // Il corpus non può dipendere dal motore: la dipendenza va nell'altro senso.
      const metrics = await computeMetrics();
      const manifest = await exportSnapshot({
        dir: String(flags.get('dest') ?? 'data/snapshot'),
        onlyAnomalyActs: flags.has('solo-anomalie'),
        metrics,
        ...(flags.has('campione') ? { sampleActs: Number(flags.get('campione')) } : {}),
        ...(flags.has('max-articoli') ? { maxArticles: Number(flags.get('max-articoli')) } : {}),
      });
      process.stdout.write(`${JSON.stringify(manifest.counts, null, 2)}\n`);
      return 0;
    }

    case 'controlli': {
      for (const c of CHECK_DEFINITIONS) {
        process.stdout.write(
          `\n${c.id}  [livello ${c.level}]  ${c.deterministic ? 'deterministico' : 'con estrazione'}\n` +
            `  ${c.description}\n` +
            `  precisione attesa: ${c.expectedPrecision}\n` +
            `  regola:\n${c.rule
              .split('\n')
              .map((l) => `    ${l}`)
              .join('\n')}\n`,
        );
      }
      return 0;
    }

    default:
      process.stderr.write(`Comando sconosciuto: ${command}\n\n${USAGE}`);
      return 2;
  }
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
