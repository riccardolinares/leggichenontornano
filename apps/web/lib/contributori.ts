/**
 * Chi ha contribuito, letto da GitHub **in fase di costruzione**.
 *
 * Due vincoli, e sono entrambi del progetto e non di questo file.
 *
 * **Niente richieste dal browser.** Il sito non fa partire una sola chiamata
 * verso un dominio esterno mentre qualcuno lo legge (DESIGN.md §5): una
 * richiesta all'API di GitHub da una pagina che dice quali leggi una persona
 * sta guardando è esattamente il tracciamento che il progetto non ha. La
 * lettura avviene qui, una volta, quando la pagina viene costruita, e quello
 * che finisce online è HTML.
 *
 * **La build non deve dipendere da un servizio.** GitHub può non rispondere, il
 * repository può essere privato, la rete della macchina che costruisce può non
 * uscire. Nessuno di questi è un motivo per non pubblicare il sito: l'elenco
 * resta vuoto, la pagina lo dice e spiega perché. Fallire la build per un
 * elenco di nomi sarebbe la scelta sbagliata — toglierebbe dal sito anche le
 * segnalazioni, che sono il motivo per cui esiste.
 */
import { REPO_URL } from './dataset';

export interface Contributore {
  /** Nome utente GitHub: è anche la chiave con cui si aggancia al registro. */
  utente: string;
  profilo: string;
  /** Numero di commit sul ramo principale. Vedi la nota nella pagina. */
  contributi: number;
}

export interface EsitoContributori {
  elenco: Contributore[];
  /** Perché l'elenco è vuoto, quando lo è. `null` quando la lettura è riuscita. */
  motivo: string | null;
}

/** `owner/repo` ricavato dall'indirizzo pubblico del repository. */
function coordinate(): { proprietario: string; repository: string } | null {
  const m = /github\.com\/([^/]+)\/([^/?#]+)/.exec(REPO_URL);
  if (!m?.[1] || !m[2]) return null;
  return { proprietario: m[1], repository: m[2].replace(/\.git$/, '') };
}

interface VoceApi {
  login?: string;
  html_url?: string;
  contributions?: number;
  type?: string;
}

/**
 * L'elenco dei contributori, in classifica per numero di commit.
 *
 * Il tempo massimo è dichiarato e corto: una build che resta appesa otto minuti
 * su una richiesta di rete è un guasto che sembra lentezza, e si scopre solo
 * quando qualcuno guarda perché il sito non si aggiorna più.
 */
export async function contributori(): Promise<EsitoContributori> {
  const dove = coordinate();
  if (!dove) {
    return {
      elenco: [],
      motivo:
        'L’indirizzo del repository configurato non è un repository GitHub, e l’elenco dei contributori si legge da lì.',
    };
  }

  const interruttore = new AbortController();
  const scadenza = setTimeout(() => interruttore.abort(), 8000);

  /* Senza credenziali l'API pubblica concede sessanta richieste all'ora **per
     indirizzo IP**, e le macchine che costruiscono i siti condividono gli
     indirizzi con molti altri: da lì un 403 arriva senza che nessuno abbia
     fatto niente di strano. Il token non serve a leggere qualcosa di privato —
     l'elenco è pubblico — serve solo ad alzare quel limite, ed è facoltativo:
     senza, la pagina si costruisce lo stesso e dice perché l'elenco manca.
     
     La variabile è nostra e non `GITHUB_TOKEN`, che in molti ambienti è già
     impostata per altro: leggendo quella, una build che senza credenziali
     avrebbe funzionato si prende un 401 da un token che non era per noi. */
  const token = process.env['LCNT_GITHUB_TOKEN'];

  try {
    const risposta = await fetch(
      `https://api.github.com/repos/${dove.proprietario}/${dove.repository}/contributors?per_page=100`,
      {
        signal: interruttore.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'leggichenontornano',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'force-cache',
      },
    );

    if (!risposta.ok) {
      const perche =
        risposta.status === 403 || risposta.status === 429
          ? 'ha superato il limite di richieste concesse senza credenziali'
          : `ha risposto ${risposta.status}`;
      return {
        elenco: [],
        motivo: `L’API pubblica di GitHub ${perche} quando questa pagina è stata costruita, e l’elenco non è stato letto.`,
      };
    }

    const grezzo = (await risposta.json()) as VoceApi[];
    if (!Array.isArray(grezzo)) {
      return {
        elenco: [],
        motivo:
          'L’API pubblica di GitHub ha risposto qualcosa che non è un elenco di contributori.',
      };
    }

    /* I bot fuori: le Action di questo progetto committano il dataset e
       l'approfondimento del giorno, e in una classifica di commit finirebbero
       in cima. Non è un contributo di nessuno — è il progetto che scrive su sé
       stesso, e metterlo accanto a chi ha davvero lavorato falserebbe l'unica
       cosa che la classifica dovrebbe far vedere. */
    const elenco = grezzo
      .filter((v) => v.type !== 'Bot' && typeof v.login === 'string' && !v.login.endsWith('[bot]'))
      .map((v) => ({
        utente: v.login as string,
        profilo: v.html_url ?? `https://github.com/${v.login}`,
        contributi: v.contributions ?? 0,
      }))
      .sort((a, b) => b.contributi - a.contributi || a.utente.localeCompare(b.utente, 'it'));

    return { elenco, motivo: null };
  } catch (errore: unknown) {
    const causa =
      errore instanceof Error && errore.name === 'AbortError'
        ? 'non ha risposto in tempo'
        : 'non è stata raggiungibile';
    return {
      elenco: [],
      motivo: `L’API pubblica di GitHub ${causa} quando questa pagina è stata costruita. Il sito si costruisce lo stesso: l’elenco dei nomi non è una condizione per pubblicare le segnalazioni.`,
    };
  } finally {
    clearTimeout(scadenza);
  }
}
