/**
 * Da dove il server MCP prende i dati.
 *
 * Il vincolo che governa questo file è uno solo: **deve funzionare senza che
 * nessuno configuri niente**. Chi vuole usare il progetto dentro un assistente
 * è spesso un giornalista o un giurista, non ha clonato il repository e non
 * intende farlo, e una riga di configurazione in più è il punto in cui
 * rinuncia.
 *
 * Quindi, in ordine:
 *
 *  1. `LCNT_SNAPSHOT` — un dataset già sul disco. È il caso di chi
 *     sviluppa: nessuna rete, dati freschi quanto il suo clone.
 *  2. Altrimenti si scarica il dataset pubblico e lo si tiene in cache. Zero
 *     configurazione, e i file sono gli stessi che il sito legge.
 *
 * La cache non è un'ottimizzazione: senza, ogni avvio dell'assistente
 * riscaricherebbe qualche megabyte, e un server MCP si avvia molte volte al
 * giorno.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { SnapshotReader, SNAPSHOT_FILES } from '@leggichenontornano/corpus';

/** Dove stanno i file del dataset pubblico, quando non ce n'è uno locale. */
const BASE_PUBBLICA =
  process.env['LCNT_DATASET_URL'] ??
  'https://raw.githubusercontent.com/riccardolinares/leggichenontornano/main/data/snapshot';

/** Ore dopo le quali la cache si considera vecchia. Il dataset si rigenera una volta al giorno. */
const ORE_DI_VALIDITA = 12;

export interface EsitoSorgente {
  reader: SnapshotReader;
  /** Da dove vengono i dati, in lingua comune: finisce nei messaggi di errore e in `stato_del_progetto`. */
  provenienza: string;
  aggiornatoAl: string | null;
}

function cartellaCache(): string {
  const base =
    process.env['LCNT_CACHE'] ??
    (process.env['XDG_CACHE_HOME']
      ? join(process.env['XDG_CACHE_HOME'], 'leggichenontornano')
      : join(homedir() || tmpdir(), '.cache', 'leggichenontornano'));
  mkdirSync(base, { recursive: true });
  return base;
}

function troppoVecchio(path: string): boolean {
  try {
    return (Date.now() - statSync(path).mtimeMs) / 3_600_000 > ORE_DI_VALIDITA;
  } catch {
    return true;
  }
}

/**
 * Scarica i file del dataset che mancano o sono vecchi.
 *
 * Un file che non si riesce a scaricare **non** ferma l'avvio: il dataset è
 * fatto di parti, e un server che parte senza le pronunce è più utile di un
 * server che non parte. Quello che non deve succedere è partire senza dirlo,
 * ed è per questo che `provenienza` racconta cosa è successo.
 */
async function scaricaSeServe(dir: string): Promise<string[]> {
  const problemi: string[] = [];
  for (const nome of Object.values(SNAPSHOT_FILES)) {
    const destinazione = join(dir, nome);
    if (existsSync(destinazione) && !troppoVecchio(destinazione)) continue;
    try {
      const risposta = await fetch(`${BASE_PUBBLICA}/${nome}`);
      if (!risposta.ok) {
        // 404 su un file facoltativo è normale: non tutti i dataset hanno un
        // verticale o le pronunce.
        if (risposta.status !== 404) problemi.push(`${nome}: HTTP ${risposta.status}`);
        if (!existsSync(destinazione)) writeFileSync(destinazione, '');
        continue;
      }
      writeFileSync(destinazione, Buffer.from(await risposta.arrayBuffer()));
    } catch (errore) {
      problemi.push(`${nome}: ${(errore as Error).message}`);
    }
  }
  return problemi;
}

export async function apriSorgente(): Promise<EsitoSorgente> {
  const locale = process.env['LCNT_SNAPSHOT'];
  if (locale && existsSync(join(locale, SNAPSHOT_FILES.acts))) {
    const reader = SnapshotReader.fromDirectory(locale);
    return {
      reader,
      provenienza: `dataset locale in ${locale}`,
      aggiornatoAl: reader.data.manifest?.generatedAt ?? null,
    };
  }

  const dir = cartellaCache();
  const problemi = await scaricaSeServe(dir);
  const reader = SnapshotReader.fromDirectory(dir);
  const provenienza =
    problemi.length > 0
      ? `dataset pubblico in cache (${dir}); non scaricati: ${problemi.join(', ')}`
      : `dataset pubblico di ${BASE_PUBBLICA}, in cache in ${dir}`;
  return { reader, provenienza, aggiornatoAl: reader.data.manifest?.generatedAt ?? null };
}

/** Il dataset è utilizzabile, o siamo partiti sul vuoto? */
export function datasetVuoto(reader: SnapshotReader): boolean {
  return reader.data.acts.length === 0;
}

export function leggiJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}
