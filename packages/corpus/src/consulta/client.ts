/**
 * Scaricamento degli archivi open data della Corte costituzionale.
 *
 * Stesso vincolo del client Normattiva: **niente scraping**. La Consulta
 * pubblica archivi zip aggiornati quotidianamente, ed è quello che scarichiamo.
 * Non esiste in questo pacchetto un percorso di codice che legga le pagine di
 * consultazione del sito.
 *
 * Dati in CC BY-SA 3.0, Corte costituzionale — `dati.cortecostituzionale.it`.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const CONSULTA_BASE =
  process.env['CONSULTA_OPENDATA_BASE'] ?? 'https://dati.cortecostituzionale.it/opendata';

/** Gli archivi delle pronunce, per periodo. Sono i tre pubblicati dal portale. */
export const ARCHIVI_PRONUNCE = [
  { periodo: '1956-1980', path: 'distribuzione/pronunce/P_json1956_1980.zip' },
  { periodo: '1981-2000', path: 'distribuzione/pronunce/P_json1981_2000.zip' },
  { periodo: '2001-oggi', path: 'distribuzione/pronunce/P_json2001_oggi.zip' },
] as const;

export const CONSULTA_LICENCE = 'CC BY-SA 3.0 — Corte costituzionale, dati.cortecostituzionale.it';

const DEFAULT_UA =
  'antinomia/0.1 (+https://github.com/riccardolinares/leggichenontornano) progetto civico open source';

export interface ConsultaOptions {
  baseUrl?: string;
  /** Cartella di cache su disco: un archivio già scaricato non si riscarica. */
  cacheDir?: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  onProgress?: (message: string) => void;
}

export class ConsultaClient {
  private readonly baseUrl: string;
  private readonly cacheDir: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (m: string) => void;

  constructor(opts: ConsultaOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? CONSULTA_BASE).replace(/\/+$/, '');
    this.cacheDir = opts.cacheDir ?? 'data/consulta';
    this.userAgent = opts.userAgent ?? DEFAULT_UA;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.log = opts.onProgress ?? (() => undefined);
  }

  /**
   * Scarica un archivio, o lo rilegge dalla cache.
   *
   * La cache non è un'ottimizzazione: è il modo di non ripetere un download da
   * cinquanta megabyte ogni volta che si riesegue la pipeline in locale.
   */
  async archivio(path: string): Promise<Uint8Array> {
    const destinazione = join(this.cacheDir, path);
    if (existsSync(destinazione)) {
      this.log(`${path} già in cache`);
      return new Uint8Array(readFileSync(destinazione));
    }
    const url = `${this.baseUrl}/${path}`;
    this.log(`scarico ${url}`);
    const response = await this.fetchImpl(url, { headers: { 'user-agent': this.userAgent } });
    if (!response.ok) {
      throw new Error(`Corte costituzionale: ${response.status} su ${url}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    mkdirSync(dirname(destinazione), { recursive: true });
    writeFileSync(destinazione, bytes);
    this.log(`${path}: ${(bytes.length / 1e6).toFixed(1)} MB`);
    return bytes;
  }
}
