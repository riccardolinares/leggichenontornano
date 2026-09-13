/**
 * Estrattore deontico basato su un modello linguistico.
 *
 * **Questo è l'unico punto del progetto in cui un modello viene interrogato, e
 * fa una cosa sola: riempire campi.** Non riceve mai due norme insieme, non
 * riceve mai la domanda «queste due si contraddicono?», e la sua risposta è
 * vincolata da uno schema che non ha un campo libero in cui un giudizio possa
 * entrare (ADR 0001).
 *
 * Il contraddittorio, dopo, è una query SQL su ciò che il modello ha estratto.
 * Se il modello sbaglia, sbaglia su un campo — «il termine è 30 giorni» quando
 * erano 60 — e quell'errore si misura a campione, si attribuisce e si corregge.
 * Un verdetto sbagliato, invece, non si misura: si subisce.
 *
 * L'estrattore è **opzionale**. Senza `ANTHROPIC_API_KEY` il motore usa
 * `RuleBasedExtractor` e funziona lo stesso, con recall più basso e dichiarato.
 */
import {
  clienteModello,
  credenzialiPresenti,
  type ClienteModello,
} from '@leggichenontornano/consumi';
import type {
  DeonticExtractor,
  DeonticMode,
  DeonticProposition,
  ExtractionInput,
} from './types.js';
import { VocabularyIndex } from './vocabulary.js';

/** Modello predefinito. Registrato su ogni proposizione, per la riproducibilità. */
const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Versione del prompt. Cambiarla è un evento: le proposizioni estratte con
 * prompt diversi non sono confrontabili, e la metrica di precisione va
 * ricalcolata. Per questo la versione finisce nel campo `extractor` di ogni
 * riga estratta.
 */
const PROMPT_VERSION = '2026-09-12.1';

const SYSTEM_PROMPT = `Sei un estrattore di struttura da testo normativo italiano.

Il tuo unico compito è compilare i campi dello schema a partire dal comma che ti viene dato.

Non devi:
- dire se la norma è legittima, opportuna, chiara o in contrasto con altre norme;
- confrontare la norma con altre norme: non ne vedrai mai due insieme;
- riassumere, parafrasare o interpretare al di là di quanto serve a compilare i campi;
- inventare un termine, una sanzione o una condizione che il testo non contiene.

Se un campo non è ricavabile dal testo, lascialo nullo. Un campo nullo è un dato corretto; un campo inventato è un errore che si propaga fino a una segnalazione pubblica su una legge.

Estrai una proposizione per ciascuna modalità deontica distinta presente nel comma. Un comma che impone un obbligo e prevede una sanzione produce una proposizione, non due. Un comma che impone un obbligo a un soggetto e un divieto a un altro ne produce due.

Cita sempre in \`quote\` la porzione letterale di testo da cui hai ricavato la proposizione, senza riscriverla.`;

const EXTRACTION_TOOL = {
  name: 'registra_proposizioni',
  description:
    'Registra le proposizioni deontiche estratte dal comma. Una chiamata per comma, con zero o più proposizioni.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['proposizioni'],
    properties: {
      proposizioni: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['modalita', 'soggetto', 'oggetto', 'citazione'],
          properties: {
            modalita: {
              type: 'string',
              enum: ['OBBLIGO', 'DIVIETO', 'PERMESSO', 'POTERE', 'ONERE'],
              description: 'La modalità deontica espressa dal comma.',
            },
            soggetto: {
              type: 'string',
              description:
                'Chi è tenuto, in quali circostanze: la fattispecie soggettiva, con le parole del testo.',
            },
            oggetto: {
              type: 'string',
              description: 'La condotta richiesta, vietata o consentita.',
            },
            termine_giorni: {
              type: ['integer', 'null'],
              description:
                "Il termine espresso in giorni, se il comma ne pone uno. Null se non c'è.",
            },
            termine_testo: {
              type: ['string', 'null'],
              description: 'Il termine così come scritto nel testo.',
            },
            conseguenza: {
              type: ['string', 'null'],
              description: 'La sanzione o conseguenza prevista, se il comma la prevede.',
            },
            condizioni: {
              type: 'array',
              items: { type: 'string' },
              description: 'Le condizioni a cui la proposizione è subordinata.',
            },
            eccezioni: {
              type: 'array',
              items: { type: 'string' },
              description: 'Le eccezioni espressamente previste.',
            },
            ambito: {
              type: ['string', 'null'],
              description: "L'ambito di applicazione, se delimitato dal comma.",
            },
            citazione: {
              type: 'string',
              description:
                'La porzione letterale del comma da cui la proposizione è stata ricavata.',
            },
          },
        },
      },
    },
  },
  strict: true,
};

interface RawProposition {
  modalita: DeonticMode;
  soggetto: string;
  oggetto: string;
  termine_giorni?: number | null;
  termine_testo?: string | null;
  conseguenza?: string | null;
  condizioni?: string[];
  eccezioni?: string[];
  ambito?: string | null;
  citazione: string;
}

export interface LlmExtractorOptions {
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  /** Iniettabile nei test, per non toccare la rete. */
  client?: AnthropicLike;
}

/**
 * La parte di SDK che usiamo.
 *
 * Il tipo vive in `@leggichenontornano/consumi` insieme al client che lo
 * costruisce: è lì che il progetto decide come si parla con un modello, e
 * ridichiararlo qui significherebbe che due file possono divergere su cosa sia
 * una risposta. Il nome storico resta, perché è quello esportato dal pacchetto
 * e usato dai test.
 */
export type AnthropicLike = ClienteModello;

export class LlmExtractor implements DeonticExtractor {
  readonly name: string;
  private readonly model: string;
  private readonly maxTokens: number;
  /**
   * Il client passa dal registro dei consumi: ogni comma estratto costa, e
   * finché non si contava non si sapeva quanto. Una riga, e la misura c'è.
   */
  private readonly client: AnthropicLike;

  constructor(opts: LlmExtractorOptions = {}) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.client = clienteModello({
      uso: 'estrazione-deontica',
      ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
      ...(opts.client ? { sottostante: opts.client } : {}),
    });
    this.name = `${this.model}/${PROMPT_VERSION}`;
  }

  /** `true` quando l'estrattore è utilizzabile: senza credenziali si usa quello a regole. */
  static isAvailable(): boolean {
    return credenzialiPresenti();
  }

  async extract(input: ExtractionInput): Promise<DeonticProposition[]> {
    const index = new VocabularyIndex(input.vocabulary);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      messages: [
        {
          role: 'user',
          content: [
            `Verticale attivo: ${input.vocabulary.label}.`,
            `Norma: ${input.urn}`,
            '',
            'Testo del comma:',
            input.text,
          ].join('\n'),
        },
      ],
    });

    // Una risposta senza chiamata allo strumento non è un'estrazione vuota: è
    // un'estrazione mancata. Restituire zero proposizioni è corretto solo se il
    // modello ha usato lo strumento e ha messo dentro una lista vuota.
    const call = response.content.find(
      (block) => block.type === 'tool_use' && block.name === EXTRACTION_TOOL.name,
    );
    if (!call) return [];

    const payload = call.input as { proposizioni?: RawProposition[] } | undefined;
    const raw = payload?.proposizioni ?? [];

    return raw.map((p) => {
      const concept = index.resolve(p.soggetto) ?? index.resolve(p.citazione);
      return {
        urn: input.urn,
        provisionId: input.provisionId,
        mode: p.modalita,
        subject: p.soggetto,
        subjectConcept: concept?.id ?? null,
        object: p.oggetto,
        deadlineDays: p.termine_giorni ?? null,
        deadlineText: p.termine_testo ?? null,
        consequence: p.conseguenza ?? null,
        conditions: p.condizioni ?? [],
        exceptions: p.eccezioni ?? [],
        scope: p.ambito ? (index.resolve(p.ambito)?.id ?? null) : null,
        vertical: input.vertical,
        inForceFrom: input.inForceFrom,
        inForceTo: input.inForceTo,
        extractor: this.name,
        quote: p.citazione,
      } satisfies DeonticProposition;
    });
  }
}

export { SYSTEM_PROMPT as LLM_SYSTEM_PROMPT, EXTRACTION_TOOL as LLM_EXTRACTION_TOOL };
