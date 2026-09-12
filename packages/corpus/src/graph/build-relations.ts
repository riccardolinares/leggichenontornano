/**
 * Costruzione degli archi del grafo a partire da un atto analizzato.
 *
 * Il grafo è il prodotto: gli archi sono **tipizzati** (cosa fa una norma
 * all'altra) e **datati** (da quando lo fa). Un arco senza tipo o senza data non
 * serve a niente al motore delle anomalie, e per questo non viene creato.
 */
import { actUrn, type AknAct, parseModifications } from '@antinomia/akn-parser';
import { normalizeHref } from './href.js';

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
  origin: 'activeModifications' | 'passiveModifications' | 'ref';
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
      evidence: mod.evidence,
      confidence: mod.confidence,
      origin: 'activeModifications',
    });
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
        confidence: 'alta',
        origin: 'ref',
      });
    }
  }

  return out;
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
