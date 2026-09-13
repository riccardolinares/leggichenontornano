import { describe, expect, it } from 'vitest';
import { FONTE_SECONDARIA_SU_PRIMARIA } from '../src/checks/level2/fonte-secondaria-su-primaria.js';
import { TERMINI_DIVERGENTI } from '../src/checks/level3/termini-divergenti.js';
import { VocabularyIndex } from '../src/deontic/vocabulary.js';
import type { DeonticProposition } from '../src/deontic/types.js';
import type { ActView } from '../src/corpus-view.js';
import { act, CTX, relation, view } from './fixtures.js';

const LEGGE = 'urn:nir:stato:legge:1990-08-07;241';
const REGOLAMENTO = 'urn:nir:stato:decreto.ministeriale:2015-03-02;40';

describe('fonte-secondaria-su-primaria', () => {
  const corpus = (extra = [] as ReturnType<typeof relation>[]) =>
    view(
      [
        { urn: LEGGE, versions: [{ from: '1990-08-22', articles: ['1'] }], overrides: { sourceRank: 20 } },
        {
          urn: REGOLAMENTO,
          versions: [{ from: '2015-03-20', articles: ['1'] }],
          overrides: { sourceRank: 40, actType: 'decreto_ministeriale' },
        },
      ],
      [
        relation({
          id: 's1',
          type: 'MODIFICA',
          sourceUrn: REGOLAMENTO,
          targetUrn: LEGGE,
          targetArticle: '1',
          effectiveFrom: '2015-03-20',
        }),
        ...extra,
      ],
    );

  it('segnala un decreto ministeriale che modifica una legge', () => {
    const findings = FONTE_SECONDARIA_SU_PRIMARIA.run(corpus(), CTX);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.level).toBe(2);
  });

  it('dichiara l’ipotesi della delegificazione invece di nasconderla', () => {
    const f = FONTE_SECONDARIA_SU_PRIMARIA.run(corpus(), CTX)[0]!;
    const nessuno = f.resolutions.find((r) => r.criterion === 'nessuno');
    expect(nessuno?.explanation).toContain('delegificazione');
    expect(nessuno?.explanation).toContain('400/1988');
  });

  it('non segnala quando il grafo conosce una legge di autorizzazione', () => {
    const autorizzato = corpus([
      relation({
        id: 's2',
        type: 'ATTUA',
        sourceUrn: REGOLAMENTO,
        targetUrn: LEGGE,
        effectiveFrom: '2015-03-20',
      }),
    ]);
    expect(FONTE_SECONDARIA_SU_PRIMARIA.run(autorizzato, CTX)).toHaveLength(0);
  });

  it('non segnala fra fonti di pari rango', () => {
    const pari = view(
      [
        { urn: LEGGE, versions: [{ from: '1990-08-22', articles: ['1'] }], overrides: { sourceRank: 20 } },
        {
          urn: 'urn:nir:stato:legge:2015-03-02;40',
          versions: [{ from: '2015-03-20', articles: ['1'] }],
          overrides: { sourceRank: 20 },
        },
      ],
      [
        relation({
          id: 's3',
          type: 'MODIFICA',
          sourceUrn: 'urn:nir:stato:legge:2015-03-02;40',
          targetUrn: LEGGE,
          targetArticle: '1',
        }),
      ],
    );
    expect(FONTE_SECONDARIA_SU_PRIMARIA.run(pari, CTX)).toHaveLength(0);
  });
});

const VOCABOLARIO = new VocabularyIndex({
  vertical: 'appalti',
  label: 'Appalti e contratti pubblici',
  concepts: [
    { id: 'operatore-economico', label: 'operatore economico', synonyms: ['impresa concorrente'] },
    {
      id: 'stazione-appaltante',
      label: 'stazione appaltante',
      synonyms: ['amministrazione aggiudicatrice'],
    },
    { id: 'appalto', label: 'appalto', synonyms: [] },
    { id: 'appalto-lavori', label: 'appalto di lavori', synonyms: [], broader: 'appalto' },
    { id: 'appalto-servizi', label: 'appalto di servizi', synonyms: [], broader: 'appalto' },
  ],
});

function proposition(partial: Partial<DeonticProposition> & { urn: string }): DeonticProposition {
  return {
    provisionId: `p-${partial.urn}`,
    mode: 'OBBLIGO',
    subject: 'la stazione appaltante',
    subjectConcept: 'stazione-appaltante',
    object: 'pubblicare l’avviso di aggiudicazione',
    deadlineDays: 30,
    deadlineText: 'entro trenta giorni',
    consequence: null,
    conditions: [],
    exceptions: [],
    scope: null,
    vertical: 'appalti',
    inForceFrom: '2016-04-19',
    inForceTo: null,
    extractor: 'regole/1.0',
    quote: 'La stazione appaltante deve pubblicare entro trenta giorni.',
    ...partial,
  };
}

const ACTS = new Map<string, ActView>([
  ['urn:nir:stato:legge:2016-01-01;1', act({ urn: 'urn:nir:stato:legge:2016-01-01;1' })],
  ['urn:nir:stato:legge:2018-01-01;2', act({ urn: 'urn:nir:stato:legge:2018-01-01;2' })],
]);

describe('termini-divergenti', () => {
  const a = proposition({ urn: 'urn:nir:stato:legge:2016-01-01;1~art3-com1', deadlineDays: 30 });
  const b = proposition({
    urn: 'urn:nir:stato:legge:2018-01-01;2~art5-com2',
    deadlineDays: 90,
    deadlineText: 'entro novanta giorni',
    quote: 'La stazione appaltante deve pubblicare entro novanta giorni.',
    inForceFrom: '2018-02-01',
  });

  it('trova la divergenza di termine con una query, non con un giudizio', () => {
    const findings = TERMINI_DIVERGENTI.run(
      { propositions: [a, b], vocabulary: VOCABOLARIO, acts: ACTS },
      CTX,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.level).toBe(3);
    expect(findings[0]?.title).toContain('30 giorni');
    expect(findings[0]?.title).toContain('90');
    expect(findings[0]?.windowFrom).toBe('2018-02-01');
  });

  it('applica il filtro temporale per primo', () => {
    // Stessa coppia, ma le vigenze non si intersecano: non è una contraddizione.
    const chiusa = { ...a, inForceTo: '2017-12-31' };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [chiusa, b], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(0);
  });

  it('non confronta proposizioni senza concetto del vocabolario', () => {
    const senzaConcetto = { ...a, subjectConcept: null };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [senzaConcetto, b], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(0);
  });

  it('non confronta modalità deontiche diverse', () => {
    const divieto = { ...b, mode: 'DIVIETO' as const };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [a, divieto], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(0);
  });

  it('non confronta fattispecie fratelle', () => {
    // «lavori» e «servizi» discendono entrambi da «appalto» e restano cose diverse.
    const lavori = { ...a, scope: 'appalto-lavori' };
    const servizi = { ...b, scope: 'appalto-servizi' };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [lavori, servizi], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(0);
  });

  it('confronta una fattispecie con la sua sovraordinata', () => {
    const lavori = { ...a, scope: 'appalto-lavori' };
    const generale = { ...b, scope: 'appalto' };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [lavori, generale], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(1);
  });

  it('ignora differenze sotto la soglia, che sono artefatti di conversione', () => {
    const trentuno = { ...b, deadlineDays: 31 };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [a, trentuno], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(0);
  });

  it('non confronta due commi dello stesso atto', () => {
    const stessoAtto = { ...b, urn: 'urn:nir:stato:legge:2016-01-01;1~art9-com1' };
    expect(
      TERMINI_DIVERGENTI.run(
        { propositions: [a, stessoAtto], vocabulary: VOCABOLARIO, acts: ACTS },
        CTX,
      ),
    ).toHaveLength(0);
  });

  it('avverte che i campi confrontati sono stati estratti automaticamente', () => {
    const f = TERMINI_DIVERGENTI.run(
      { propositions: [a, b], vocabulary: VOCABOLARIO, acts: ACTS },
      CTX,
    )[0]!;
    const nessuno = f.resolutions.find((r) => r.criterion === 'nessuno');
    expect(nessuno?.explanation).toContain('estratti automaticamente');
    expect(nessuno?.explanation).toContain('regole/1.0');
    // I due testi originali sono sempre presenti, sopra i campi estratti.
    expect(f.evidence).toHaveLength(2);
    expect(f.evidence.every((e) => e.kind === 'testo')).toBe(true);
  });
});
