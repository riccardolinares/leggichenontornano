/**
 * L'estrazione deontica: dal testo dei commi alle proposizioni normalizzate.
 *
 * È il passo che attiva il layer semantico su un verticale. Gira **un dominio
 * alla volta**, perché senza il vocabolario controllato di quel dominio la
 * similarità testuale produce falsi positivi in massa (ADR 0005).
 *
 * Il modello, dove viene usato, vede **un comma per volta** e riempie campi.
 * Non vede mai due norme insieme e non gli viene mai chiesto un giudizio. La
 * contraddizione arriva dopo, come query su ciò che è stato estratto.
 */
import { getPrisma, type SnapshotVertical } from '@antinomia/corpus';
import { RuleBasedExtractor } from './deontic/rule-based.js';
import { LlmExtractor } from './deontic/llm.js';
import type { DeonticExtractor, DeonticProposition, Vocabulary } from './deontic/types.js';
import { espandiCorpus, loadVocabulary } from './deontic/vocabulary.js';

export interface OpzioniEstrazione {
  /** Percorso del vocabolario, es. `data/vocabolari/appalti.json`. */
  vocabolario: string;
  /** Estrattore da usare. Se omesso, il modello quando è configurato, le regole altrimenti. */
  extractor?: DeonticExtractor;
  /** Quanti commi processare al massimo. */
  limite?: number;
  /** Solo i commi di questi atti. Restringe ulteriormente il corpus del verticale. */
  urn?: readonly string[];
  /** Se `false`, non scrive nel database. */
  persist?: boolean;
  onProgress?: (message: string) => void;
}

export interface ReportEstrazione {
  verticale: string;
  estrattore: string;
  commiEsaminati: number;
  proposizioni: number;
  /** Proposizioni ricondotte a un concetto del vocabolario: sono le uniche confrontabili. */
  conConcetto: number;
  /** Atti del corpus del verticale, radici comprese. */
  attiCorpus: number;
  /** Radici dichiarate che il corpus scaricato non contiene. */
  radiciAssenti: string[];
  /**
   * Il verticale come è finito nel dataset.
   *
   * La copertura del livello 3 è un limite del prodotto, e i limiti del prodotto
   * si pubblicano: qui ci sono gli URN esatti su cui il confronto ha lavorato.
   */
  verticale_pubblicato: SnapshotVertical;
  durataMs: number;
}

/**
 * Sceglie l'estrattore.
 *
 * Il modello si usa **solo** se configurato. Senza credenziali il motore usa
 * l'estrattore a regole e funziona lo stesso, con recall più basso e dichiarato:
 * chi clona il repository ottiene un sistema che gira, non una schermata di
 * configurazione.
 */
export function scegliEstrattore(): DeonticExtractor {
  return LlmExtractor.isAvailable() ? new LlmExtractor() : new RuleBasedExtractor();
}

export async function estraiVerticale(opts: OpzioniEstrazione): Promise<ReportEstrazione> {
  const prisma = getPrisma();
  const iniziato = Date.now();
  const log = opts.onProgress ?? (() => undefined);
  const vocabulary: Vocabulary = loadVocabulary(opts.vocabolario);
  const extractor = opts.extractor ?? scegliEstrattore();
  log(`verticale «${vocabulary.label}», estrattore ${extractor.name}`);

  // Il confine del verticale sta negli atti, non nelle parole (ADR 0009).
  // Si risolve prima di leggere un solo comma: estrarre proposizioni da atti
  // fuori dominio costerebbe e produrrebbe confronti fra materie diverse.
  const [relazioni, attiNoti] = await Promise.all([
    prisma.relation.findMany({
      where: { knownTo: null, type: { in: vocabulary.corpus.espansione as never[] } },
      select: { type: true, sourceUrn: true, targetUrn: true },
    }),
    prisma.act.findMany({ select: { urn: true } }),
  ]);
  const corpus = espandiCorpus(
    vocabulary,
    relazioni.map((r) => ({
      type: r.type as string,
      sourceUrn: r.sourceUrn,
      targetUrn: r.targetUrn,
    })),
    new Set(attiNoti.map((a) => a.urn)),
  );
  log(
    `corpus del verticale: ${corpus.atti.size} atti ` +
      `(${vocabulary.corpus.radici.length - corpus.radiciAssenti.length} radici presenti, ` +
      `${corpus.aggiuntiDalGrafo} dal grafo)`,
  );
  for (const assente of corpus.radiciAssenti) {
    log(`  radice dichiarata ma assente dal corpus scaricato: ${assente}`);
  }
  if (corpus.atti.size === 0) {
    throw new Error(
      `nessuna radice del verticale «${vocabulary.vertical}» è presente nel corpus: scarica gli atti prima di estrarre`,
    );
  }

  const urnAmmessi = opts.urn
    ? [...corpus.atti].filter((u) => opts.urn!.includes(u))
    : [...corpus.atti];

  const commi = await prisma.provision.findMany({
    where: {
      kind: 'paragraph',
      article: { version: { actUrn: { in: urnAmmessi } } },
    },
    select: {
      id: true,
      text: true,
      number: true,
      article: {
        select: {
          number: true,
          version: { select: { actUrn: true, inForceFrom: true, inForceTo: true } },
        },
      },
    },
    ...(opts.limite ? { take: opts.limite } : {}),
  });
  log(`${commi.length} commi da esaminare`);

  const tutte: DeonticProposition[] = [];
  let esaminati = 0;
  for (const comma of commi) {
    esaminati++;
    // Un comma che non nomina alcun concetto del verticale non appartiene al
    // dominio: interrogare un modello su di esso costa e non serve.
    const estratte = await extractor.extract({
      urn: urnComma(comma),
      provisionId: comma.id,
      text: comma.text,
      vertical: vocabulary.vertical,
      inForceFrom: comma.article.version.inForceFrom,
      inForceTo: comma.article.version.inForceTo,
      vocabulary,
    });
    tutte.push(...estratte);
    if (esaminati % 2000 === 0) log(`${esaminati}/${commi.length}, ${tutte.length} proposizioni`);
  }

  const conConcetto = tutte.filter((p) => p.subjectConcept !== null).length;

  if (opts.persist !== false && tutte.length > 0) {
    // Si sostituisce l'estrazione precedente dello stesso verticale: due
    // estrazioni con prompt diversi non sono confrontabili, e tenerle insieme
    // produrrebbe confronti fra campi prodotti da regole diverse.
    await prisma.proposition.deleteMany({ where: { vertical: vocabulary.vertical } });
    await prisma.proposition.createMany({
      data: tutte.map((p, i) => ({
        id: `prop_${p.provisionId}_${i}`,
        provisionId: p.provisionId,
        urn: p.urn,
        mode: p.mode,
        subject: p.subject,
        subjectConcept: p.subjectConcept,
        object: p.object,
        deadlineDays: p.deadlineDays,
        deadlineText: p.deadlineText,
        consequence: p.consequence,
        conditions: p.conditions,
        exceptions: p.exceptions,
        scope: p.scope,
        vertical: p.vertical,
        inForceFrom: p.inForceFrom,
        inForceTo: p.inForceTo,
        extractor: p.extractor,
      })),
      skipDuplicates: true,
    });
    log(`${tutte.length} proposizioni scritte`);
  }

  return {
    verticale: vocabulary.vertical,
    estrattore: extractor.name,
    commiEsaminati: esaminati,
    proposizioni: tutte.length,
    conConcetto,
    attiCorpus: corpus.atti.size,
    radiciAssenti: corpus.radiciAssenti,
    verticale_pubblicato: {
      vertical: vocabulary.vertical,
      label: vocabulary.label,
      roots: [...vocabulary.corpus.radici],
      missingRoots: corpus.radiciAssenti,
      acts: [...corpus.atti].sort(),
      expansion: [...vocabulary.corpus.espansione],
      concepts: vocabulary.concepts.length,
      propositions: tutte.length,
      propositionsWithConcept: conConcetto,
      extractor: extractor.name,
      computedAt: new Date().toISOString().slice(0, 10),
    },
    durataMs: Date.now() - iniziato,
  };
}

/** Rilegge dal database le proposizioni di un verticale. */
export async function caricaProposizioni(verticale: string): Promise<DeonticProposition[]> {
  const prisma = getPrisma();
  const righe = await prisma.proposition.findMany({ where: { vertical: verticale } });
  return righe.map((r) => ({
    urn: r.urn,
    provisionId: r.provisionId,
    mode: r.mode,
    subject: r.subject,
    subjectConcept: r.subjectConcept,
    object: r.object,
    deadlineDays: r.deadlineDays,
    deadlineText: r.deadlineText,
    consequence: r.consequence,
    conditions: r.conditions,
    exceptions: r.exceptions,
    scope: r.scope,
    vertical: r.vertical,
    inForceFrom: r.inForceFrom,
    inForceTo: r.inForceTo,
    extractor: r.extractor,
    quote: r.subject,
  }));
}

function urnComma(comma: {
  number: string | null;
  article: { number: string | null; version: { actUrn: string } };
}): string {
  const base = comma.article.version.actUrn;
  const art = comma.article.number ? `~art${comma.article.number}` : '';
  const com = comma.number && art ? `-com${comma.number}` : '';
  return `${base}${art}${com}`;
}
