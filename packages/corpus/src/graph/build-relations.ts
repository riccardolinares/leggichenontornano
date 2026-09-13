/**
 * Costruzione degli archi del grafo a partire da un atto analizzato.
 *
 * Il grafo è il prodotto: gli archi sono **tipizzati** (cosa fa una norma
 * all'altra) e **datati** (da quando lo fa). Un arco senza tipo o senza data non
 * serve a niente al motore delle anomalie, e per questo non viene creato.
 */
import { actUrn, citationAgreesWith, type AknAct, parseModifications } from '@antinomia/akn-parser';
import { normalizeHref } from './href.js';
import { relazioniDaPreambolo } from './preambolo.js';

export type RelationType =
  | 'MODIFICA'
  | 'ABROGA'
  | 'SOSTITUISCE'
  | 'INTRODUCE'
  | 'PROROGA'
  | 'RINVIA'
  | 'ATTUA'
  | 'DEROGA'
  | 'DICHIARA_ILLEGITTIMO'
  | 'CONVERTE';

export interface RelationRecord {
  id: string;
  type: RelationType;
  sourceUrn: string;
  sourceArticle: string | null;
  sourceParagraph: string | null;
  targetUrn: string;
  targetArticle: string | null;
  targetParagraphs: string[];
  targetLetters: string[];
  targetAnnex: string | null;
  wholeAct: boolean;
  effectiveFrom: string | null;
  evidence: string | null;
  confidence: 'alta' | 'bassa';
  origin: 'activeModifications' | 'passiveModifications' | 'ref' | 'nota' | 'preambolo';
}

const ACTION_TO_TYPE: Record<string, RelationType> = {
  abrogazione: 'ABROGA',
  modifica: 'MODIFICA',
  sostituzione: 'SOSTITUISCE',
  introduzione: 'INTRODUCE',
  proroga: 'PROROGA',
};

export interface BuildRelationsOptions {
  /**
   * Se `true`, genera anche gli archi `RINVIA` dai `<ref>`. Sono molti (nell'ordine
   * di 500 per atto) e servono solo ad alcuni controlli: si possono disattivare
   * per un giro di prova.
   */
  includeReferences?: boolean;
  /** Data di efficacia da attribuire agli archi; predefinito: entrata in vigore dell'atto. */
  effectiveFrom?: string | null;
}

export function buildRelations(act: AknAct, opts: BuildRelationsOptions = {}): RelationRecord[] {
  const sourceUrn = actUrn(act.urn);
  const effectiveFrom = opts.effectiveFrom ?? act.expressionDate ?? act.publication?.date ?? null;
  const out: RelationRecord[] = [];
  const seen = new Set<string>();

  const push = (rel: Omit<RelationRecord, 'id'>): void => {
    const id = relationId(rel);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, ...rel });
  };

  for (const mod of parseModifications(act.activeModifications)) {
    const type = ACTION_TO_TYPE[mod.action];
    if (!type) continue; // `altro`: non sappiamo cosa sia, non lo mettiamo nel grafo.
    const target = mod.destination ? normalizeHref(mod.destination) : null;
    if (!target || target.kind !== 'nir' || !target.urn) continue;
    const source = mod.source ? normalizeHref(mod.source) : null;

    // La narrativa nomina l'atto colpito? Se lo nomina e non è quello a cui
    // punta l'ancoraggio, uno dei due sbaglia e noi non sappiamo quale: l'arco
    // nasce a bassa confidenza. Un solo arco di questo tipo, nel corpus reale,
    // marcava come abrogato il codice del processo amministrativo.
    const agrees = citationAgreesWith(mod.evidence, target.urn);
    const confidence = agrees === false ? 'bassa' : mod.confidence;

    push({
      type,
      sourceUrn,
      sourceArticle: mod.by.article ?? source?.article ?? null,
      sourceParagraph: mod.by.paragraphs[0] ?? null,
      targetUrn: target.urn,
      targetArticle: mod.target.wholeAct ? null : (mod.target.article ?? target.article),
      targetParagraphs: mod.target.paragraphs,
      targetLetters: mod.target.letters,
      targetAnnex: mod.target.annex ?? target.annex,
      wholeAct: mod.target.wholeAct,
      effectiveFrom,
      evidence:
        agrees === false
          ? `${mod.evidence} [la narrativa nomina un atto diverso da quello a cui punta il riferimento: arco declassato]`
          : mod.evidence,
      confidence,
      origin: 'activeModifications',
    });
  }

  // I presupposti dichiarati nel preambolo. Sono la prova che un regolamento di
  // delegificazione è autorizzato, e senza di loro il controllo di livello 2
  // segnalerebbe come anomalia ogni atto che rispetta la procedura.
  for (const rel of relazioniDaPreambolo(act, { effectiveFrom })) {
    push({ ...rel });
  }

  if (opts.includeReferences !== false) {
    for (const ref of act.references) {
      const target = normalizeHref(ref.href);
      if (target.kind !== 'nir' || !target.urn) continue;
      // Un atto che rinvia a se stesso non è un arco: è navigazione interna.
      if (target.urn === sourceUrn) continue;
      push({
        type: 'RINVIA',
        sourceUrn,
        sourceArticle: null,
        sourceParagraph: null,
        targetUrn: target.urn,
        targetArticle: target.article,
        targetParagraphs: target.paragraph ? [target.paragraph] : [],
        targetLetters: [],
        targetAnnex: target.annex,
        wholeAct: target.article === null,
        effectiveFrom,
        evidence: ref.text.slice(0, 400) || null,
        // Un rinvio dentro una nota redazionale resta nel grafo per la
        // navigazione, ma non è un rinvio normativo e non deve mai far scattare
        // un controllo di livello 1.
        confidence: ref.inNote
          ? 'bassa'
          : referenceConfidence(ref.text, target.article !== null),
        origin: ref.inNote ? 'nota' : 'ref',
      });
    }
  }

  return out;
}

/**
 * Quanto ci si può fidare dell'ancoraggio di un `<ref>`.
 *
 * Scoperto sul corpus reale, e vale la pena raccontarlo perché è il tipo di
 * errore che il progetto esiste per non commettere. La l. cost. 22 novembre
 * 1967, n. 2 all'art. 7 abroga «l'articolo 3, primo comma, della legge
 * costituzionale 9 febbraio 1948, n. 1; gli articoli 3, 4, 10 della legge
 * costituzionale 11 marzo 1953, n. 1». Negli open data i tre `<ref>` di
 * «3, 4, 10» sono ancorati **all'atto sbagliato**, quello nominato prima. Preso
 * per buono, quell'arco produce la segnalazione «la l. cost. 2/1967 rinvia
 * all'art. 10 della l. cost. 1/1948, che non esiste»: sembra un errore del
 * legislatore, è un errore di marcatura della fonte, e pubblicarlo sarebbe stato
 * un autogol perfetto.
 *
 * La regola, deterministica: quando il testo visibile del rinvio è un numero
 * nudo — cioè non nomina l'atto a cui dice di puntare — l'ancoraggio proviene
 * dall'editor e non dal testo, e l'arco nasce a **bassa confidenza**. Resta nel
 * grafo per la navigazione; i controlli di livello 1, che usano solo l'alta
 * confidenza, lo ignorano.
 */
export function referenceConfidence(text: string, hasArticleTarget = false): 'alta' | 'bassa' {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'bassa';

  // **L'ancoraggio a livello di articolo non regge.** Due casi presi dal corpus
  // reale, entrambi diventati segnalazioni false prima di essere fermati qui:
  //
  //  - la l. cost. 2/1967 abroga «gli articoli 3, 4, 10 della legge
  //    costituzionale 11 marzo 1953, n. 1»; i tre `<ref>` sono ancorati alla
  //    l. cost. 1/1948, nominata poco prima nella stessa frase;
  //  - la l. 89/2014 contiene «di cui alla legge 13 agosto 2010, n. 136 Art. 19,
  //    comma 1, lettera a), del D.Lgs. 163/2006»; il `<ref>` porta l'atto giusto
  //    ma il frammento `art_19` appartiene al d.lgs. 163/2006, nominato dopo.
  //
  // In entrambi l'atto è corretto e l'articolo no. Un rinvio con bersaglio di
  // articolo nasce quindi a bassa confidenza: resta nel grafo per la
  // navigazione, ma non può sostenere da solo un'affermazione di livello 1.
  if (hasArticleTarget) return 'bassa';

  // Un rinvio che nomina la propria fonte è autoportante.
  if (/\b(legge|decreto|codice|costituzione|regolamento|testo unico|direttiva|regio)\b/i.test(trimmed)) {
    return 'alta';
  }
  // Un numero nudo, o un'enumerazione di numeri nudi, dipende dall'ancoraggio.
  if (/^[\d\s,.;e]+$/i.test(trimmed)) return 'bassa';
  if (/^(art|articolo|comma|commi|lettera|lettere)[\s.]/i.test(trimmed)) return 'bassa';
  return 'alta';
}

/**
 * Identificatore stabile di un arco: due esecuzioni della pipeline sullo stesso
 * corpus devono produrre gli stessi id, altrimenti ogni giro sembra aver
 * cambiato tutto il grafo e il diff della PR automatica diventa illeggibile.
 */
export function relationId(rel: Omit<RelationRecord, 'id'>): string {
  return [
    rel.type,
    rel.sourceUrn,
    rel.sourceArticle ?? '',
    rel.sourceParagraph ?? '',
    rel.targetUrn,
    rel.targetArticle ?? '',
    rel.targetParagraphs.join('.'),
    rel.targetLetters.join('.'),
    rel.targetAnnex ?? '',
    rel.wholeAct ? 'W' : '',
    rel.origin,
  ].join('|');
}
