#!/usr/bin/env node
/**
 * Il registro dei consumi, dalla riga di comando.
 *
 *   lcnt-consumi dichiara --chi <utente-github> --sessione <file.jsonl>
 *   lcnt-consumi dichiara --chi <utente-github> --modello claude-opus-5 \
 *                        --ingresso 120000 --uscita 8000
 *   lcnt-consumi riepilogo
 *
 * Serve a chi contribuisce lavorando con un assistente. Il vincolo di progetto è
 * che costi **trenta secondi**: un adempimento più lungo di così non lo fa
 * nessuno, e un registro che misura solo le chiamate automatiche racconta metà
 * del costo di questo progetto — la metà più facile da contare, non la più
 * grande.
 *
 * Per questo `--sessione` accetta il file di trascrizione così com'è: i token
 * stanno già dentro, non c'è niente da copiare a mano e niente da ricordarsi.
 */
import { existsSync, readFileSync } from 'node:fs';
import {
  CARTELLA_PREDEFINITA,
  componiRiga,
  etichettaUso,
  leggiRegistro,
  registra,
  riepiloga,
  tokenTotali,
  type DaRegistrare,
} from './registro.js';
import { VALUTA } from './prezzi.js';
import { tokenDaSessione } from './sessione.js';

/**
 * I numeri si scrivono all'italiana anche qui.
 *
 * `toFixed` produce «0.0412», che a chi legge in italiano non sembra un
 * decimale ma un refuso — e un refuso su una cifra fa dubitare della cifra.
 * Vale sul sito e vale in un terminale: è la stessa persona che legge.
 */
function cifra(valore: number, decimali: number): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(valore);
}

function conta(valore: number): string {
  return new Intl.NumberFormat('it-IT').format(valore);
}

/** «1 chiamate registrate» si legge come un guasto, e spesso lo è. */
function plurale(quanti: number, singolare: string, plurale: string): string {
  return quanti === 1 ? singolare : plurale;
}

const USO = `lcnt-consumi — il registro dei consumi del progetto

  dichiara --chi <utente-github> [--sessione <file.jsonl>]
           [--modello <id> --ingresso <n> --uscita <n>]
           [--cache-scrittura <n>] [--cache-lettura <n>]
           [--quando AAAA-MM-GG] [--nota "…"] [--prova]

  riepilogo

Il modo più rapido è --sessione: il file di trascrizione del vostro assistente
porta già i token dentro, e il comando li somma per modello.

Variabili d'ambiente:
  LCNT_CONSUMI   cartella del registro (predefinito: data/consumi)
`;

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function intero(nome: string): number {
  const grezzo = argomento(nome);
  if (grezzo === undefined) return 0;
  const n = Number.parseInt(grezzo, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`--${nome} deve essere un numero intero non negativo, non «${grezzo}».`);
  }
  return n;
}

function dichiara(): void {
  const chi = argomento('chi');
  if (!chi) {
    throw new Error(
      'Manca --chi: serve il vostro nome utente GitHub, perché la riga sia attribuibile a qualcuno.',
    );
  }

  const quandoGrezzo = argomento('quando');
  const quando = quandoGrezzo ? `${quandoGrezzo.slice(0, 10)}T12:00:00.000Z` : undefined;
  const nota = argomento('nota');
  const prova = process.argv.includes('--prova');

  const voci: DaRegistrare[] = [];
  const sessione = argomento('sessione');

  if (sessione) {
    if (!existsSync(sessione)) throw new Error(`Il file di sessione «${sessione}» non esiste.`);
    const per = tokenDaSessione(readFileSync(sessione, 'utf8'));
    if (per.size === 0) {
      throw new Error(
        `In «${sessione}» non c'è nessun conteggio di token. ` +
          'Se il vostro assistente non li scrive, passate i numeri a mano con --modello, --ingresso e --uscita.',
      );
    }
    for (const [modello, somma] of per) {
      voci.push({
        modello,
        uso: 'contributo',
        tokenIngresso: somma.ingresso,
        tokenUscita: somma.uscita,
        tokenCacheScrittura: somma.cacheScrittura,
        tokenCacheLettura: somma.cacheLettura,
        chi,
        origine: 'dichiarato',
        ...(quando ? { quando } : {}),
        ...(nota ? { nota } : {}),
      });
    }
  } else {
    const modello = argomento('modello');
    if (!modello) {
      throw new Error('Serve --sessione oppure --modello con almeno --ingresso e --uscita.');
    }
    voci.push({
      modello,
      uso: 'contributo',
      tokenIngresso: intero('ingresso'),
      tokenUscita: intero('uscita'),
      tokenCacheScrittura: intero('cache-scrittura'),
      tokenCacheLettura: intero('cache-lettura'),
      chi,
      origine: 'dichiarato',
      ...(quando ? { quando } : {}),
      ...(nota ? { nota } : {}),
    });
  }

  for (const voce of voci) {
    const riga = prova ? componiRiga(voce) : registra(voce);
    const costo =
      riga.costo === null
        ? 'costo non stimabile: modello non a listino'
        : `${cifra(riga.costo, 4)} ${riga.valuta}`;
    process.stdout.write(
      `${prova ? '[prova] ' : ''}${riga.chi} · ${riga.modello} · ` +
        `${conta(riga.tokenIngresso)} in, ${conta(riga.tokenUscita)} out · ${costo}\n`,
    );
  }

  if (!prova) {
    process.stdout.write(
      `Scritto in ${CARTELLA_PREDEFINITA}. Aprite una pull request con quel file: è così che la spesa diventa pubblica.\n`,
    );
  }
}

function mostraRiepilogo(): void {
  const righe = leggiRegistro();
  const r = riepiloga(righe);
  if (r.righe === 0) {
    process.stdout.write(
      'Il registro è vuoto: nessuna chiamata al modello è ancora stata misurata.\n',
    );
    return;
  }
  process.stdout.write(
    `${conta(r.righe)} ${plurale(r.righe, 'chiamata registrata', 'chiamate registrate')}, ` +
      `da ${r.dal} a ${r.al}.\n` +
      `Token in tutto: ${conta(tokenTotali(r.totali))}. ` +
      `Costo stimato: ${cifra(r.totali.costo, 2)} ${VALUTA}.\n` +
      (r.costoMensile === null
        ? 'Non c’è ancora un mese concluso: la media mensile non si può calcolare.\n'
        : `Media su ${conta(r.mesiCompleti)} ${plurale(r.mesiCompleti, 'mese concluso', 'mesi conclusi')}: ` +
          `${cifra(r.costoMensile, 2)} ${VALUTA} al mese.\n`),
  );
  for (const g of r.perUso) {
    process.stdout.write(`  ${etichettaUso(g.chiave)}: ${cifra(g.costo, 2)} ${VALUTA}\n`);
  }
}

function main(): void {
  const comando = process.argv[2];
  if (comando === 'dichiara') dichiara();
  else if (comando === 'riepilogo') mostraRiepilogo();
  else {
    process.stdout.write(USO);
    process.exit(comando ? 1 : 0);
  }
}

try {
  main();
} catch (errore: unknown) {
  process.stderr.write(`consumi: ${(errore as Error).message}\n`);
  process.exit(1);
}
