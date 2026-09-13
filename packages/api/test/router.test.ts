import { SnapshotReader, type SnapshotData } from '@leggichenontornano/corpus';
import { describe, expect, it } from 'vitest';
import { createRouter } from '../src/router.js';
import { SnapshotSource } from '../src/source.js';

const URN = 'urn:nir:stato:legge:1990-08-07;241';
const ALTRO = 'urn:nir:stato:legge:2016-01-01;1';

const DATA: SnapshotData = {
  acts: [
    {
      urn: URN,
      title: 'Nuove norme in materia di procedimento amministrativo',
      actType: 'legge',
      authority: 'stato',
      sourceRank: 20,
      publicationDate: '1990-08-18',
      gazzettaNumber: '192',
      abrogated: false,
      abrogatedFrom: null,
      abrogatedBy: null,
      versionCount: 2,
    },
    {
      urn: ALTRO,
      title: 'Legge successiva',
      actType: 'legge',
      authority: 'stato',
      sourceRank: 20,
      publicationDate: '2016-01-10',
      gazzettaNumber: '5',
      abrogated: true,
      abrogatedFrom: '2020-01-01',
      abrogatedBy: null,
      versionCount: 1,
    },
  ],
  versions: [
    {
      id: 'v1',
      actUrn: URN,
      ordinal: 0,
      inForceFrom: '1990-09-02',
      inForceTo: '2005-03-07',
      consolidated: false,
      dateConflict: null,
    },
    {
      id: 'v2',
      actUrn: URN,
      ordinal: 1,
      inForceFrom: '2005-03-08',
      inForceTo: null,
      consolidated: true,
      dateConflict: null,
    },
    {
      id: 'v3',
      actUrn: ALTRO,
      ordinal: 0,
      inForceFrom: '2016-01-25',
      inForceTo: null,
      consolidated: false,
      dateConflict: null,
    },
  ],
  articles: [
    {
      id: 'a1',
      versionId: 'v1',
      actUrn: URN,
      eId: 'art_3',
      number: '3',
      num: 'Art. 3.',
      heading: 'Motivazione',
      container: null,
      principal: true,
      text: 'Testo del 1990 sulla motivazione del provvedimento.',
      position: 0,
    },
    {
      id: 'a2',
      versionId: 'v2',
      actUrn: URN,
      eId: 'art_3',
      number: '3',
      num: 'Art. 3.',
      heading: 'Motivazione',
      container: null,
      principal: true,
      text: 'Testo del 2005 sulla motivazione del provvedimento amministrativo.',
      position: 0,
    },
    {
      id: 'a3',
      versionId: 'v3',
      actUrn: ALTRO,
      eId: 'art_1',
      number: '1',
      num: 'Art. 1.',
      heading: null,
      container: null,
      principal: true,
      text: 'Testo della legge successiva.',
      position: 0,
    },
  ],
  relations: [
    {
      id: 'r1',
      type: 'MODIFICA',
      sourceUrn: ALTRO,
      sourceArticle: '1',
      targetUrn: URN,
      targetArticle: '3',
      targetParagraphs: [],
      wholeAct: false,
      effectiveFrom: '2016-01-25',
      evidence: 'prova',
      confidence: 'alta',
      origin: 'activeModifications',
    },
  ],
  anomalies: [
    {
      id: 'test.1',
      checkId: 'modifica-ad-atto-abrogato',
      level: 1,
      title: 'Un titolo leggibile ad alta voce',
      plainLanguage: 'Cosa succede in pratica, in lingua comune.',
      urns: [`${URN}~art3`, ALTRO],
      windowFrom: '2016-01-25',
      windowTo: null,
      rule: 'SELECT ... FROM Relation',
      evidence: [{ urn: URN, label: 'art. 3', quote: 'citazione', kind: 'grafo' }],
      resolutions: [{ criterion: 'posteriorita', status: 'si-applica', explanation: 'motivo' }],
      severity: 'alta',
      published: true,
      computedAt: '2026-09-12T00:00:00.000Z',
    },
    {
      id: 'test.2',
      checkId: 'termini-divergenti',
      level: 3,
      title: 'Segnalazione non pubblicata',
      plainLanguage: 'Resta in coda interna.',
      urns: [ALTRO],
      windowFrom: null,
      windowTo: null,
      rule: 'SELECT ...',
      evidence: [],
      resolutions: [],
      severity: 'media',
      published: false,
      computedAt: '2026-09-12T00:00:00.000Z',
    },
  ],
  metrics: [
    {
      checkId: 'modifica-ad-atto-abrogato',
      label: 'Modifica a una norma già abrogata',
      level: 1,
      found: 1,
      reviewed: 0,
      confirmed: 0,
      precision: null,
      published: true,
      reason: 'Controllo deterministico di livello 1.',
    },
  ],
  manifest: {
    formatVersion: 1,
    generatedAt: '2026-09-12T00:00:00.000Z',
    knownAt: '2026-09-12T00:00:00.000Z',
    counts: {
      acts: 2,
      versions: 3,
      articles: 3,
      relations: 1,
      anomalies: 2,
      publishedAnomalies: 1,
    },
    sources: [{ name: 'Normattiva open data', licence: 'CC BY 4.0' }],
    publicationThreshold: { minPrecision: 0.85, minSample: 30 },
    disclaimer: 'disclaimer',
  },
};

const handle = createRouter({ source: new SnapshotSource(new SnapshotReader(DATA)) });
const get = (path: string) => handle(new Request(`https://esempio.it${path}`));
const json = async (path: string) => (await get(path)).json() as Promise<Record<string, never>>;

describe('intestazioni e contratto generale', () => {
  it('ogni risposta porta attribuzione e disclaimer', async () => {
    const res = await get('/v1/salute');
    expect(res.headers.get('x-fonte-dati')).toContain('Normattiva');
    expect(res.headers.get('x-disclaimer')).toContain('Gazzetta Ufficiale');
  });

  it('l’accesso è aperto: sono dati pubblici', async () => {
    const res = await get('/v1/anomalie');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('l’API è di sola lettura', async () => {
    const res = await handle(new Request('https://esempio.it/v1/anomalie', { method: 'POST' }));
    expect(res.status).toBe(405);
  });

  it('un percorso sconosciuto risponde in application/problem+json', async () => {
    const res = await get('/v1/inesistente');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });
});

describe('/v1/controlli', () => {
  it('espone le regole in chiaro', async () => {
    const body = (await json('/v1/controlli')) as unknown as {
      controlli: Array<{ id: string; regola: string; livello: number }>;
      nota: string;
    };
    expect(body.controlli.length).toBeGreaterThan(0);
    expect(body.controlli.every((c) => c.regola.length > 20)).toBe(true);
    expect(body.nota).toContain('85%');
  });
});

describe('/v1/anomalie', () => {
  it('restituisce solo le anomalie pubblicate', async () => {
    const body = (await json('/v1/anomalie')) as unknown as {
      totale: number;
      anomalie: Array<{ id: string }>;
      avvertenza: string;
    };
    expect(body.totale).toBe(1);
    expect(body.anomalie[0]?.id).toBe('test.1');
    expect(body.avvertenza).toContain('non significa che la norma sia coerente');
  });

  it('filtra per livello e per tipo', async () => {
    expect(((await json('/v1/anomalie?livello=3')) as unknown as { totale: number }).totale).toBe(
      0,
    );
    expect(
      ((await json('/v1/anomalie?tipo=modifica-ad-atto-abrogato')) as unknown as { totale: number })
        .totale,
    ).toBe(1);
  });

  it('filtra per URN, anche su una partizione', async () => {
    expect(
      ((await json(`/v1/anomalie?urn=${encodeURIComponent(URN)}`)) as unknown as { totale: number })
        .totale,
    ).toBe(1);
  });

  it('restituisce una singola anomalia con prove e risoluzioni', async () => {
    const body = (await json('/v1/anomalie/test.1')) as unknown as {
      evidence: unknown[];
      resolutions: unknown[];
      rule: string;
    };
    expect(body.evidence).toHaveLength(1);
    expect(body.resolutions).toHaveLength(1);
    expect(body.rule).toContain('SELECT');
  });

  it('non espone un’anomalia non pubblicata', async () => {
    expect((await get('/v1/anomalie/test.2')).status).toBe(404);
  });

  it('rispetta il limite massimo', async () => {
    const body = (await json('/v1/anomalie?limite=9999')) as unknown as { limite: number };
    expect(body.limite).toBe(100);
  });
});

describe('/v1/norme', () => {
  it('restituisce una norma con versioni e articoli', async () => {
    const body = (await json(`/v1/norme/${encodeURIComponent(URN)}`)) as unknown as {
      norma: { urn: string };
      versioni: unknown[];
      articoli: unknown[];
      disclaimer: string;
    };
    expect(body.norma.urn).toBe(URN);
    expect(body.versioni).toHaveLength(2);
    expect(body.disclaimer).toContain('Gazzetta Ufficiale');
  });

  it('risolve un articolo alla data richiesta', async () => {
    const vecchio = (await json(
      `/v1/norme/${encodeURIComponent(URN)}/articoli/3?v=2000-01-01`,
    )) as unknown as { article: { text: string }; version: { inForceFrom: string } };
    expect(vecchio.article.text).toContain('1990');
    expect(vecchio.version.inForceFrom).toBe('1990-09-02');

    const nuovo = (await json(
      `/v1/norme/${encodeURIComponent(URN)}/articoli/3?v=2010-01-01`,
    )) as unknown as { article: { text: string } };
    expect(nuovo.article.text).toContain('2005');
  });

  it('allega all’articolo le anomalie che lo riguardano', async () => {
    const body = (await json(`/v1/norme/${encodeURIComponent(URN)}/articoli/3`)) as unknown as {
      anomalie: Array<{ id: string }>;
    };
    expect(body.anomalie.map((a) => a.id)).toContain('test.1');
  });

  it('restituisce la storia di un articolo con le finestre', async () => {
    const body = (await json(
      `/v1/norme/${encodeURIComponent(URN)}/articoli/3/storia`,
    )) as unknown as { storia: Array<{ from: string; to: string | null }> };
    expect(body.storia).toHaveLength(2);
    expect(body.storia[0]?.from).toBe('1990-09-02');
    expect(body.storia[1]?.to).toBeNull();
  });

  it('404 su una norma fuori corpus', async () => {
    expect((await get('/v1/norme/urn:nir:stato:legge:1900-01-01;1')).status).toBe(404);
  });

  it('404 su un articolo che non esiste a quella data', async () => {
    expect((await get(`/v1/norme/${encodeURIComponent(URN)}/articoli/99`)).status).toBe(404);
  });

  it('cerca nel testo', async () => {
    const body = (await json('/v1/norme?q=motivazione')) as unknown as {
      risultati: Array<{ urn: string }>;
    };
    expect(body.risultati.length).toBeGreaterThan(0);
  });

  it('restituisce l’ego-network', async () => {
    const body = (await json(`/v1/norme/${encodeURIComponent(URN)}/grafo`)) as unknown as {
      nodes: unknown[];
      edges: unknown[];
    };
    expect(body.nodes).toHaveLength(2);
    expect(body.edges).toHaveLength(1);
  });

  it('include le coordinate del diagramma a strati, non un layout a forze', async () => {
    // ADR 0003: il layout è deterministico e calcolato qui. Se l'API non desse
    // le coordinate, chi la consuma le inventerebbe — e quasi sempre con un
    // layout a forze, che è ciò che abbiamo escluso.
    const body = (await json(`/v1/norme/${encodeURIComponent(URN)}/grafo`)) as unknown as {
      nodes: Array<{ urn: string; date: string | null; layer: number }>;
    };
    const centro = body.nodes.find((n) => n.urn === URN);
    expect(centro?.layer).toBe(0);
    for (const nodo of body.nodes) {
      expect(nodo).toHaveProperty('date');
      expect(typeof nodo.layer).toBe('number');
    }
  });
});

describe('/v1/metriche e /v1/dataset', () => {
  it('espone le metriche per controllo', async () => {
    const body = (await json('/v1/metriche')) as unknown as { metriche: unknown[] };
    expect(body.metriche).toHaveLength(1);
  });

  it('espone la consistenza del dataset e le licenze', async () => {
    const body = (await json('/v1/dataset')) as unknown as { licenza: string; fonte: string };
    expect(body.licenza).toContain('CC BY 4.0');
    expect(body.fonte).toContain('Normattiva');
  });
});

describe('/v1/openapi.json', () => {
  it('descrive tutti i percorsi serviti', async () => {
    const doc = (await json('/v1/openapi.json')) as unknown as {
      openapi: string;
      paths: Record<string, unknown>;
      info: { description: string };
    };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toContain('/anomalie/{id}');
    expect(Object.keys(doc.paths)).toContain('/norme/{urn}/articoli/{numero}');
    expect(doc.info.description).toContain('85%');
  });
});
