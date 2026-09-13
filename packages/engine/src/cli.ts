#!/usr/bin/env node
/**
 * CLI del motore.
 *
 *   lcnt-engine run [--oggi 2026-09-12] [--limite 50] [--senza-scrittura]
 *   lcnt-engine metriche
 *   lcnt-engine coda [--controllo <id>] [--quante 30] [--seme 1]
 *   lcnt-engine revisiona <idAnomalia> <esito> --revisore <nome>
 *   lcnt-engine contatore
 *   lcnt-engine controlli
 */
import {
  coperturaVerifiche,
  disconnectPrisma,
  esportaVerifiche,
  exportSnapshot,
  GazzettaClient,
  GAZZETTA_FONTE,
  importaVerifiche,
  readJsonl,
  riepilogoVerifiche,
  verificaAttuazioni,
  writeJsonl,
  type SnapshotVerifica,
} from '@leggichenontornano/corpus';
import { buildNationalCounter, computeMetrics } from './metrics.js';
import { CHECK_DEFINITIONS } from './registry.js';
import { recordReview, sampleForReview, type ReviewVerdict } from './review/queue.js';
import { allMandates, buildViewFromDatabase, runEngine } from './index.js';
import { estraiVerticale } from './estrazione.js';
import { importaGold, valutaGold } from './gold.js';

const USAGE = `lcnt-engine — motore delle anomalie

Comandi:
  run                     esegue tutti i controlli e scrive le segnalazioni
  metriche                precisione per controllo e stato del cancello di pubblicazione
  coda                    estrae un campione di segnalazioni da revisionare
  revisiona <id> <esito>  registra una revisione umana
  contatore               contatore nazionale dei giorni di ritardo
  controlli               elenco dei controlli con le loro regole
  gazzetta                verifica in Gazzetta Ufficiale i mandati attuativi scaduti
  gazzetta stato          quanti mandati verificati, con che esito, e dove ci si ferma
  gazzetta importa [file] rilegge il registro delle verifiche versionato
  gazzetta esporta [file] riscrive il registro delle verifiche versionato
  esporta                 esporta il dataset con le metriche calcolate
  estrai                  estrae le proposizioni deontiche di un verticale
  gold importa <file>     importa annotazioni del gold standard (JSONL)
  gold valuta             confronta il gold standard con le segnalazioni prodotte

Opzioni di estrai:
  --vocabolario <file>    es. data/vocabolari/appalti.json (obbligatorio)
  --limite <n>            numero massimo di commi da esaminare
  --tutto-il-corpus       estrae da tutti gli atti ingeriti, non dal solo verticale
  --senza-scrittura       estrae senza scrivere nel database

Opzioni di esporta:
  --dest <cartella>       destinazione (default data/snapshot)
  --solo-anomalie         solo gli atti toccati da un'anomalia
  --campione <n>          atti aggiuntivi oltre a quelli delle anomalie
  --max-articoli <n>      tetto agli articoli esportati
  --parquet               scrive anche le tabelle in Parquet sotto parquet/

Esiti ammessi per «revisiona»:
  CONFERMATA  NON_E_UN_CONFLITTO  ESTRAZIONE_ERRATA  DA_APPROFONDIRE

Opzioni di gazzetta:
  --quanti <n>            mandati da verificare in questo giro (default 25)
  --non-prima-di <g>      non rifare le verifiche più recenti di <g> giorni (default 30)
  --intervallo <ms>       pausa minima fra due richieste (default 1500, minimo 1000)
  --oggi <YYYY-MM-DD>     data di riferimento (riproducibilita')
  --senza-scrittura       verifica senza scrivere nel database

  Il comando interroga un sito pubblico: e' serializzato, si presenta con il
  nome del progetto e aspetta fra una richiesta e l'altra. Riprende da dove si
  era fermato, quindi va bene lanciarlo ogni notte con un --quanti piccolo.

Opzioni di run:
  --oggi <YYYY-MM-DD>     data di riferimento (riproducibilita')
  --limite <n>            massimo di segnalazioni per controllo
  --senza-scrittura       calcola senza scrivere nel database
  --con-commi             carica anche i commi (serve ai controlli di livello 3)
  --verticale <nome>      attiva un verticale semantico, es. appalti
  --vocabolario <file>    vocabolario del verticale attivato
`;

function parseArgs(argv: readonly string[]): {
  positional: string[];
  flags: Map<string, string | true>;
} {
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
        ...(flags.has('verticale')
          ? {
              verticali: [
                {
                  verticale: String(flags.get('verticale')),
                  vocabolario: String(
                    flags.get('vocabolario') ??
                      `data/vocabolari/${String(flags.get('verticale'))}.json`,
                  ),
                },
              ],
            }
          : {}),
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
        const precision =
          m.precision === null ? 'non misurata' : `${(m.precision * 100).toFixed(1)}%`;
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
      const counter = buildNationalCounter(allMandates(view), today, await coperturaVerifiche());
      process.stdout.write(`${JSON.stringify(counter, null, 2)}\n`);
      return 0;
    }

    case 'gazzetta': {
      // Il registro viaggia nel repository, non nel database del runner: la
      // campagna gira una notte per volta su una macchina che poi sparisce, e
      // senza queste due mosse ogni giro ricomincerebbe da capo.
      if (positional[1] === 'importa' || positional[1] === 'esporta') {
        const file = positional[2] ?? 'data/snapshot/verifiche.jsonl';
        if (positional[1] === 'importa') {
          const righe = readJsonl<SnapshotVerifica>(file);
          const lette = await importaVerifiche(righe);
          process.stdout.write(`${lette} verifiche rilette da ${file}.\n`);
          return 0;
        }
        const righe = await esportaVerifiche();
        writeJsonl(file, righe);
        process.stdout.write(`${righe.length} verifiche scritte in ${file}.\n`);
        return 0;
      }

      if (positional[1] === 'stato') {
        const r = await riepilogoVerifiche();
        if (r.verificati === 0) {
          process.stdout.write(
            'Nessun mandato è ancora stato verificato in Gazzetta Ufficiale.\n' +
              'Finché la copertura è zero il controllo «attuazione-mancante» non pubblica\n' +
              'niente, ed è giusto così: vedi docs/adr/0013-la-verifica-in-gazzetta.md.\n',
          );
          return 0;
        }
        process.stdout.write(
          [
            '',
            `verificati:        ${r.verificati}`,
            `  adottati:        ${r.adottati} (di cui ${r.adottatiInRitardo} dopo la scadenza)`,
            `  non adottati:    ${r.nonAdottati}  <- gli unici che possono diventare segnalazioni`,
            `  non verificabili:${String(r.nonVerificabili).padStart(4)}`,
            `ultima verifica:   ${r.ultimaVerifica ?? '-'}`,
            '',
            'Dove la verifica si ferma, e perché:',
            ...r.motiviNonVerificabili.map((m) => `  ${String(m.quanti).padStart(5)}  ${m.motivo}`),
            '',
          ].join('\n'),
        );
        return 0;
      }

      // I mandati arrivano dal corpus, non da un file: il verificatore lavora
      // sulla stessa estrazione che alimenta il contatore, o le due cose
      // parlerebbero di mandati diversi con lo stesso nome.
      const view = await buildViewFromDatabase(true);
      const oggi = flags.has('oggi')
        ? String(flags.get('oggi'))
        : new Date().toISOString().slice(0, 10);
      // Si verificano solo i mandati con il termine già scaduto: su quelli non
      // ancora scaduti non c'è niente da affermare, e la richiesta al portale
      // pubblico sarebbe sprecata.
      const scaduti = allMandates(view).filter((m) => m.dueBy && m.dueBy < oggi);
      const rapporto = await verificaAttuazioni(scaduti, {
        oggi,
        quanti: flags.has('quanti') ? Number(flags.get('quanti')) : 25,
        ...(flags.has('non-prima-di')
          ? { nonPrimaDiGiorni: Number(flags.get('non-prima-di')) }
          : {}),
        ...(flags.has('intervallo')
          ? { client: new GazzettaClient({ intervalloMs: Number(flags.get('intervallo')) }) }
          : {}),
        persist: !flags.has('senza-scrittura'),
        onProgress: (m) => process.stdout.write(`  ${m}\n`),
      });
      process.stdout.write(
        [
          '',
          `mandati scaduti nel corpus: ${scaduti.length}`,
          `già verificati di recente:  ${rapporto.saltati}`,
          `esaminati in questo giro:   ${rapporto.esaminati}`,
          `  adottato:                 ${rapporto.perEsito.adottato}`,
          `  non adottato:             ${rapporto.perEsito['non-adottato']}`,
          `  non verificabile:         ${rapporto.perEsito['non-verificabile']}`,
          `durata:                     ${(rapporto.durataMs / 1000).toFixed(1)}s`,
          '',
          GAZZETTA_FONTE,
          '',
        ].join('\n'),
      );
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
        parquet: flags.has('parquet'),
      });
      process.stdout.write(`${JSON.stringify(manifest.counts, null, 2)}\n`);
      return 0;
    }

    case 'estrai': {
      const vocabolario = flags.get('vocabolario');
      if (typeof vocabolario !== 'string') {
        process.stderr.write('Serve --vocabolario, es. data/vocabolari/appalti.json\n');
        return 2;
      }
      const report = await estraiVerticale({
        vocabolario,
        persist: !flags.has('senza-scrittura'),
        tuttoIlCorpus: flags.has('tutto-il-corpus'),
        ...(flags.has('limite') ? { limite: Number(flags.get('limite')) } : {}),
        onProgress: (m) => process.stdout.write(`  ${m}\n`),
      });
      // Il verticale è già nel database, scritto dall'estrazione. Nel dataset ci
      // finisce con `esporta`, come ogni altra tabella: scriverlo qui a mano
      // significava che un'esportazione verso un'altra cartella lo perdeva.
      process.stdout.write(
        [
          '',
          `verticale:     ${report.verticale}`,
          `estrattore:    ${report.estrattore}`,
          `atti nel corpus: ${report.attiCorpus}${flags.has('tutto-il-corpus') ? ' (tutto il corpus ingerito)' : ''}`,
          ...(report.radiciAssenti.length > 0
            ? [`radici assenti:  ${report.radiciAssenti.length} (il verticale copre meno atti)`]
            : []),
          `commi:         ${report.commiEsaminati}`,
          `proposizioni:  ${report.proposizioni}`,
          `con concetto:  ${report.conConcetto} (le uniche confrontabili)`,
          `durata:        ${(report.durataMs / 1000).toFixed(1)}s`,
          '',
        ].join('\n'),
      );
      return 0;
    }

    case 'gold': {
      const sotto = positional[1];
      if (sotto === 'importa') {
        const file = positional[2];
        if (!file) {
          process.stderr.write('Uso: gold importa <file.jsonl>\n');
          return 2;
        }
        const esito = await importaGold(file);
        process.stdout.write(
          `${esito.importate} voci importate, ${esito.totali} nel gold standard.\n`,
        );
        return 0;
      }
      if (sotto === 'valuta') {
        const rapporto = await valutaGold();
        if (rapporto.totali === 0) {
          process.stdout.write(
            "Il gold standard e' vuoto. Senza annotazioni non c'e' niente da misurare:\n" +
              'vedi docs/gold-standard.md per le quattro fonti da cui prenderle.\n',
          );
          return 0;
        }
        // Due numeri, non uno. Il recall complessivo mescola due mancanze
        // diverse — «non abbiamo quell'atto» e «lo abbiamo e non l'abbiamo
        // visto» — che si riparano in due modi diversi.
        process.stdout.write(
          [
            `Annotazioni:            ${rapporto.totali}`,
            `  di cui con atti nel corpus: ${rapporto.nelCorpus}`,
            '',
            `Recall complessivo:     ${(rapporto.recall * 100).toFixed(1)}% (${rapporto.trovate}/${rapporto.totali})`,
            `Recall sul corpus:      ${(rapporto.recallNelCorpus * 100).toFixed(1)}% (${rapporto.esiti.filter((e) => e.nelCorpus && e.trovata).length}/${rapporto.nelCorpus})`,
            '',
            'Il primo numero comprende annotazioni su atti che non abbiamo scaricato:',
            "si alza scaricando piu' corpus. Il secondo misura i controlli.",
            '',
            'Per fonte:',
            ...rapporto.perFonte.map(
              (f) =>
                `  ${f.fonte.padEnd(24)} ${String(f.totali).padStart(5)} annotazioni, ` +
                `${String(f.nelCorpus).padStart(5)} sul corpus, ${String(f.trovate).padStart(4)} intercettate`,
            ),
            '',
            'Per controllo atteso:',
          ].join('\n') + '\n',
        );
        for (const r of rapporto.perControllo) {
          process.stdout.write(
            `  ${r.checkId.padEnd(36)} ${r.trovate}/${r.attese}  ${(r.recall * 100).toFixed(1)}%\n`,
          );
        }
        // Si mostrano solo le annotazioni **i cui atti abbiamo**: le altre non
        // dicono niente sul motore, e riempirebbero lo schermo nascondendo
        // quelle che invece un controllo avrebbe dovuto vedere.
        const perse = rapporto.esiti.filter((e) => !e.trovata && e.nelCorpus);
        if (perse.length > 0) {
          process.stdout.write(`\nNon intercettate, con l'atto nel corpus (${perse.length}):\n`);
          for (const e of perse.slice(0, 15)) {
            process.stdout.write(`  [${e.sourceKind}] ${e.sourceRef}\n    ${e.urns.join(' ')}\n`);
          }
        }
        return 0;
      }
      process.stderr.write('Uso: gold importa <file> | gold valuta\n');
      return 2;
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
