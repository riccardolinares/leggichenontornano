#!/usr/bin/env node
/**
 * Il bot quotidiano.
 *
 *   antinomia-bot pubblica [--giorno 2026-09-13] [--prova]
 *   antinomia-bot contatore
 *
 * Gira su una GitHub Action schedulata. Con `--prova` stampa cosa pubblicherebbe
 * senza pubblicare: è il comportamento predefinito anche quando mancano le
 * credenziali, perché un fork deve poterlo eseguire.
 *
 * Il registro di ciò che è già uscito sta in un file JSON versionato
 * (`data/bot/pubblicate.json`): la Action lo aggiorna e lo committa, così la
 * memoria del bot è ispezionabile come tutto il resto invece di vivere in un
 * database che nessuno guarda.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SnapshotReader } from '@antinomia/corpus';
import { componiContatore, componiMessaggio, type Piattaforma } from './messaggio.js';
import { pubblicatoriAttivi } from './piattaforme.js';
import { selezionaDelGiorno } from './selezione.js';

const SNAPSHOT = process.env['ANTINOMIA_SNAPSHOT'] ?? 'data/snapshot';
const REGISTRO = process.env['ANTINOMIA_BOT_REGISTRO'] ?? 'data/bot/pubblicate.json';
const SITE = process.env['ANTINOMIA_SITE_URL'] ?? 'https://leleggichenontornano.it';

interface VocePubblicata {
  id: string;
  giorno: string;
  piattaforme: string[];
}

function leggiRegistro(): VocePubblicata[] {
  if (!existsSync(REGISTRO)) return [];
  return JSON.parse(readFileSync(REGISTRO, 'utf8')) as VocePubblicata[];
}

function scriviRegistro(voci: VocePubblicata[]): void {
  mkdirSync(dirname(REGISTRO), { recursive: true });
  writeFileSync(REGISTRO, `${JSON.stringify(voci, null, 2)}\n`, 'utf8');
}

function parseArgs(argv: readonly string[]) {
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
  const comando = positional[0] ?? 'pubblica';
  const giorno = String(flags.get('giorno') ?? new Date().toISOString().slice(0, 10));
  const reader = SnapshotReader.fromDirectory(SNAPSHOT);

  if (comando === 'contatore') {
    const contatore = JSON.parse(
      readFileSync(join(SNAPSHOT, 'contatore.json'), 'utf8'),
    ) as Parameters<typeof componiContatore>[0];
    process.stdout.write(`${componiContatore(contatore, SITE)}\n`);
    return 0;
  }

  if (comando !== 'pubblica') {
    process.stderr.write(`Comando sconosciuto: ${comando}\n`);
    return 2;
  }

  const registro = leggiRegistro();
  if (registro.some((v) => v.giorno === giorno)) {
    process.stdout.write(`Già pubblicato oggi (${giorno}). Niente da fare.\n`);
    return 0;
  }

  const selezione = selezionaDelGiorno(reader, {
    giorno,
    giaPubblicate: new Set(registro.map((v) => v.id)),
  });

  if (!selezione) {
    // Non è un errore: è la situazione in cui il progetto ha pubblicato tutto
    // quello che aveva e non ha ancora trovato altro. Tacere è corretto.
    process.stdout.write(
      'Nessuna segnalazione pubblicabile non ancora uscita. Il bot non pubblica nulla oggi.\n',
    );
    return 0;
  }

  const { anomalia, motivo } = selezione;
  process.stdout.write(`Selezionata ${anomalia.id} (${motivo})\n\n`);

  const pubblicatori = flags.has('prova') ? [] : pubblicatoriAttivi();

  if (pubblicatori.length === 0) {
    for (const piattaforma of ['mastodon', 'telegram', 'x'] as Piattaforma[]) {
      const messaggio = componiMessaggio(anomalia, piattaforma, SITE);
      process.stdout.write(
        `--- ${piattaforma} (${messaggio.testo.length} caratteri) ---\n${messaggio.testo}\n\n`,
      );
    }
    process.stdout.write(
      flags.has('prova')
        ? 'Modalità prova: non è stato pubblicato nulla.\n'
        : 'Nessuna piattaforma configurata: non è stato pubblicato nulla.\n',
    );
    return 0;
  }

  const riuscite: string[] = [];
  for (const pubblicatore of pubblicatori) {
    const messaggio = componiMessaggio(anomalia, pubblicatore.nome as Piattaforma, SITE);
    const esito = await pubblicatore.pubblica(messaggio);
    process.stdout.write(
      `${esito.piattaforma}: ${esito.pubblicato ? `pubblicato ${esito.url ?? ''}` : `non pubblicato — ${esito.motivo}`}\n`,
    );
    if (esito.pubblicato) riuscite.push(esito.piattaforma);
  }

  // Il registro si aggiorna solo se almeno una pubblicazione è riuscita:
  // altrimenti domani il bot riproverebbe con una segnalazione diversa e quella
  // di oggi non uscirebbe mai.
  if (riuscite.length > 0) {
    registro.push({ id: anomalia.id, giorno, piattaforme: riuscite });
    scriviRegistro(registro);
    process.stdout.write(`\nRegistro aggiornato: ${REGISTRO}\n`);
  } else {
    process.stderr.write('\nNessuna pubblicazione riuscita: il registro non è stato aggiornato.\n');
    return 1;
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
