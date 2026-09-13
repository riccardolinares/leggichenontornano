import { describe, expect, it } from 'vitest';
import { MODIFICA_AD_ATTO_ABROGATO } from '../src/checks/level1/modifica-ad-atto-abrogato.js';
import { RINVIO_AD_ARTICOLO_INESISTENTE } from '../src/checks/level1/rinvio-ad-articolo-inesistente.js';
import { RINVIO_AD_ATTO_ABROGATO } from '../src/checks/level1/rinvio-ad-atto-abrogato.js';
import { CTX, relation, view } from './fixtures.js';

const VECCHIA = 'urn:nir:stato:legge:1990-08-07;241';
const ABROGANTE = 'urn:nir:stato:legge:2010-01-01;1';
const TARDIVA = 'urn:nir:stato:legge:2015-06-01;90';

describe('modifica-ad-atto-abrogato', () => {
  const corpus = (modDate: string) =>
    view(
      [
        {
          urn: VECCHIA,
          versions: [{ from: '1990-08-22', articles: ['1', '2', '3'] }],
          overrides: {
            abrogated: true,
            abrogatedFrom: '2010-01-16',
            abrogatedBy: ABROGANTE,
            publicationDate: '1990-08-18',
          },
        },
        { urn: ABROGANTE, versions: [{ from: '2010-01-16', articles: ['1'] }] },
        { urn: TARDIVA, versions: [{ from: '2015-06-16', articles: ['1'] }] },
      ],
      [
        relation({
          id: 'r1',
          type: 'MODIFICA',
          sourceUrn: TARDIVA,
          sourceArticle: '1',
          targetUrn: VECCHIA,
          targetArticle: '3',
          targetParagraphs: ['2'],
          effectiveFrom: modDate,
          evidence: "ha disposto (con l'art. 1, comma 1) la modifica dell'art. 3, comma 2.",
        }),
      ],
    );

  it('segnala una modifica successiva all’abrogazione', () => {
    const findings = MODIFICA_AD_ATTO_ABROGATO.run(corpus('2015-06-16'), CTX);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.level).toBe(1);
    expect(f.severity).toBe('alta');
    expect(f.urns[0]).toBe(`${VECCHIA}~art3`);
    expect(f.title).toContain('art. 3, comma 2');
  });

  it('non segnala una modifica anteriore all’abrogazione', () => {
    expect(MODIFICA_AD_ATTO_ABROGATO.run(corpus('2005-01-01'), CTX)).toHaveLength(0);
  });

  it('mostra le due prove, con la loro provenienza', () => {
    const f = MODIFICA_AD_ATTO_ABROGATO.run(corpus('2015-06-16'), CTX)[0]!;
    expect(f.evidence).toHaveLength(2);
    expect(f.evidence[0]?.quote).toContain("la modifica dell'art. 3");
    expect(f.evidence.every((e) => e.kind === 'grafo')).toBe(true);
  });

  it('mostra sempre le righe di possibile risoluzione', () => {
    const f = MODIFICA_AD_ATTO_ABROGATO.run(corpus('2015-06-16'), CTX)[0]!;
    expect(f.resolutions.length).toBeGreaterThanOrEqual(3);
    expect(f.resolutions.map((r) => r.criterion)).toContain('specialita');
    expect(f.resolutions.map((r) => r.criterion)).toContain('posteriorita');
    expect(f.resolutions.map((r) => r.criterion)).toContain('gerarchia');
  });

  it('non segnala l’atto che abroga e contestualmente riordina', () => {
    const corpus2 = view(
      [
        {
          urn: VECCHIA,
          versions: [{ from: '1990-08-22', articles: ['1'] }],
          overrides: { abrogated: true, abrogatedFrom: '2010-01-16', abrogatedBy: ABROGANTE },
        },
        { urn: ABROGANTE, versions: [{ from: '2010-01-16', articles: ['1'] }] },
      ],
      [
        relation({
          id: 'r2',
          type: 'MODIFICA',
          sourceUrn: ABROGANTE,
          targetUrn: VECCHIA,
          targetArticle: '1',
          effectiveFrom: '2010-01-16',
        }),
      ],
    );
    expect(MODIFICA_AD_ATTO_ABROGATO.run(corpus2, CTX)).toHaveLength(0);
  });

  it('ignora le relazioni a bassa confidenza', () => {
    const corpus3 = view(
      [
        {
          urn: VECCHIA,
          versions: [{ from: '1990-08-22', articles: ['1'] }],
          overrides: { abrogated: true, abrogatedFrom: '2010-01-16', abrogatedBy: ABROGANTE },
        },
        { urn: ABROGANTE, versions: [{ from: '2010-01-16', articles: ['1'] }] },
        { urn: TARDIVA, versions: [{ from: '2015-06-16', articles: ['1'] }] },
      ],
      [
        relation({
          id: 'r3',
          type: 'MODIFICA',
          sourceUrn: TARDIVA,
          targetUrn: VECCHIA,
          targetArticle: '1',
          effectiveFrom: '2015-06-16',
          confidence: 'bassa',
        }),
      ],
    );
    expect(MODIFICA_AD_ATTO_ABROGATO.run(corpus3, CTX)).toHaveLength(0);
  });

  it('produce identificatori stabili', () => {
    const a = MODIFICA_AD_ATTO_ABROGATO.run(corpus('2015-06-16'), CTX).map((f) => f.id);
    const b = MODIFICA_AD_ATTO_ABROGATO.run(corpus('2015-06-16'), CTX).map((f) => f.id);
    expect(a).toEqual(b);
  });
});

describe('rinvio-ad-atto-abrogato', () => {
  const corpus = view(
    [
      {
        urn: VECCHIA,
        versions: [{ from: '1990-08-22', articles: ['1', '2'] }],
        overrides: { abrogated: true, abrogatedFrom: '2010-01-16', abrogatedBy: ABROGANTE },
      },
      { urn: ABROGANTE, versions: [{ from: '2010-01-16', articles: ['1'] }] },
      { urn: TARDIVA, versions: [{ from: '2005-01-01', articles: ['1'] }] },
    ],
    [
      relation({
        id: 'r4',
        type: 'RINVIA',
        sourceUrn: TARDIVA,
        targetUrn: VECCHIA,
        targetArticle: '2',
        effectiveFrom: '2005-01-01',
      }),
    ],
  );

  it('segnala una norma in vigore che rinvia a un atto poi abrogato', () => {
    const findings = RINVIO_AD_ATTO_ABROGATO.run(corpus, CTX);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.windowFrom).toBe('2010-01-16');
  });

  it('dichiara il limite sui rinvii recettizi', () => {
    const f = RINVIO_AD_ATTO_ABROGATO.run(corpus, CTX)[0]!;
    const nessuno = f.resolutions.find((r) => r.criterion === 'nessuno');
    expect(nessuno?.explanation).toContain('recettizio');
  });

  it('non segnala quando anche la norma che rinvia è abrogata', () => {
    const corpus2 = view(
      [
        {
          urn: VECCHIA,
          versions: [{ from: '1990-08-22', articles: ['1'] }],
          overrides: { abrogated: true, abrogatedFrom: '2010-01-16' },
        },
        {
          urn: TARDIVA,
          versions: [{ from: '2005-01-01', articles: ['1'] }],
          overrides: { abrogated: true, abrogatedFrom: '2012-01-01' },
        },
      ],
      [
        relation({
          id: 'r5',
          type: 'RINVIA',
          sourceUrn: TARDIVA,
          targetUrn: VECCHIA,
          targetArticle: '1',
          effectiveFrom: '2005-01-01',
        }),
      ],
    );
    expect(RINVIO_AD_ATTO_ABROGATO.run(corpus2, CTX)).toHaveLength(0);
  });
});

describe('rinvio-ad-articolo-inesistente', () => {
  it('tace quando abbiamo solo il testo originale del bersaglio', () => {
    // Il caso pericoloso: l'articolo potrebbe essere stato introdotto dopo, e
    // noi non lo sapremmo.
    const corpus = view(
      [
        { urn: VECCHIA, versions: [{ from: '1990-08-22', articles: ['1', '2'] }] },
        { urn: TARDIVA, versions: [{ from: '2015-06-16', articles: ['1'] }] },
      ],
      [
        relation({
          id: 'r6',
          type: 'RINVIA',
          sourceUrn: TARDIVA,
          targetUrn: VECCHIA,
          targetArticle: '9',
          effectiveFrom: '2015-06-16',
        }),
      ],
    );
    expect(RINVIO_AD_ARTICOLO_INESISTENTE.run(corpus, CTX)).toHaveLength(0);
  });

  it('segnala quando abbiamo il testo consolidato a quella data', () => {
    const corpus = view(
      [
        {
          urn: VECCHIA,
          consolidated: true,
          versions: [
            { from: '1990-08-22', to: '2012-12-31', articles: ['1', '2'] },
            { from: '2013-01-01', articles: ['1', '2', '3'] },
          ],
        },
        { urn: TARDIVA, versions: [{ from: '2015-06-16', articles: ['1'] }] },
      ],
      [
        relation({
          id: 'r7',
          type: 'RINVIA',
          sourceUrn: TARDIVA,
          targetUrn: VECCHIA,
          targetArticle: '9',
          effectiveFrom: '2015-06-16',
        }),
      ],
    );
    const findings = RINVIO_AD_ARTICOLO_INESISTENTE.run(corpus, CTX);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.plainLanguage).toContain("l'atto arriva all'art. 3");
  });

  it('non segnala un articolo che esiste', () => {
    const corpus = view(
      [
        {
          urn: VECCHIA,
          consolidated: true,
          versions: [{ from: '1990-08-22', to: '2030-01-01', articles: ['1', '2', '9'] }],
        },
        { urn: TARDIVA, versions: [{ from: '2015-06-16', articles: ['1'] }] },
      ],
      [
        relation({
          id: 'r8',
          type: 'RINVIA',
          sourceUrn: TARDIVA,
          targetUrn: VECCHIA,
          targetArticle: '9',
          effectiveFrom: '2015-06-16',
        }),
      ],
    );
    expect(RINVIO_AD_ARTICOLO_INESISTENTE.run(corpus, CTX)).toHaveLength(0);
  });

  it('non segnala quando l’atto bersaglio non è nel corpus', () => {
    const corpus = view(
      [{ urn: TARDIVA, versions: [{ from: '2015-06-16', articles: ['1'] }] }],
      [
        relation({
          id: 'r9',
          type: 'RINVIA',
          sourceUrn: TARDIVA,
          targetUrn: 'urn:nir:stato:legge:1900-01-01;1',
          targetArticle: '9',
          effectiveFrom: '2015-06-16',
        }),
      ],
    );
    expect(RINVIO_AD_ARTICOLO_INESISTENTE.run(corpus, CTX)).toHaveLength(0);
  });
});
