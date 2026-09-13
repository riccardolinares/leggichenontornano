/**
 * Un corpus in miniatura, costruito a mano.
 *
 * I controlli sono funzioni pure sulla proiezione del corpus, e questo permette
 * di provarli su tre atti scritti qui invece che su un database. Il vantaggio
 * non è la velocità: è che quando un test fallisce si vede subito **perché**,
 * senza dover ricostruire mentalmente cosa contenesse il database.
 */
import { CorpusView, type ActView, type CorpusViewData, type RelationView } from '../src/corpus-view.js';

export function act(partial: Partial<ActView> & { urn: string }): ActView {
  return {
    title: 'Titolo di prova',
    actType: 'legge',
    sourceRank: 20,
    publicationDate: '2000-01-01',
    inForceFrom: '2000-01-16',
    abrogated: false,
    abrogatedFrom: null,
    abrogatedBy: null,
    ...partial,
  };
}

export function relation(partial: Partial<RelationView> & { id: string; type: string; sourceUrn: string; targetUrn: string }): RelationView {
  return {
    sourceArticle: null,
    targetArticle: null,
    targetParagraphs: [],
    wholeAct: false,
    effectiveFrom: '2010-01-01',
    evidence: 'prova',
    confidence: 'alta',
    origin: 'activeModifications',
    ...partial,
  };
}

export interface MiniAct {
  urn: string;
  overrides?: Partial<ActView>;
  /** Una voce per versione: data di inizio vigenza e numeri di articolo presenti. */
  versions: Array<{ from: string; to?: string | null; articles: string[] }>;
  consolidated?: boolean;
}

export function view(acts: MiniAct[], relations: RelationView[]): CorpusView {
  const data: CorpusViewData = {
    acts: [],
    versions: [],
    articles: [],
    relations,
    consolidatedActs: [],
  };
  for (const mini of acts) {
    data.acts.push(
      act({
        urn: mini.urn,
        inForceFrom: mini.versions[0]?.from ?? '2000-01-01',
        ...mini.overrides,
      }),
    );
    if (mini.consolidated) data.consolidatedActs!.push(mini.urn);
    mini.versions.forEach((v, i) => {
      const id = `${mini.urn}#${i}`;
      data.versions.push({
        id,
        actUrn: mini.urn,
        inForceFrom: v.from,
        inForceTo: v.to ?? null,
      });
      for (const number of v.articles) {
        data.articles.push({
          versionId: id,
          actUrn: mini.urn,
          number,
          heading: null,
          text: `Testo dell'articolo ${number}.`,
          principal: true,
        });
      }
    });
  }
  return new CorpusView(data);
}

export const OGGI = '2026-09-12';
export const CTX = { today: OGGI };
