/**
 * Descrizione OpenAPI dell'API pubblica.
 *
 * Scritta a mano e volutamente breve: serve a chi integra, e un documento
 * generato automaticamente da tipi interni finirebbe per descrivere le nostre
 * strutture invece del nostro contratto.
 */
import { ATTRIBUTION, DISCLAIMER } from '@antinomia/corpus';

export function openApiDocument(basePath = '/v1'): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Antinomia — API pubblica',
      version: '1.0.0',
      description: [
        'API di sola lettura sul corpus normativo statale e sulle anomalie rilevate.',
        '',
        `**Fonte dei dati:** ${ATTRIBUTION}`,
        '',
        `**Avvertenza:** ${DISCLAIMER}`,
        '',
        'Vengono restituite soltanto le anomalie prodotte da controlli che hanno superato la soglia di pubblicazione (85% di precisione su almeno 30 revisioni umane). L’assenza di segnalazioni su una norma **non** significa che la norma sia coerente.',
      ].join('\n'),
      license: { name: 'EUPL-1.2', identifier: 'EUPL-1.2' },
      contact: { url: 'https://github.com/riccardolinares/leggichenontornano' },
    },
    servers: [{ url: basePath }],
    paths: {
      '/salute': {
        get: { summary: 'Stato del servizio', responses: { '200': jsonResponse('Stato') } },
      },
      '/controlli': {
        get: {
          summary: 'Elenco dei controlli con le loro regole in chiaro e la precisione misurata',
          responses: { '200': jsonResponse('Controlli') },
        },
      },
      '/anomalie': {
        get: {
          summary: 'Anomalie pubblicate',
          parameters: [
            param('tipo', 'Identificatore del controllo, es. `modifica-ad-atto-abrogato`'),
            param('livello', 'Livello della tassonomia: 1, 2 o 3', 'integer'),
            param('urn', 'Filtra per URN:NIR coinvolto'),
            param('limite', 'Massimo 100, predefinito 20', 'integer'),
            param('scarto', 'Offset di paginazione', 'integer'),
          ],
          responses: { '200': jsonResponse('ElencoAnomalie') },
        },
      },
      '/anomalie/{id}': {
        get: {
          summary: 'Una singola anomalia, con prove e criteri di risoluzione',
          parameters: [pathParam('id', 'Identificatore stabile dell’anomalia')],
          responses: { '200': jsonResponse('Anomalia'), '404': problemResponse() },
        },
      },
      '/norme': {
        get: {
          summary: 'Elenco delle norme, oppure ricerca full-text con `q`',
          parameters: [
            param('q', 'Testo da cercare nelle norme vigenti'),
            param('limite', 'Massimo risultati', 'integer'),
            param('scarto', 'Offset di paginazione', 'integer'),
          ],
          responses: { '200': jsonResponse('ElencoNorme') },
        },
      },
      '/norme/{urn}': {
        get: {
          summary: 'Una norma con le sue versioni e gli articoli vigenti a una data',
          parameters: [
            pathParam('urn', 'URN:NIR, es. `urn:nir:stato:legge:1990-08-07;241`'),
            param('v', 'Data di vigenza in formato `YYYY-MM-DD`; se omessa, oggi'),
          ],
          responses: { '200': jsonResponse('Norma'), '404': problemResponse() },
        },
      },
      '/norme/{urn}/versioni': {
        get: {
          summary: 'Le finestre di vigenza note per una norma',
          parameters: [pathParam('urn', 'URN:NIR')],
          responses: { '200': jsonResponse('Versioni') },
        },
      },
      '/norme/{urn}/articoli/{numero}': {
        get: {
          summary: 'Il testo di un articolo alla data richiesta',
          description:
            'È l’equivalente dell’URL citabile `/norma/{urn}~art3?v=2013-04-20`. Restituisce anche le anomalie pubblicate che riguardano quell’articolo.',
          parameters: [
            pathParam('urn', 'URN:NIR'),
            pathParam('numero', 'Numero di articolo, es. `3` o `3-bis`'),
            param('v', 'Data di vigenza `YYYY-MM-DD`'),
          ],
          responses: { '200': jsonResponse('Articolo'), '404': problemResponse() },
        },
      },
      '/norme/{urn}/articoli/{numero}/storia': {
        get: {
          summary: 'Le versioni successive di un articolo, con le finestre di vigenza',
          parameters: [pathParam('urn', 'URN:NIR'), pathParam('numero', 'Numero di articolo')],
          responses: { '200': jsonResponse('StoriaArticolo') },
        },
      },
      '/norme/{urn}/grafo': {
        get: {
          summary: 'Ego-network a profondità 1 o 2 attorno a una norma',
          description:
            'Nessun layout a forze. Ogni nodo porta le due coordinate del diagramma a strati che il sito disegna — «date» (il tempo, sull\'asse x) e «layer» (la distanza dal centro) — calcolate server-side e identiche a ogni chiamata, perché il disegno di una relazione fra norme deve essere deterministico e citabile come il resto.',
          parameters: [
            pathParam('urn', 'URN:NIR'),
            param('profondita', '1 (predefinito) oppure 2', 'integer'),
          ],
          responses: { '200': jsonResponse('Grafo') },
        },
      },
      '/metriche': {
        get: {
          summary: 'Precisione misurata per ciascun controllo e stato del cancello di pubblicazione',
          responses: { '200': jsonResponse('Metriche') },
        },
      },
      '/dataset': {
        get: {
          summary: 'Consistenza del dataset, licenze e data di generazione',
          responses: { '200': jsonResponse('Dataset') },
        },
      },
    },
  };
}

function jsonResponse(name: string): Record<string, unknown> {
  return {
    description: name,
    content: { 'application/json': { schema: { type: 'object' } } },
  };
}

function problemResponse(): Record<string, unknown> {
  return {
    description: 'Errore',
    content: {
      'application/problem+json': {
        schema: {
          type: 'object',
          properties: {
            status: { type: 'integer' },
            title: { type: 'string' },
            detail: { type: 'string' },
          },
        },
      },
    },
  };
}

function param(name: string, description: string, type = 'string'): Record<string, unknown> {
  return { name, in: 'query', required: false, description, schema: { type } };
}

function pathParam(name: string, description: string): Record<string, unknown> {
  return { name, in: 'path', required: true, description, schema: { type: 'string' } };
}
