/**
 * Livello 4: il confronto lo fa un modello.
 *
 * Tutti gli altri controlli trovano quello che una query sa descrivere. È
 * moltissimo — un rinvio a una norma abrogata è un fatto che si legge nel grafo
 * — ma lascia fuori una categoria intera: **due disposizioni che non possono
 * essere rispettate insieme senza condividere una parola**. «Entro trenta
 * giorni dalla richiesta» e «previo parere vincolante del Consiglio, reso entro
 * novanta giorni» si escludono a vicenda e non hanno un solo token in comune.
 * Nessuna query le mette in relazione; una persona che le legge le vede subito.
 *
 * Qui il modello fa quel lavoro. E siccome è un giudizio, tutto il resto di
 * questo file serve a renderlo contestabile (ADR 0011):
 *
 *  1. **Le coppie da esaminare le sceglie il codice, non il modello.** La
 *     selezione è deterministica e ispezionabile: vigenze che si sovrappongono,
 *     atti diversi, stesso concetto o forte somiglianza lessicale. Il modello
 *     non decide cosa guardare, guarda quello che gli viene messo davanti.
 *  2. **Ogni conclusione poggia su due citazioni letterali**, una per norma, e
 *     il codice le ricontrolla: se una citazione non compare alla lettera nel
 *     testo da cui dice di venire, la segnalazione viene scartata prima di
 *     esistere. È lo stesso controllo che il blog fa sulla prosa, applicato a
 *     un'affermazione che pesa molto di più.
 *  3. **La confidenza è dichiarata e arriva fino alla pagina.** «Forse» e
 *     «certamente» non vanno nello stesso indice senza distinzione.
 *  4. **La precisione si misura a parte.** Il livello 4 ha la sua riga nella
 *     pagina Dati e il suo cancello di pubblicazione: non eredita la fiducia
 *     guadagnata dai livelli deterministici.
 */
import { clienteModello, type ClienteModello } from '@leggichenontornano/consumi';
import type { ActView } from '../../corpus-view.js';
import type { DeonticProposition } from '../../deontic/types.js';
import type { AnomalyFinding, CheckContext, CheckDefinition, EvidenceItem } from '../../types.js';
import { resolutionsFor } from '../../resolution.js';

const MODELLO_PREDEFINITO = 'claude-opus-5';

/**
 * Versione delle istruzioni. Cambiarla è un evento: le segnalazioni prodotte
 * con istruzioni diverse non sono confrontabili, e la precisione misurata va
 * ricalcolata.
 */
export const PROMPT_VERSIONE = '2026-09-13.1';

export const CONTRASTO_ASSISTITO_DEFINITION: CheckDefinition = {
  id: 'contrasto-assistito',
  level: 4,
  label: 'Disposizioni che non stanno insieme',
  description:
    'Due norme in vigore nello stesso periodo impongono richieste che non possono essere soddisfatte entrambe, anche quando non condividono le parole.',
  rule: [
    '-- Le coppie da esaminare le sceglie questa query. Il confronto lo fa un modello.',
    'SELECT a.*, b.*',
    'FROM Proposizione a JOIN Proposizione b',
    '  ON a.urn <> b.urn                       -- atti diversi',
    ' AND a.inForceFrom <= b.inForceTo         -- vigenze che si sovrappongono',
    ' AND b.inForceFrom <= a.inForceTo',
    ' AND (a.subjectConcept = b.subjectConcept -- stesso concetto del vocabolario',
    '      OR somiglianza(a, b) >= 0.45)       -- oppure forte somiglianza lessicale',
    '',
    '-- Per ogni coppia il modello risponde a una domanda sola: le due richieste',
    '-- possono essere soddisfatte entrambe? Deve citare alla lettera la porzione',
    '-- di ciascun testo su cui si basa, e il codice verifica che quelle citazioni',
    '-- siano davvero nei testi. Se non lo sono, la segnalazione non nasce.',
  ].join('\n'),
  expectedPrecision:
    'da misurare: il confronto è di un modello, e la precisione di questo livello si misura da sola, senza ereditare quella dei livelli deterministici',
  deterministic: false,
  assistito: true,
};

export interface CoppiaCandidata {
  a: DeonticProposition;
  b: DeonticProposition;
  /** Perché questa coppia è stata scelta, per il log e per la scheda. */
  motivo: string;
}

/** Parole troppo comuni per dire qualcosa sulla somiglianza fra due norme. */
const VUOTE = new Set([
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'un',
  'uno',
  'una',
  'di',
  'a',
  'da',
  'in',
  'con',
  'su',
  'per',
  'tra',
  'fra',
  'del',
  'dello',
  'della',
  'dei',
  'degli',
  'delle',
  'al',
  'allo',
  'alla',
  'ai',
  'agli',
  'alle',
  'dal',
  'dalla',
  'nel',
  'nella',
  'nei',
  'negli',
  'nelle',
  'sul',
  'sulla',
  'che',
  'non',
  'e',
  'o',
  'è',
  'ed',
  'od',
  'come',
  'anche',
  'entro',
  'deve',
  'devono',
  'puo',
  'può',
  'possono',
  'essere',
  'viene',
  'vengono',
  'sono',
  'comma',
  'articolo',
]);

function parole(testo: string): Set<string> {
  return new Set(
    testo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3 && !VUOTE.has(t)),
  );
}

/** Jaccard su soggetto e oggetto: grossolano, e per scegliere cosa guardare basta. */
export function somiglianza(a: DeonticProposition, b: DeonticProposition): number {
  const pa = parole(`${a.subject} ${a.object}`);
  const pb = parole(`${b.subject} ${b.object}`);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comuni = 0;
  for (const t of pa) if (pb.has(t)) comuni++;
  return comuni / (pa.size + pb.size - comuni);
}

function vigenzeSiSovrappongono(a: DeonticProposition, b: DeonticProposition): boolean {
  const aDa = a.inForceFrom ?? '0000-01-01';
  const aA = a.inForceTo ?? '9999-12-31';
  const bDa = b.inForceFrom ?? '0000-01-01';
  const bA = b.inForceTo ?? '9999-12-31';
  return aDa <= bA && bDa <= aA;
}

/**
 * Le coppie da mettere davanti al modello.
 *
 * Deterministica per costruzione: stesso input, stesse coppie, nello stesso
 * ordine. È la parte che rende riproducibile un controllo che al passo
 * successivo non lo è.
 */
export function coppieCandidate(
  proposizioni: readonly DeonticProposition[],
  opzioni: { soglia?: number; massimo?: number } = {},
): CoppiaCandidata[] {
  const soglia = opzioni.soglia ?? 0.45;
  const massimo = opzioni.massimo ?? 200;
  const coppie: Array<CoppiaCandidata & { punteggio: number }> = [];

  for (let i = 0; i < proposizioni.length; i++) {
    for (let j = i + 1; j < proposizioni.length; j++) {
      const a = proposizioni[i]!;
      const b = proposizioni[j]!;
      if (a.urn.split('~')[0] === b.urn.split('~')[0]) continue;
      if (!vigenzeSiSovrappongono(a, b)) continue;

      const stessoConcetto = a.subjectConcept !== null && a.subjectConcept === b.subjectConcept;
      const punteggio = somiglianza(a, b);
      if (!stessoConcetto && punteggio < soglia) continue;

      coppie.push({
        a,
        b,
        punteggio: stessoConcetto ? 1 + punteggio : punteggio,
        motivo: stessoConcetto
          ? `stesso concetto «${a.subjectConcept}», vigenze sovrapposte`
          : `somiglianza ${punteggio.toFixed(2)}, vigenze sovrapposte`,
      });
    }
  }

  return coppie
    .sort((x, y) => y.punteggio - x.punteggio || (x.a.urn < y.a.urn ? -1 : 1))
    .slice(0, massimo)
    .map(({ a, b, motivo }) => ({ a, b, motivo }));
}

const SYSTEM_PROMPT = `Sei un analista di testi normativi italiani.

Ricevi due disposizioni, entrambe in vigore nello stesso periodo, e rispondi a una domanda sola:

**un soggetto che deve rispettarle entrambe può farlo?**

Non ti viene chiesto se una delle due sia illegittima, opportuna o mal scritta, e non ti viene chiesto quale debba prevalere: solo se le due richieste possono stare insieme nei fatti.

Regole:

1. Rispondi \`contrasto: false\` ogni volta che un modo di rispettarle entrambe esiste, anche se scomodo. Due termini diversi per adempimenti diversi non sono un contrasto. Una norma speciale che deroga a una generale non è un contrasto. Una norma che si applica a soggetti diversi non è un contrasto.
2. Ogni conclusione deve poggiare su **citazioni letterali**: copia dai due testi le porzioni esatte da cui la ricavi, senza riscriverle. Un controllo automatico verifica che siano davvero nei testi, e scarta la segnalazione se non lo sono.
3. Dichiara la confidenza onestamente. \`bassa\` quando il contrasto dipende da come si interpreta un termine; \`alta\` solo quando le due richieste si escludono in modo che si legge nei testi.
4. Nel dubbio, \`contrasto: false\`. Una segnalazione sbagliata su una legge costa più di dieci contrasti non trovati.`;

const STRUMENTO = {
  name: 'registra_confronto',
  description: 'Registra l’esito del confronto fra due disposizioni.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['contrasto', 'confidenza', 'ragionamento', 'citazione_a', 'citazione_b'],
    properties: {
      contrasto: {
        type: 'boolean',
        description: 'true se un soggetto tenuto a entrambe non può rispettarle entrambe.',
      },
      confidenza: {
        type: 'string',
        enum: ['alta', 'media', 'bassa'],
        description:
          'Quanto il contrasto si legge nei testi invece di dipendere da un’interpretazione.',
      },
      ragionamento: {
        type: 'string',
        description:
          'Perché le due richieste non stanno insieme, in due o tre frasi, in italiano piano. Senza citare articoli che non sono nei due testi.',
      },
      citazione_a: {
        type: 'string',
        description: 'Porzione letterale della prima disposizione su cui si basa la conclusione.',
      },
      citazione_b: {
        type: 'string',
        description: 'Porzione letterale della seconda disposizione su cui si basa la conclusione.',
      },
    },
  },
  strict: true,
};

interface Grezzo {
  contrasto: boolean;
  confidenza: 'alta' | 'media' | 'bassa';
  ragionamento: string;
  citazione_a: string;
  citazione_b: string;
}

export type { ClienteModello };

/** Normalizzazione minima per confrontare una citazione con il testo da cui viene. */
function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .replace(/[«»"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La citazione è davvero in quel testo?
 *
 * È il controllo che tiene in piedi tutto il livello. Un modello che inventa
 * una citazione produce una segnalazione che sembra documentata e non lo è:
 * senza questa verifica il livello 4 sarebbe la parte meno affidabile del sito
 * travestita da quella più solida.
 */
export function citazioneVerificata(citazione: string, testo: string): boolean {
  const c = normalizza(citazione);
  if (c.length < 15) return false;
  return normalizza(testo).includes(c);
}

export interface OpzioniConfronto {
  /**
   * Il client con cui interrogare il modello.
   *
   * Facoltativo, e quando manca non si costruisce un client qualunque: si
   * chiede quello del registro dei consumi, che è l'unico che il progetto
   * sappia costruire. Ogni coppia esaminata qui è una chiamata pagata, e il
   * livello 4 è il più caro del motore — se non la contassimo, la voce più
   * grossa della pagina dei costi sarebbe proprio quella che manca.
   */
  cliente?: ClienteModello;
  modello?: string;
  acts: ReadonlyMap<string, ActView>;
  onProgress?: (messaggio: string) => void;
}

function attoDi(urn: string): string {
  return urn.split('~')[0] ?? urn;
}

/**
 * Esamina le coppie e produce le segnalazioni che hanno superato la verifica.
 *
 * Asincrono, a differenza di ogni altro controllo: qui ogni segnalazione costa
 * una chiamata a un servizio esterno. È anche il motivo per cui le coppie sono
 * limitate e ordinate per punteggio — si guarda prima quello che ha più
 * probabilità di essere qualcosa.
 */
export async function eseguiContrastoAssistito(
  coppie: readonly CoppiaCandidata[],
  opzioni: OpzioniConfronto,
  ctx: CheckContext,
): Promise<AnomalyFinding[]> {
  const modello = opzioni.modello ?? MODELLO_PREDEFINITO;
  const cliente = opzioni.cliente ?? clienteModello({ uso: 'analisi-assistita' });
  const log = opzioni.onProgress ?? (() => undefined);
  const trovate: AnomalyFinding[] = [];
  const limite = ctx.limit ?? coppie.length;

  for (const coppia of coppie) {
    if (trovate.length >= limite) break;

    const risposta = await cliente.messages.create({
      model: modello,
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      tools: [STRUMENTO],
      tool_choice: { type: 'tool', name: STRUMENTO.name },
      messages: [
        {
          role: 'user',
          content: [
            'Disposizione A',
            `Norma: ${coppia.a.urn}`,
            `Testo: ${coppia.a.quote}`,
            '',
            'Disposizione B',
            `Norma: ${coppia.b.urn}`,
            `Testo: ${coppia.b.quote}`,
          ].join('\n'),
        },
      ],
    });

    const chiamata = risposta.content.find(
      (b) => b.type === 'tool_use' && b.name === STRUMENTO.name,
    );
    if (!chiamata) {
      log(`coppia ${coppia.a.urn} / ${coppia.b.urn}: nessuna risposta strutturata, scartata`);
      continue;
    }

    const g = chiamata.input as Grezzo;
    if (!g.contrasto) continue;

    if (
      !citazioneVerificata(g.citazione_a, coppia.a.quote) ||
      !citazioneVerificata(g.citazione_b, coppia.b.quote)
    ) {
      log(`coppia ${coppia.a.urn} / ${coppia.b.urn}: citazione non trovata nei testi, scartata`);
      continue;
    }

    const urnA = attoDi(coppia.a.urn);
    const urnB = attoDi(coppia.b.urn);
    const attoA = opzioni.acts.get(urnA);
    const attoB = opzioni.acts.get(urnB);

    const citazioni: EvidenceItem[] = [
      {
        urn: coppia.a.urn,
        label: `${attoA?.title ?? urnA} — porzione su cui si basa la conclusione`,
        quote: g.citazione_a,
        kind: 'testo',
        inForceFrom: coppia.a.inForceFrom,
        inForceTo: coppia.a.inForceTo,
      },
      {
        urn: coppia.b.urn,
        label: `${attoB?.title ?? urnB} — porzione su cui si basa la conclusione`,
        quote: g.citazione_b,
        kind: 'testo',
        inForceFrom: coppia.b.inForceFrom,
        inForceTo: coppia.b.inForceTo,
      },
    ];

    const da =
      [coppia.a.inForceFrom, coppia.b.inForceFrom]
        .filter((d): d is string => !!d)
        .sort()
        .at(-1) ?? null;
    const a =
      [coppia.a.inForceTo, coppia.b.inForceTo]
        .filter((d): d is string => !!d)
        .sort()
        .at(0) ?? null;

    trovate.push({
      id: `contrasto-assistito.${impronta(`${coppia.a.urn}|${coppia.b.urn}`)}`,
      checkId: CONTRASTO_ASSISTITO_DEFINITION.id,
      level: 4,
      // Titolo e lingua comune restano da template, come su ogni altra scheda:
      // la prosa del modello ha un campo suo e non si mescola con il resto.
      title: `${attoA?.title ?? urnA} e ${attoB?.title ?? urnB} chiedono cose che non stanno insieme`,
      plainLanguage:
        `Due disposizioni in vigore nello stesso periodo — una in ${attoA?.title ?? urnA}, ` +
        `l’altra in ${attoB?.title ?? urnB} — impongono richieste che, secondo un confronto ` +
        `assistito da un modello linguistico, non possono essere soddisfatte entrambe. ` +
        `I due testi sono riportati qui sotto alla lettera: il confronto si può rifare a mano.`,
      urns: [coppia.a.urn, coppia.b.urn],
      windowFrom: da,
      windowTo: a,
      rule: CONTRASTO_ASSISTITO_DEFINITION.rule,
      evidence: citazioni,
      resolutions: resolutionsFor(attoA ?? null, attoB ?? null),
      severity: g.confidenza === 'alta' ? 'media' : 'bassa',
      assistita: {
        modello: `${modello}/${PROMPT_VERSIONE}`,
        confidenza: g.confidenza,
        ragionamento: g.ragionamento,
        citazioni,
      },
    });
  }

  return trovate;
}

/** Impronta stabile: due giri sullo stesso corpus producono lo stesso id. */
function impronta(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export { SYSTEM_PROMPT as CONTRASTO_SYSTEM_PROMPT, STRUMENTO as CONTRASTO_STRUMENTO };
