#!/usr/bin/env node
/**
 * La redazione, dalla riga di comando.
 *
 *   lcnt-redazione scrivi [--giorno 2026-09-13] [--prova] [--dest data/blog]
 *
 * `--prova` stampa l'articolo senza scriverlo. Senza `ANTHROPIC_API_KEY` il
 * comando **non fallisce**: dice che la redazione non è configurata ed esce con
 * successo, così una GitHub Action su un fork non diventa rossa per una cosa
 * che non deve fare.
 */
import { SnapshotReader } from '@leggichenontornano/corpus';
import { selezionaPerIlBlog } from './selezione.js';
import { costruisciFatti } from './fatti.js';
import { Scrittore } from './scrittore.js';
import { verifica } from './verifica.js';
import {
  CARTELLA_PREDEFINITA,
  articoloDelGiorno,
  giaRaccontate,
  scriviArticolo,
} from './archivio.js';

const USAGE = `lcnt-redazione — l'approfondimento del giorno

  scrivi [--giorno AAAA-MM-GG] [--prova] [--dest cartella]

Variabili d'ambiente:
  LCNT_SNAPSHOT      dataset da cui leggere (predefinito: data/snapshot)
  ANTHROPIC_API_KEY  senza, il comando non scrive e non fallisce
`;

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const comando = process.argv[2];
  if (comando !== 'scrivi') {
    process.stdout.write(USAGE);
    process.exit(comando ? 1 : 0);
  }

  const giorno = argomento('giorno') ?? new Date().toISOString().slice(0, 10);
  const dest = argomento('dest') ?? CARTELLA_PREDEFINITA;
  const prova = process.argv.includes('--prova');

  const esistente = articoloDelGiorno(giorno, dest);
  if (esistente) {
    process.stdout.write(`Per il ${giorno} c'è già «${esistente.titolo}». Niente da fare.\n`);
    return;
  }

  if (!Scrittore.disponibile()) {
    process.stdout.write(
      'Redazione non configurata: manca ANTHROPIC_API_KEY.\n' +
        'Il blog non pubblica, e non è un errore: il resto del sito funziona lo stesso.\n',
    );
    return;
  }

  const reader = SnapshotReader.fromDirectory(process.env['LCNT_SNAPSHOT'] ?? 'data/snapshot');
  const scelta = selezionaPerIlBlog(reader, { giorno, giaRaccontate: giaRaccontate(dest) });
  if (!scelta) {
    process.stdout.write(
      'Nessuna segnalazione da raccontare: o il dataset è vuoto, o le abbiamo già raccontate tutte.\n',
    );
    return;
  }

  const fatti = costruisciFatti(reader, scelta.anomalia);
  const scrittore = new Scrittore();

  // Un secondo tentativo, con i motivi del rifiuto in mano. Oltre non si va:
  // se l'articolo non regge due volte, oggi non si pubblica.
  let motiviPrecedenti: string[] = [];
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    const articolo = await scrittore.scrivi(
      fatti,
      giorno,
      motiviPrecedenti.length > 0 ? motiviPrecedenti.join('; ') : undefined,
    );
    const esito = verifica(articolo, fatti);

    if (esito.ok) {
      if (prova) {
        process.stdout.write(`${JSON.stringify(articolo, null, 2)}\n`);
        return;
      }
      const percorso = scriviArticolo(articolo, dest);
      process.stdout.write(`Scritto ${percorso}\n«${articolo.titolo}»\n`);
      return;
    }

    process.stderr.write(
      `Tentativo ${tentativo} rifiutato dalla verifica:\n` +
        esito.motivi.map((m) => `  - ${m}`).join('\n') +
        '\n',
    );
    motiviPrecedenti = esito.motivi;
  }

  process.stderr.write(
    'Nessun articolo pubblicabile oggi. Saltare un giorno costa meno che pubblicare\n' +
      'una frase che i fatti non sostengono.\n',
  );
  process.exit(1);
}

main().catch((errore: unknown) => {
  process.stderr.write(`redazione: ${(errore as Error).message}\n`);
  process.exit(1);
});
