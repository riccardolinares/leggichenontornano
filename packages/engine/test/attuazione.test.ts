import { describe, expect, it } from 'vitest';
import { CorpusView } from '../src/corpus-view.js';
import {
  ATTUAZIONE_MANCANTE,
  allMandates,
  mandateKey,
} from '../src/checks/level1/attuazione-mancante.js';
import { buildNationalCounter } from '../src/metrics.js';
import { act, CTX, OGGI } from './fixtures.js';

const LEGGE = 'urn:nir:stato:legge:2018-12-30;145';

/**
 * Una legge con due mandati nello stesso articolo, uno per comma.
 *
 * È il caso che conta: prima del cancello per mandato, una verifica che
 * trovava mancante **uno** dei due faceva pubblicare **entrambe** le
 * segnalazioni, e la seconda era falsa.
 */
function corpus(): CorpusView {
  const versionId = `${LEGGE}#0`;
  return new CorpusView({
    acts: [act({ urn: LEGGE, title: 'Legge di prova', inForceFrom: '2019-01-01' })],
    versions: [{ id: versionId, actUrn: LEGGE, inForceFrom: '2019-01-01', inForceTo: null }],
    articles: [
      {
        versionId,
        actUrn: LEGGE,
        number: '1',
        heading: null,
        text: 'Testo dell’articolo 1.',
        principal: true,
      },
    ],
    relations: [],
    consolidatedActs: [],
    provisions: [
      {
        id: 'p1',
        actUrn: LEGGE,
        articleNumber: '1',
        number: '1028',
        kind: 'comma',
        text: 'Con decreto del Presidente del Consiglio dei ministri sono determinati i criteri di riparto delle risorse entro sessanta giorni dalla data di entrata in vigore della presente legge.',
        inForceFrom: '2019-01-01',
        inForceTo: null,
      },
      {
        id: 'p2',
        actUrn: LEGGE,
        articleNumber: '1',
        number: '1029',
        kind: 'comma',
        text: 'Con decreto del Ministro della giustizia sono definite le modalità entro novanta giorni dalla data di entrata in vigore della presente legge.',
        inForceFrom: '2019-01-01',
        inForceTo: null,
      },
    ],
  });
}

describe('il cancello dell’attuazione mancante', () => {
  const mandati = allMandates(corpus());

  it('estrae un mandato per comma, e li distingue', () => {
    expect(mandati).toHaveLength(2);
    expect(mandati.map((m) => m.provisionNumber)).toEqual(['1028', '1029']);
    expect(mandateKey(mandati[0]!)).not.toBe(mandateKey(mandati[1]!));
  });

  it('non pubblica niente senza copertura', () => {
    const findings = ATTUAZIONE_MANCANTE.run(
      { view: corpus(), implementationCoverage: new Set(), implementations: new Map() },
      CTX,
    );
    expect(findings).toHaveLength(0);
  });

  it('pubblica il solo mandato verificato, non tutti quelli dell’atto', () => {
    const findings = ATTUAZIONE_MANCANTE.run(
      {
        view: corpus(),
        implementationCoverage: new Set([mandateKey(mandati[1]!)]),
        implementations: new Map(),
      },
      CTX,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.title).toContain('ministro della giustizia');
    expect(findings[0]!.evidence[0]?.quote).toContain('novanta giorni');
  });

  it('accetta ancora la copertura per atto, che è quella del gold standard', () => {
    const findings = ATTUAZIONE_MANCANTE.run(
      { view: corpus(), implementationCoverage: new Set([LEGGE]), implementations: new Map() },
      CTX,
    );
    expect(findings).toHaveLength(2);
  });
});

describe('il contatore nazionale', () => {
  const mandati = allMandates(corpus());

  it('somma i giorni di ritardo e conta gli atti', () => {
    const contatore = buildNationalCounter(mandati, OGGI);
    expect(contatore.mandates).toBe(2);
    expect(contatore.acts).toBe(1);
    expect(contatore.totalDaysLate).toBeGreaterThan(0);
  });

  it('senza copertura tiene il testo di prima, parola per parola', () => {
    const contatore = buildNationalCounter(mandati, OGGI);
    expect(contatore.verified).toBe(0);
    expect(contatore.adottatiInRitardo).toBe(0);
    expect(contatore.nonAdottati).toBe(0);
    expect(contatore.caveat).toContain('Misura termini scaduti, non attuazioni mancate');
    expect(contatore.caveat).toContain('se il decreto è poi arrivato con cinque anni di ritardo');
    expect(contatore.caveat).not.toContain('siamo andati a guardare');
  });

  it('con copertura dice quanti ha guardato e cosa ha trovato', () => {
    const contatore = buildNationalCounter(mandati, OGGI, {
      esiti: new Map([
        [mandateKey(mandati[0]!), 'adottato'],
        [mandateKey(mandati[1]!), 'non-adottato'],
      ]),
      inRitardo: new Set([mandateKey(mandati[0]!)]),
    });
    expect(contatore.verified).toBe(2);
    expect(contatore.adottatiInRitardo).toBe(1);
    expect(contatore.nonAdottati).toBe(1);
    expect(contatore.caveat).toContain('Su 2 di questi mandati siamo andati a guardare');
    expect(contatore.caveat).toContain('per 1 il decreto è arrivato dopo la scadenza');
    // L'etichetta non cambia mai: quello che si misura è sempre lo stesso.
    expect(contatore.label).toContain('Giorni trascorsi dalla scadenza dei termini');
  });

  it('non conta fra i verificati i mandati su cui non si è concluso niente', () => {
    const contatore = buildNationalCounter(mandati, OGGI, {
      esiti: new Map([[mandateKey(mandati[0]!), 'non-verificabile']]),
      inRitardo: new Set(),
    });
    expect(contatore.verified).toBe(0);
    expect(contatore.caveat).not.toContain('siamo andati a guardare');
  });
});
