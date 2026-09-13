/**
 * Pubblicazione sulle piattaforme.
 *
 * Ogni piattaforma è dietro la stessa interfaccia e si attiva solo se le sue
 * credenziali ci sono. Senza credenziali il bot **non fallisce**: stampa cosa
 * avrebbe pubblicato e esce con successo. È il comportamento giusto per un
 * progetto che gira su una GitHub Action in un repository forkabile — chi
 * clona deve poter eseguire `pnpm --filter @leggichenontornano/bot run pubblica` e
 * vedere il messaggio, non un errore di configurazione.
 */
import type { Messaggio } from './messaggio.js';

export interface Esito {
  piattaforma: string;
  pubblicato: boolean;
  /** URL del messaggio pubblicato, quando la piattaforma lo restituisce. */
  url?: string;
  motivo?: string;
}

export interface Pubblicatore {
  readonly nome: string;
  configurato(): boolean;
  pubblica(messaggio: Messaggio): Promise<Esito>;
}

/** Mastodon: API standard, un token basta. */
export class Mastodon implements Pubblicatore {
  readonly nome = 'mastodon';

  constructor(
    private readonly istanza = process.env['MASTODON_INSTANCE'] ?? '',
    private readonly token = process.env['MASTODON_TOKEN'] ?? '',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  configurato(): boolean {
    return this.istanza.length > 0 && this.token.length > 0;
  }

  async pubblica(messaggio: Messaggio): Promise<Esito> {
    const res = await this.fetchImpl(`${this.istanza.replace(/\/+$/, '')}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        // Due esecuzioni nello stesso giorno non devono produrre due post.
        'idempotency-key': messaggio.url,
      },
      body: JSON.stringify({ status: messaggio.testo, language: 'it', visibility: 'public' }),
    });
    if (!res.ok) {
      return { piattaforma: this.nome, pubblicato: false, motivo: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { url?: string };
    return { piattaforma: this.nome, pubblicato: true, ...(body.url ? { url: body.url } : {}) };
  }
}

/** Telegram: invio su un canale tramite bot. */
export class Telegram implements Pubblicatore {
  readonly nome = 'telegram';

  constructor(
    private readonly token = process.env['TELEGRAM_BOT_TOKEN'] ?? '',
    private readonly canale = process.env['TELEGRAM_CHANNEL'] ?? '',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  configurato(): boolean {
    return this.token.length > 0 && this.canale.length > 0;
  }

  async pubblica(messaggio: Messaggio): Promise<Esito> {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.canale,
        text: messaggio.testo,
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      return { piattaforma: this.nome, pubblicato: false, motivo: `HTTP ${res.status}` };
    }
    return { piattaforma: this.nome, pubblicato: true };
  }
}

/**
 * X: l'API v2 richiede OAuth 1.0a o un token utente OAuth 2.0, e la firma non
 * si improvvisa. Qui c'è il punto di aggancio; l'implementazione arriva quando
 * il progetto avrà un account e le sue credenziali, non prima.
 *
 * Nel frattempo il pubblicatore si dichiara non configurato, che è la verità.
 */
export class X implements Pubblicatore {
  readonly nome = 'x';

  configurato(): boolean {
    return false;
  }

  async pubblica(): Promise<Esito> {
    return {
      piattaforma: this.nome,
      pubblicato: false,
      motivo: 'pubblicazione su X non ancora implementata: mancano le credenziali del progetto',
    };
  }
}

export function pubblicatoriAttivi(): Pubblicatore[] {
  return [new Mastodon(), new Telegram(), new X()].filter((p) => p.configurato());
}
