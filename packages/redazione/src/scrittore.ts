/**
 * Chi scrive le parole.
 *
 * Il modello riceve **solo** la scheda dei fatti e ha un compito solo: dire in
 * italiano leggibile quello che la scheda contiene già. Non riceve la domanda
 * «queste norme si contraddicono?», non vede il corpus, non può cercare niente.
 * Quello che produce passa poi da `verifica.ts`, che lo rifiuta se contiene una
 * cifra, una citazione o un giudizio che la scheda non sostiene.
 *
 * La divisione dei ruoli è la stessa dell'estrattore deontico (ADR 0001), e per
 * la stessa ragione: se il modello sbaglia, deve sbagliare in un modo che si
 * possa misurare e intercettare, non in un modo che si debba subire.
 */
import {
  clienteModello,
  credenzialiPresenti,
  type ClienteModello,
} from '@leggichenontornano/consumi';
import type { Fatti } from './fatti.js';
import { fattiInTesto } from './fatti.js';
import type { Articolo, Sezione } from './articolo.js';
import { slugDa } from './articolo.js';

const MODELLO_PREDEFINITO = 'claude-opus-5';

/**
 * Versione delle istruzioni.
 *
 * Cambiarla è un evento: gli articoli scritti con istruzioni diverse non sono
 * confrontabili fra loro. Per questo finisce nel file di ogni articolo.
 */
export const PROMPT_VERSIONE = '2026-09-13.1';

const SYSTEM_PROMPT = `Sei il redattore di un progetto civico italiano che pubblica incongruenze della legislazione.

Ti viene data una **scheda di fatti** già accertati da interrogazioni deterministiche su un dataset. Il tuo compito è uno solo: scrivere un articolo che spieghi quei fatti a chi non è giurista, senza aggiungerne.

Regole assolute:

1. **Non aggiungere nulla che non sia nella scheda.** Nessuna data, nessun numero di articolo, nessuna cifra, nessun nome di norma che la scheda non contenga. Un controllo automatico rifiuta l'articolo se trova un numero che non c'è nella scheda, e l'articolo non viene pubblicato.
2. **Non dare verdetti.** Non scrivere che una norma è illegittima, incostituzionale, illegale, che «viola» qualcosa o che andrebbe abrogata. Il progetto riporta cosa risulta dai testi, non cosa dovrebbe essere. Evita anche «certamente», «senza dubbio», «sicuramente»: quello che sappiamo è nella scheda, il resto no.
3. **Le virgolette basse «» sono solo per le citazioni letterali** presenti nella scheda. Se vuoi citare, copia esattamente. Non virgolettare parafrasi.
4. **Non dare consigli legali.** Non dire a chi legge cosa fare.
5. Quando la scheda dice che una cosa non è verificata o non è misurata, dillo anche tu.

Come scrivere:

- Italiano piano, frasi corte, niente gergo. Chi legge può essere un giornalista, un funzionario o una persona qualunque arrivata da un link condiviso.
- La prima sezione spiega **cosa succede in pratica e a chi**: è la parte che deve funzionare anche se qualcuno legge solo quella.
- Le sezioni successive approfondiscono: come si è arrivati a questa situazione secondo quanto risulta dalla scheda, e cosa cambia per chi quella norma la deve applicare.
- Niente esclamativi, niente domande retoriche, niente «incredibile» o «assurdo». I fatti bastano: se sono grossi si vede.
- Non ripetere alla lettera la spiegazione in lingua comune già presente nella scheda: quella sta già sul sito, e l'articolo deve aggiungere lettura, non copiarla.`;

const STRUMENTO = {
  name: 'registra_articolo',
  description: "Registra l'articolo scritto a partire dalla scheda dei fatti.",
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['titolo', 'sommario', 'sezioni'],
    properties: {
      titolo: {
        type: 'string',
        description:
          'Titolo leggibile da chiunque, senza riferimenti normativi in sigla. Fra 40 e 90 caratteri.',
      },
      sommario: {
        type: 'string',
        description:
          "Due o tre frasi che reggano da sole fuori dalla pagina: è quello che comparirà nell'anteprima condivisa. Fra 150 e 320 caratteri.",
      },
      sezioni: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        description: 'Le sezioni dell’articolo, dalla più concreta alla più tecnica.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['titolo', 'paragrafi'],
          properties: {
            titolo: { type: 'string', description: 'Titolo della sezione, in minuscolo di frase.' },
            paragrafi: {
              type: 'array',
              minItems: 1,
              maxItems: 5,
              items: { type: 'string' },
              description: 'I paragrafi della sezione, testo semplice senza formattazione.',
            },
          },
        },
      },
    },
  },
  strict: true,
};

export interface OpzioniScrittore {
  modello?: string;
  apiKey?: string;
  /** Iniettabile nei test, per non toccare la rete. */
  cliente?: ClienteModello;
}

export type { ClienteModello };

interface Grezzo {
  titolo: string;
  sommario: string;
  sezioni: Sezione[];
}

export class Scrittore {
  private readonly modello: string;
  /**
   * Il client passa dal registro dei consumi, e non è una scelta di questo
   * file: è l'unico modo di parlare con il modello che il progetto abbia. La
   * riga che segue è tutto quello che serve perché ogni articolo scritto qui
   * finisca contato nella pagina dei costi.
   */
  private readonly cliente: ClienteModello;

  constructor(opts: OpzioniScrittore = {}) {
    this.modello = opts.modello ?? MODELLO_PREDEFINITO;
    this.cliente = clienteModello({
      uso: 'blog',
      ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
      ...(opts.cliente ? { sottostante: opts.cliente } : {}),
    });
  }

  static disponibile(): boolean {
    return credenzialiPresenti();
  }

  async scrivi(fatti: Fatti, giorno: string, nota?: string): Promise<Articolo> {
    const risposta = await this.cliente.messages.create({
      model: this.modello,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      tools: [STRUMENTO],
      tool_choice: { type: 'tool', name: STRUMENTO.name },
      messages: [
        {
          role: 'user',
          content: [
            'Scheda dei fatti:',
            '',
            fattiInTesto(fatti),
            ...(nota ? ['', `Correzione richiesta rispetto al tentativo precedente: ${nota}`] : []),
          ].join('\n'),
        },
      ],
    });

    const chiamata = risposta.content.find(
      (b) => b.type === 'tool_use' && b.name === STRUMENTO.name,
    );
    if (!chiamata) {
      throw new Error('Il modello non ha usato lo strumento: nessun articolo da pubblicare.');
    }

    const g = chiamata.input as Grezzo;
    return {
      slug: slugDa(giorno, g.titolo),
      data: giorno,
      anomaliaId: fatti.anomaliaId,
      titolo: g.titolo.trim(),
      sommario: g.sommario.trim(),
      sezioni: g.sezioni.map((s) => ({
        titolo: s.titolo.trim(),
        paragrafi: s.paragrafi.map((p) => p.trim()).filter((p) => p.length > 0),
      })),
      modello: this.modello,
      promptVersione: PROMPT_VERSIONE,
      generatoIl: new Date().toISOString(),
    };
  }
}

export { SYSTEM_PROMPT as REDAZIONE_SYSTEM_PROMPT, STRUMENTO as REDAZIONE_STRUMENTO };
