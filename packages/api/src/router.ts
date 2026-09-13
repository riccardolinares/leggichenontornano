/**
 * L'API pubblica.
 *
 * È scritta sulle primitive Web standard (`Request`/`Response`) e non su un
 * framework, per una ragione concreta: la stessa funzione serve il processo
 * autonomo e i route handler del sito Next.js, e il frontend consuma davvero
 * l'API pubblica invece di una scorciatoia interna. Se il frontend avesse una
 * via privilegiata, l'API pubblica sarebbe documentazione, non un prodotto.
 *
 * Ogni risposta porta l'attribuzione a Normattiva e il disclaimer di non
 * ufficialità in due intestazioni. Non è decorazione: chi consuma l'API in una
 * pipeline non vede il footer del sito.
 */
import { ATTRIBUTION, DISCLAIMER } from '@antinomia/corpus';
import { CHECK_DEFINITIONS } from '@antinomia/engine';
import { openApiDocument } from './openapi.js';
import type { ApiSource } from './source.js';

export interface RouterOptions {
  source: ApiSource;
  /** Prefisso dei percorsi. Predefinito `/v1`. */
  basePath?: string;
  /** Secondi di cache per le risposte pubbliche. */
  cacheSeconds?: number;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-fonte-dati': ATTRIBUTION,
  'x-disclaimer': DISCLAIMER,
  // Dati pubblici di un progetto civico: l'accesso da qualunque origine è il
  // comportamento voluto, non una svista di configurazione.
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
} as const;

export function createRouter(opts: RouterOptions): (request: Request) => Promise<Response> {
  const base = opts.basePath ?? '/v1';
  const cache = opts.cacheSeconds ?? 300;
  const { source } = opts;

  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }
    if (request.method !== 'GET') {
      return problem(405, 'Metodo non consentito', 'L’API pubblica è di sola lettura.');
    }

    const url = new URL(request.url);
    const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
    const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
    const q = url.searchParams;

    try {
      // GET /v1/salute
      if (segments.length === 0 || segments[0] === 'salute') {
        return ok({ stato: 'attivo', fonte: source.kind, versioneApi: 1 }, 0);
      }

      // GET /v1/openapi.json
      if (segments[0] === 'openapi.json') {
        return ok(openApiDocument(base), cache);
      }

      // GET /v1/controlli — il registro dei controlli con le regole in chiaro
      if (segments[0] === 'controlli' && segments.length === 1) {
        const metrics = await source.metrics();
        const byId = new Map(metrics.map((m) => [m.checkId, m]));
        return ok(
          {
            controlli: CHECK_DEFINITIONS.map((c) => ({
              id: c.id,
              livello: c.level,
              etichetta: c.label,
              descrizione: c.description,
              regola: c.rule,
              precisioneAttesa: c.expectedPrecision,
              deterministico: c.deterministic,
              misura: byId.get(c.id) ?? null,
            })),
            nota: 'Un controllo viene pubblicato solo quando la revisione umana su campione supera l’85% di precisione, con almeno 30 revisioni.',
          },
          cache,
        );
      }

      // GET /v1/anomalie
      if (segments[0] === 'anomalie' && segments.length === 1) {
        const limit = clamp(Number(q.get('limite') ?? 20), 1, 100);
        const offset = Math.max(0, Number(q.get('scarto') ?? 0));
        const { items, total } = await source.anomalies({
          ...(q.get('tipo') ? { checkId: q.get('tipo')! } : {}),
          ...(q.get('livello') ? { level: Number(q.get('livello')) } : {}),
          ...(q.get('urn') ? { urn: q.get('urn')! } : {}),
          limit,
          offset,
        });
        return ok(
          {
            totale: total,
            limite: limit,
            scarto: offset,
            anomalie: items,
            avvertenza:
              'Vengono restituite solo le anomalie dei controlli che hanno superato la soglia di pubblicazione. L’assenza di segnalazioni su una norma non significa che la norma sia coerente.',
          },
          cache,
        );
      }

      // GET /v1/anomalie/{id}
      if (segments[0] === 'anomalie' && segments.length === 2) {
        const anomaly = await source.anomaly(segments[1]!);
        if (!anomaly) return problem(404, 'Anomalia non trovata', segments[1]!);
        return ok(anomaly, cache);
      }

      // GET /v1/norme
      if (segments[0] === 'norme' && segments.length === 1) {
        const query = q.get('q');
        if (query) {
          const limit = clamp(Number(q.get('limite') ?? 20), 1, 50);
          return ok({ risultati: await source.search(query, limit) }, cache);
        }
        const limit = clamp(Number(q.get('limite') ?? 50), 1, 200);
        const offset = Math.max(0, Number(q.get('scarto') ?? 0));
        return ok({ norme: await source.acts(limit, offset) }, cache);
      }

      // GET /v1/norme/{urn}...
      if (segments[0] === 'norme' && segments.length >= 2) {
        const urn = segments[1]!;
        const act = await source.act(urn);
        if (!act) return problem(404, 'Norma non presente nel corpus', urn);

        if (segments.length === 2) {
          const date = q.get('v') ?? undefined;
          return ok(
            {
              norma: act,
              versioni: await source.versions(urn),
              articoli: await source.articles(urn, date),
              vigenzaRichiesta: date ?? 'oggi',
              disclaimer: DISCLAIMER,
              fonte: ATTRIBUTION,
            },
            cache,
          );
        }

        if (segments[2] === 'versioni') {
          return ok({ urn, versioni: await source.versions(urn) }, cache);
        }

        if (segments[2] === 'grafo') {
          const depth = q.get('profondita') === '2' ? 2 : 1;
          return ok({ urn, profondita: depth, ...(await source.graph(urn, depth)) }, cache);
        }

        if (segments[2] === 'articoli' && segments.length >= 4) {
          const number = segments[3]!;
          if (segments[4] === 'storia') {
            return ok(
              { urn, articolo: number, storia: await source.articleHistory(urn, number) },
              cache,
            );
          }
          const date = q.get('v') ?? undefined;
          const found = await source.article(urn, number, date);
          if (!found) {
            return problem(
              404,
              'Articolo non trovato a quella data',
              `${urn}~art${number}${date ? `@${date}` : ''}`,
            );
          }
          return ok(
            {
              norma: act,
              ...found,
              vigenzaRichiesta: date ?? 'oggi',
              anomalie: (
                await source.anomalies({ urn: `${urn}~art${number}`, limit: 50, offset: 0 })
              ).items,
              disclaimer: DISCLAIMER,
              fonte: ATTRIBUTION,
            },
            cache,
          );
        }
      }

      // GET /v1/metriche
      if (segments[0] === 'metriche') {
        return ok({ metriche: await source.metrics() }, cache);
      }

      // GET /v1/dataset
      if (segments[0] === 'dataset') {
        return ok(
          {
            ...(await source.stats()),
            licenza: 'CC BY 4.0 per i dati derivati; EUPL 1.2 per il software',
            fonte: ATTRIBUTION,
            disclaimer: DISCLAIMER,
          },
          cache,
        );
      }

      return problem(404, 'Percorso non riconosciuto', url.pathname);
    } catch (err) {
      // Un errore interno non deve mai raccontare la struttura del database.
      process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
      return problem(500, 'Errore interno', 'La richiesta non è stata completata.');
    }
  };
}

function ok(body: unknown, cacheSeconds: number): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      ...JSON_HEADERS,
      'cache-control':
        cacheSeconds > 0
          ? `public, max-age=${cacheSeconds}, stale-while-revalidate=86400`
          : 'no-store',
    },
  });
}

/**
 * Errore in formato `application/problem+json` (RFC 9457). Un'API pubblica che
 * restituisce errori in un formato proprietario costringe ogni consumatore a
 * scrivere il proprio adattatore.
 */
function problem(status: number, title: string, detail: string): Response {
  return new Response(JSON.stringify({ status, title, detail }, null, 2), {
    status,
    headers: { ...JSON_HEADERS, 'content-type': 'application/problem+json; charset=utf-8' },
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
