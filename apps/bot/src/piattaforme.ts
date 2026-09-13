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

/**
 * Facebook: pubblicazione sulla pagina del progetto, con un token di pagina.
 *
 * In Italia Facebook è ancora il posto dove una notizia di servizio pubblico
 * circola fuori dalla bolla di chi già segue il tema, ed è il motivo per cui
 * c'è: non perché sia la piattaforma più amata, ma perché ci sta chi questa
 * roba non la cercherebbe mai.
 */
export class Facebook implements Pubblicatore {
  readonly nome = 'facebook';

  constructor(
    private readonly pagina = process.env['FACEBOOK_PAGE_ID'] ?? '',
    private readonly token = process.env['FACEBOOK_PAGE_TOKEN'] ?? '',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  configurato(): boolean {
    return this.pagina.length > 0 && this.token.length > 0;
  }

  async pubblica(messaggio: Messaggio): Promise<Esito> {
    // `link` separato da `message`: così l'anteprima Open Graph viene
    // costruita da Facebook a partire dalla pagina, invece che indovinata
    // dall'URL dentro il testo.
    const res = await this.fetchImpl(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(this.pagina)}/feed`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: messaggio.testo,
          link: messaggio.url,
          access_token: this.token,
        }),
      },
    );
    if (!res.ok) {
      return { piattaforma: this.nome, pubblicato: false, motivo: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { id?: string };
    return {
      piattaforma: this.nome,
      pubblicato: true,
      ...(body.id ? { url: `https://www.facebook.com/${body.id}` } : {}),
    };
  }
}

/**
 * LinkedIn: pubblicazione come organizzazione.
 *
 * È il canale dove sta il pubblico che questo progetto serve davvero —
 * funzionari, avvocati d'impresa, chi scrive bandi — e dove un rinvio a una
 * norma abrogata non è una curiosità ma un problema di lavoro.
 */
export class LinkedIn implements Pubblicatore {
  readonly nome = 'linkedin';

  constructor(
    private readonly organizzazione = process.env['LINKEDIN_ORG_URN'] ?? '',
    private readonly token = process.env['LINKEDIN_TOKEN'] ?? '',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  configurato(): boolean {
    return this.organizzazione.length > 0 && this.token.length > 0;
  }

  async pubblica(messaggio: Messaggio): Promise<Esito> {
    const res = await this.fetchImpl('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'linkedin-version': '202405',
        'x-restli-protocol-version': '2.0.0',
      },
      body: JSON.stringify({
        author: this.organizzazione,
        commentary: messaggio.testo,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED' },
        lifecycleState: 'PUBLISHED',
      }),
    });
    if (!res.ok) {
      return { piattaforma: this.nome, pubblicato: false, motivo: `HTTP ${res.status}` };
    }
    const id = res.headers.get('x-restli-id');
    return {
      piattaforma: this.nome,
      pubblicato: true,
      ...(id ? { url: `https://www.linkedin.com/feed/update/${id}` } : {}),
    };
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
  return [new Telegram(), new Facebook(), new LinkedIn(), new X()].filter((p) => p.configurato());
}
