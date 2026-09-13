import { SnapshotReader, type SnapshotData } from '@antinomia/corpus';
import { describe, expect, it } from 'vitest';
import {
  AVVERTENZA,
  cercaNorme,
  elencaSegnalazioni,
  leggiNorma,
  leggiSegnalazione,
  statoDelProgetto,
} from '../src/strumenti.js';
import { NOMI_ESEMPI } from '../src/esempi.js';
import { STRUMENTI } from '../src/server.js';

const URN = 'urn:nir:stato:legge:2020-01-01;1';

function reader(): SnapshotReader {
  const data: SnapshotData = {
    acts: [
      {
        urn: URN,
        title: 'Legge di prova',
        actType: 'legge',
        authority: 'stato',
        sourceRank: 3,
        publicationDate: '2020-01-01',
        gazzettaNumber: null,
        abrogated: false,
        abrogatedFrom: null,
        abrogatedBy: null,
        versionCount: 1,
      },
    ],
    versions: [
      {
        id: 'v1',
        actUrn: URN,
        ordinal: 0,
        inForceFrom: '2020-01-01',
        inForceTo: null,
        consolidated: true,
        dateConflict: null,
      },
    ],
    articles: [
      {
        id: 'a1',
        versionId: 'v1',
        actUrn: URN,
        eId: 'art_1',
        number: '1',
        num: 'Art. 1',
        heading: 'Tracciabilità',
        container: null,
        principal: true,
        text: 'La stazione appaltante verifica la tracciabilità dei flussi finanziari.',
        position: 0,
      },
    ],
    relations: [],
    anomalies: [
      {
        id: 'prova.1',
        checkId: 'rinvio-ad-atto-abrogato',
        level: 1,
        title: 'Un rinvio che non torna',
        plainLanguage: 'Spiegazione in lingua comune.',
        urns: [URN],
        windowFrom: '2020-01-01',
        windowTo: null,
        rule: 'SELECT … FROM Relation WHERE …',
        evidence: [{ urn: URN, label: 'art. 1', quote: 'il testo originale citato' }],
        resolutions: [
          { criterion: 'posteriorita', status: 'non-si-applica', explanation: 'nessun criterio' },
        ],
        severity: 'alta',
        published: true,
        computedAt: '2026-09-13T00:00:00.000Z',
      },
    ],
    metrics: [],
    manifest: null,
  };
  return new SnapshotReader(data);
}

const testoDi = (r: { content: Array<{ text: string }> }): string =>
  r.content.map((c) => c.text).join('\n');

describe('ogni risposta porta con sé le sue cautele', () => {
  it('la ricerca allega l’avvertenza di non ufficialità', () => {
    expect(testoDi(cercaNorme(reader(), { query: 'tracciabilita' }))).toContain(AVVERTENZA);
  });

  it('il testo di una norma allega l’avvertenza', () => {
    expect(testoDi(leggiNorma(reader(), { urn: URN }))).toContain(AVVERTENZA);
  });

  it('una segnalazione mostra il testo originale PRIMA della regola', () => {
    // L'ordine non è estetico: chi legge deve poter verificare l'estrazione
    // prima di valutare il verdetto.
    const t = testoDi(leggiSegnalazione(reader(), { id: 'prova.1' }));
    expect(t.indexOf('il testo originale citato')).toBeLessThan(t.indexOf('SELECT'));
  });

  it('una segnalazione mostra la regola in chiaro, non una motivazione inventata', () => {
    const t = testoDi(leggiSegnalazione(reader(), { id: 'prova.1' }));
    expect(t).toContain('SELECT … FROM Relation');
    expect(t).toMatch(/non è una spiegazione scritta da un modello/i);
  });

  it('i criteri di risoluzione compaiono anche quando nessuno si applica', () => {
    // Se comparissero a intermittenza, la loro assenza diventerebbe un segnale
    // ambiguo.
    expect(testoDi(leggiSegnalazione(reader(), { id: 'prova.1' }))).toContain('non-si-applica');
  });
});

describe('assenza di segnale', () => {
  it('una ricerca vuota dice che il corpus è parziale, non che la norma non esiste', () => {
    const t = testoDi(cercaNorme(reader(), { query: 'parolachenonesistemai' }));
    expect(t).toMatch(/parziale per costruzione/i);
    expect(t).toMatch(/non significa che la norma non esista/i);
  });

  it('nessuna segnalazione non significa norma coerente', () => {
    const t = testoDi(elencaSegnalazioni(reader(), { controllo: 'controllo-inesistente' }));
    expect(t).toMatch(/Assenza di segnale non significa norma coerente/i);
  });

  it('un URN sconosciuto lo dice invece di restituire il vuoto', () => {
    const r = leggiNorma(reader(), { urn: 'urn:nir:stato:legge:1999-01-01;9' });
    expect(r.isError).toBe(true);
    expect(testoDi(r)).toMatch(/corpus è parziale/i);
  });
});

describe('la ricerca non si fa fermare dagli accenti', () => {
  it('«tracciabilita» trova «tracciabilità»', () => {
    // Chi cerca scrive senza accento, il testo di legge ce l'ha. Senza
    // normalizzazione il risultato vuoto somiglia a un fatto sulla legge.
    expect(testoDi(cercaNorme(reader(), { query: 'tracciabilita' }))).toContain('Legge di prova');
    expect(testoDi(cercaNorme(reader(), { query: 'tracciabilità' }))).toContain('Legge di prova');
  });
});

describe('lo stato del progetto dice per primo cosa NON si fa', () => {
  it('elenca i non-obiettivi prima della copertura', () => {
    const t = testoDi(statoDelProgetto(reader(), 'dataset di prova'));
    expect(t.indexOf('Cosa il progetto NON fa')).toBeLessThan(t.indexOf('Copertura'));
    expect(t).toMatch(/Nessun modello linguistico giudica/i);
    expect(t).toMatch(/Assenza di segnale ≠ norma coerente/);
  });
});

describe('il contratto del server', () => {
  it('espone sette strumenti e cinque esempi', () => {
    expect(STRUMENTI).toHaveLength(7);
    expect(NOMI_ESEMPI).toHaveLength(5);
  });

  it('nessuno strumento chiede un giudizio', () => {
    // Il confine del progetto vale anche qui: non esiste uno strumento a cui si
    // possa chiedere «queste due norme si contraddicono?».
    for (const nome of STRUMENTI) {
      expect(nome).not.toMatch(/giudica|valuta|decidi|contraddic/i);
    }
  });
});
