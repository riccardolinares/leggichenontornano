/**
 * L'unico modo di parlare con il modello.
 *
 * Il registro dei consumi poteva essere una funzione da chiamare dopo ogni
 * risposta. Sarebbe stata più semplice da scrivere e avrebbe smesso di
 * funzionare al primo percorso nuovo: chi aggiunge una chiamata al modello sta
 * pensando al proprio problema, non alla contabilità del progetto, e una riga
 * da ricordarsi è una riga che prima o poi manca. Il giorno che manca, il
 * registro non dà un errore — dà un totale più basso del vero, che è il modo
 * peggiore di sbagliare, perché sembra un risultato.
 *
 * Per questo qui si avvolge il **client**, non i chiamanti. Chi aggiunge un uso
 * nuovo del modello scrive una riga in più — `clienteModello({ uso: '…' })` — e
 * la misura arriva da sola. Chi se ne dimentica non ha un client da usare.
 *
 * Quello che questo modulo non fa, di proposito: non decide cosa chiedere al
 * modello, non tocca i parametri della chiamata, non riscrive la risposta.
 * Passa i parametri così come arrivano e restituisce la risposta così com'è.
 */
import { CARTELLA_PREDEFINITA, registra, type Origine, type Uso } from './registro.js';

/**
 * L'uso dell'SDK che questo progetto fa davvero.
 *
 * Dichiararlo come interfaccia serve a due cose: iniettare un finto client nei
 * test senza toccare la rete, e rendere visibile in una schermata quanto poco
 * di un SDK molto grande il progetto usi.
 */
export interface ClienteModello {
  messages: {
    create(parametri: Record<string, unknown>): Promise<RispostaModello>;
  };
}

export interface RispostaModello {
  content: Array<{ type: string; name?: string; input?: unknown }>;
  stop_reason?: string | null;
  /** Il modello che ha davvero risposto: può non essere quello richiesto. */
  model?: string;
  usage?: UsoDellApi;
}

/** L'oggetto `usage` che ogni risposta dell'API si porta dietro. */
export interface UsoDellApi {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface OpzioniCliente {
  /** A cosa serve questa chiamata. È l'unica cosa che un uso nuovo deve dire. */
  uso: Uso;
  apiKey?: string;
  /**
   * Un client già pronto, al posto dell'SDK. Nei test è un finto.
   *
   * Quando c'è, il registro **non** scrive: un client iniettato è un doppio di
   * prova, e un registro che si riempie di chiamate finte smette di misurare
   * quello che il progetto spende davvero. Chi vuole provare anche la
   * registrazione passa `registra: true` e una cartella temporanea — ed è
   * esattamente quello che fanno i test di questo pacchetto.
   */
  sottostante?: ClienteModello;
  /** Dove finiscono le righe. Predefinito `data/consumi`. */
  cartella?: string;
  chi?: string;
  origine?: Origine;
  registra?: boolean;
}

/**
 * `true` quando c'è una credenziale con cui chiamare il modello.
 *
 * Senza, i percorsi che usano il modello non falliscono: fanno a meno di lui e
 * lo dicono. Il blog non pubblica, il motore usa l'estrattore a regole.
 */
export function credenzialiPresenti(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY'] ?? process.env['ANTHROPIC_AUTH_TOKEN']);
}

async function apriSdk(apiKey: string | undefined): Promise<ClienteModello> {
  if (!apiKey && !process.env['ANTHROPIC_AUTH_TOKEN']) {
    throw new Error(
      'Nessuna credenziale per il modello: manca ANTHROPIC_API_KEY. ' +
        'I percorsi che lo usano sono opzionali e devono verificarlo con credenzialiPresenti().',
    );
  }
  const mod = (await import('@anthropic-ai/sdk')) as unknown as {
    default: new (opzioni: { apiKey?: string }) => ClienteModello;
  };
  const Costruttore = mod.default;
  return apiKey ? new Costruttore({ apiKey }) : new Costruttore({});
}

/**
 * Il client da cui passa ogni chiamata al modello.
 *
 * L'SDK viene importato alla prima chiamata e non alla costruzione: un modulo
 * che importa l'SDK per il solo fatto di essere caricato renderebbe impossibile
 * far girare il sito e i test senza averlo installato, e il modello qui è
 * opzionale in ogni percorso in cui compare.
 */
export function clienteModello(opzioni: OpzioniCliente): ClienteModello {
  let sotto: ClienteModello | null = opzioni.sottostante ?? null;
  const cartella = opzioni.cartella ?? CARTELLA_PREDEFINITA;
  const scrive = opzioni.registra ?? opzioni.sottostante === undefined;

  return {
    messages: {
      async create(parametri: Record<string, unknown>): Promise<RispostaModello> {
        sotto ??= await apriSdk(opzioni.apiKey);
        const risposta = await sotto.messages.create(parametri);
        if (scrive) annota(risposta, parametri, opzioni, cartella);
        return risposta;
      },
    },
  };
}

/**
 * Scrive la riga, e non fa mai fallire la chiamata.
 *
 * Un disco pieno o una cartella non scrivibile sono un problema della
 * contabilità, non dell'articolo che si stava scrivendo: far cadere qui una
 * chiamata già pagata la farebbe pagare due volte.
 */
function annota(
  risposta: RispostaModello,
  parametri: Record<string, unknown>,
  opzioni: OpzioniCliente,
  cartella: string,
): void {
  try {
    const uso = risposta.usage;
    registra(
      {
        // Il modello che ha risposto ha la precedenza su quello richiesto: con
        // un ripiego lato server sono due cose diverse, e il conto lo fa il
        // primo.
        modello: risposta.model ?? String(parametri['model'] ?? 'sconosciuto'),
        uso: opzioni.uso,
        tokenIngresso: uso?.input_tokens ?? 0,
        tokenUscita: uso?.output_tokens ?? 0,
        tokenCacheScrittura: uso?.cache_creation_input_tokens ?? 0,
        tokenCacheLettura: uso?.cache_read_input_tokens ?? 0,
        ...(opzioni.chi ? { chi: opzioni.chi } : {}),
        ...(opzioni.origine ? { origine: opzioni.origine } : {}),
      },
      cartella,
    );
  } catch {
    // Volutamente muto: vedi sopra.
  }
}
