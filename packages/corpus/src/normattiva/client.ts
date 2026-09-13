/**
 * Client per le API Open Data di Normattiva.
 *
 * Vincolo esplicito del progetto: **niente harvesting aggressivo**. Si usano le
 * API di export e le collezioni predefinite previste dal portale, con un
 * limitatore di frequenza e una cache su disco. Non esiste in questo pacchetto
 * un percorso di codice che faccia scraping HTML del portale di consultazione:
 * se serve un dato che le API non espongono, si apre una issue, non si aggira
 * il vincolo.
 *
 * Riferimento: «Normattiva — Specifiche API Open Data», rev. 09/01/2025,
 * pubblicate su dati.normattiva.it.
 *
 * Dati distribuiti in CC BY 4.0. La banca dati non ha carattere di ufficialità.
 */

export const NORMATTIVA_BASE =
  process.env['NORMATTIVA_API_BASE'] ??
  'https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1';

/** Formato di collezione: originale, multivigente, vigente. */
export type CollectionFormat = 'O' | 'M' | 'V';

export interface CollectionInfo {
  nomeCollezione: string;
  formatoCollezione: CollectionFormat;
  descrizioneFormatoCollezione: string;
  dataCreazione: string;
  numeroAtti: number;
}

export interface ClientOptions {
  baseUrl?: string;
  /** Millisecondi minimi fra due richieste. Predefinito: 1000. */
  minIntervalMs?: number;
  /** Tentativi in caso di errore di rete o 5xx. Predefinito: 4. */
  retries?: number;
  /** User-Agent inviato: deve identificare il progetto, non fingersi un browser. */
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

export class NormattivaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'NormattivaError';
  }
}

const DEFAULT_UA =
  'leggichenontornano/0.1 (+https://github.com/riccardolinares/leggichenontornano) progetto civico open source';

export class NormattivaClient {
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? NORMATTIVA_BASE).replace(/\/+$/, '');
    this.minIntervalMs = opts.minIntervalMs ?? 1000;
    this.retries = opts.retries ?? 4;
    this.userAgent = opts.userAgent ?? DEFAULT_UA;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** Elenco delle collezioni predefinite, con numero di atti e data di creazione. */
  async listCollections(): Promise<CollectionInfo[]> {
    const res = await this.request('/collections/collection-predefinite');
    return (await res.json()) as CollectionInfo[];
  }

  /** Estensioni di esportazione disponibili (AKN, XML, JSON, ...). */
  async listExportFormats(): Promise<Array<{ label: string; value: string }>> {
    const res = await this.request('/tipologiche/estensioni');
    return (await res.json()) as Array<{ label: string; value: string }>;
  }

  /** Denominazioni di atto note a Normattiva, con il loro codice. */
  async listActTypes(): Promise<Array<{ label: string; value: string }>> {
    const res = await this.request('/tipologiche/denominazione-atto');
    return (await res.json()) as Array<{ label: string; value: string }>;
  }

  /**
   * Scarica una collezione predefinita come archivio ZIP di file Akoma Ntoso.
   * È la via prevista dal portale per l'accesso massivo: più efficiente per
   * Normattiva e per noi di decine di migliaia di richieste singole.
   */
  async downloadCollection(
    name: string,
    format: CollectionFormat = 'M',
    exportFormat = 'AKN',
  ): Promise<Uint8Array> {
    const qs = new URLSearchParams({
      nome: name,
      formato: exportFormat,
      formatoRichiesta: format,
    });
    const res = await this.request(`/collections/download/collection-preconfezionata?${qs}`, {
      accept: '*/*',
    });
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Atti aggiornati fra due date: è la base dell'aggiornamento incrementale. */
  async updatedBetween(from: string, to: string): Promise<unknown> {
    const res = await this.request('/ricerca/aggiornati', {
      method: 'POST',
      body: { dataInizio: from, dataFine: to },
    });
    return res.json();
  }

  /** Dettaglio di un singolo articolo a una data di vigenza. */
  async articleDetail(params: {
    dataGU: string;
    codiceRedazionale: string;
    idArticolo: number;
    dataVigenza: string;
    sottoArticolo?: number;
    sottoArticolo1?: number;
    idGruppo?: number;
    progressivo?: number;
    versione?: number;
  }): Promise<unknown> {
    const res = await this.request('/atto/dettaglio-atto', {
      method: 'POST',
      body: {
        sottoArticolo: 0,
        sottoArticolo1: 0,
        idGruppo: 0,
        progressivo: 0,
        versione: 0,
        ...params,
      },
    });
    return res.json();
  }

  private async request(
    path: string,
    opts: { method?: string; body?: unknown; accept?: string } = {},
  ): Promise<Response> {
    // Le richieste sono serializzate: una coda con intervallo minimo è più
    // onesta di N richieste parallele "tanto sono poche".
    const run = async (): Promise<Response> => {
      await this.throttle();
      const url = `${this.baseUrl}${path}`;
      let lastError: unknown;
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const res = await this.fetchImpl(url, {
            method: opts.method ?? 'GET',
            headers: {
              accept: opts.accept ?? 'application/json, text/plain, */*',
              'user-agent': this.userAgent,
              ...(opts.body ? { 'content-type': 'application/json' } : {}),
            },
            ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
            redirect: 'follow',
          });
          if (res.status >= 500 || res.status === 429) {
            throw new NormattivaError(`risposta ${res.status}`, res.status, url);
          }
          if (!res.ok) {
            throw new NormattivaError(`richiesta fallita con stato ${res.status}`, res.status, url);
          }
          return res;
        } catch (err) {
          lastError = err;
          const retriable =
            !(err instanceof NormattivaError) ||
            err.status === undefined ||
            err.status >= 500 ||
            err.status === 429;
          if (!retriable || attempt === this.retries) break;
          await sleep(backoffMs(attempt));
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new NormattivaError(String(lastError), undefined, `${this.baseUrl}${path}`);
    };

    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }
}

/** Attesa esponenziale con jitter: 2s, 4s, 8s, 16s. */
export function backoffMs(attempt: number): number {
  const base = 2000 * 2 ** attempt;
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
