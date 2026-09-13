/**
 * La sorgente dati dell'API.
 *
 * Due implementazioni, una sola interfaccia:
 *
 *  - **dataset** (`SnapshotSource`): legge i file JSONL. È quella che usa il sito
 *    durante la generazione statica e chiunque scarichi il dataset;
 *  - **database** (`DatabaseSource`): legge da PostgreSQL. È quella del servizio
 *    in esecuzione, con ricerca full-text e attraversamenti ricorsivi.
 *
 * Che siano due non è un'astrazione gratuita: è il modo in cui ci obblighiamo a
 * non far divergere il dataset pubblicato dal sito. Se una risposta cambia
 * passando dall'uno all'altro, uno dei due sta mentendo.
 */
import {
  SnapshotReader,
  articleAt as dbArticleAt,
  articleHistory as dbArticleHistory,
  corpusStats as dbCorpusStats,
  egoNetwork as dbEgoNetwork,
  layeredGraph as dbLayeredGraph,
  getAct as dbGetAct,
  listActs as dbListActs,
  listVersions as dbListVersions,
  search as dbSearch,
  getPrisma,
  type SnapshotAnomaly,
  type SnapshotCheckMetric,
} from '@antinomia/corpus';

export interface AnomalyQuery {
  checkId?: string;
  level?: number;
  urn?: string;
  limit: number;
  offset: number;
}

export interface ActRef {
  urn: string;
  title: string;
  actType: string | null;
  publicationDate: string | null;
  abrogated: boolean;
  abrogatedFrom: string | null;
  versionCount: number;
}

export interface ArticleRef {
  number: string | null;
  heading: string | null;
  container: string | null;
  text: string;
}

export interface VersionRef {
  inForceFrom: string;
  inForceTo: string | null;
  consolidated: boolean;
  dateConflict: string | null;
}

export interface GraphNode {
  urn: string;
  title: string;
  abrogated: boolean;
  /**
   * Data dell'atto e distanza dal centro: sono le due coordinate del diagramma
   * a strati che il sito disegna (tempo sull'asse x, profondità sull'asse y).
   *
   * Stanno nell'API perché il layout è **deterministico e calcolato qui**
   * (ADR 0003): chi consuma l'API deve poter ridisegnare lo stesso diagramma,
   * non inventarne uno a forze.
   */
  date: string | null;
  layer: number;
}

export interface GraphEdgeOut {
  type: string;
  sourceUrn: string;
  targetUrn: string;
  targetArticle: string | null;
  effectiveFrom: string | null;
  confidence: string;
}

/** Tutto ciò che l'API sa chiedere. Niente di più, niente di meno. */
export interface ApiSource {
  readonly kind: 'dataset' | 'database';
  anomalies(query: AnomalyQuery): Promise<{ items: SnapshotAnomaly[]; total: number }>;
  anomaly(id: string): Promise<SnapshotAnomaly | null>;
  acts(limit: number, offset: number): Promise<ActRef[]>;
  act(urn: string): Promise<ActRef | null>;
  versions(urn: string): Promise<VersionRef[]>;
  articles(urn: string, date?: string): Promise<ArticleRef[]>;
  article(urn: string, number: string, date?: string): Promise<{ version: VersionRef; article: ArticleRef } | null>;
  articleHistory(
    urn: string,
    number: string,
  ): Promise<Array<{ from: string; to: string | null; heading: string | null; text: string | null }>>;
  search(query: string, limit: number): Promise<Array<{ urn: string; title: string; articleNumber: string | null; snippet: string }>>;
  graph(urn: string, depth: 1 | 2): Promise<{ nodes: GraphNode[]; edges: GraphEdgeOut[] }>;
  metrics(): Promise<SnapshotCheckMetric[]>;
  stats(): Promise<Record<string, unknown>>;
}

/** Sorgente su dataset JSONL: nessun database, tutto in memoria. */
export class SnapshotSource implements ApiSource {
  readonly kind = 'dataset' as const;

  constructor(private readonly reader: SnapshotReader) {}

  static fromDirectory(dir: string): SnapshotSource {
    return new SnapshotSource(SnapshotReader.fromDirectory(dir));
  }

  async anomalies(query: AnomalyQuery): Promise<{ items: SnapshotAnomaly[]; total: number }> {
    let items = this.reader.publishedAnomalies();
    if (query.checkId) items = items.filter((a) => a.checkId === query.checkId);
    if (query.level !== undefined) items = items.filter((a) => a.level === query.level);
    if (query.urn) {
      const wanted = query.urn;
      items = items.filter((a) => a.urns.some((u) => u === wanted || u.startsWith(`${wanted}~`)));
    }
    return {
      total: items.length,
      items: items.slice(query.offset, query.offset + query.limit),
    };
  }

  async anomaly(id: string): Promise<SnapshotAnomaly | null> {
    const found = this.reader.anomaly(id);
    return found?.published ? found : null;
  }

  async acts(limit: number, offset: number): Promise<ActRef[]> {
    return this.reader.data.acts.slice(offset, offset + limit).map(toActRef);
  }

  async act(urn: string): Promise<ActRef | null> {
    const found = this.reader.act(urn);
    return found ? toActRef(found) : null;
  }

  async versions(urn: string): Promise<VersionRef[]> {
    return this.reader.versions(urn).map((v) => ({
      inForceFrom: v.inForceFrom,
      inForceTo: v.inForceTo,
      consolidated: v.consolidated,
      dateConflict: v.dateConflict,
    }));
  }

  async articles(urn: string, date?: string): Promise<ArticleRef[]> {
    return this.reader.articlesAt(urn, date).map((a) => ({
      number: a.number,
      heading: a.heading,
      container: a.container,
      text: a.text,
    }));
  }

  async article(
    urn: string,
    number: string,
    date?: string,
  ): Promise<{ version: VersionRef; article: ArticleRef } | null> {
    const found = this.reader.articleAt(urn, number, date);
    if (!found) return null;
    return {
      version: {
        inForceFrom: found.version.inForceFrom,
        inForceTo: found.version.inForceTo,
        consolidated: found.version.consolidated,
        dateConflict: found.version.dateConflict,
      },
      article: {
        number: found.article.number,
        heading: found.article.heading,
        container: found.article.container,
        text: found.article.text,
      },
    };
  }

  async articleHistory(urn: string, number: string) {
    return this.reader.articleHistory(urn, number);
  }

  async search(query: string, limit: number) {
    return this.reader.search(query, limit).map(({ act, article }) => ({
      urn: act.urn,
      title: act.title,
      articleNumber: article.number,
      snippet: snippet(article.text, query),
    }));
  }

  async graph(urn: string, _depth: 1 | 2) {
    const ego = this.reader.egoNetwork(urn);
    return {
      nodes: ego.nodes.map((n) => ({
        urn: n.urn,
        title: n.title,
        abrogated: n.abrogated,
        date: this.reader.act(n.urn)?.publicationDate ?? null,
        layer: n.urn === urn ? 0 : 1,
      })),
      edges: ego.edges.map((e) => ({
        type: e.type,
        sourceUrn: e.sourceUrn,
        targetUrn: e.targetUrn,
        targetArticle: e.targetArticle,
        effectiveFrom: e.effectiveFrom,
        confidence: e.confidence,
      })),
    };
  }

  async metrics(): Promise<SnapshotCheckMetric[]> {
    return this.reader.data.metrics;
  }

  async stats(): Promise<Record<string, unknown>> {
    return {
      fonte: 'dataset',
      ...(this.reader.data.manifest?.counts ?? {}),
      generatoIl: this.reader.data.manifest?.generatedAt ?? null,
    };
  }
}

/** Sorgente su PostgreSQL. */
export class DatabaseSource implements ApiSource {
  readonly kind = 'database' as const;

  async anomalies(query: AnomalyQuery): Promise<{ items: SnapshotAnomaly[]; total: number }> {
    const prisma = getPrisma();
    const where = {
      published: true,
      resolvedAt: null,
      ...(query.checkId ? { checkId: query.checkId } : {}),
      ...(query.level !== undefined ? { level: query.level } : {}),
      ...(query.urn ? { urns: { has: query.urn } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.anomaly.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { computedAt: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      prisma.anomaly.count({ where }),
    ]);
    return { total, items: rows.map(toSnapshotAnomaly) };
  }

  async anomaly(id: string): Promise<SnapshotAnomaly | null> {
    const prisma = getPrisma();
    const row = await prisma.anomaly.findFirst({ where: { id, published: true } });
    return row ? toSnapshotAnomaly(row) : null;
  }

  async acts(limit: number, offset: number): Promise<ActRef[]> {
    return (await dbListActs({ take: limit, skip: offset })).map(toActRef);
  }

  async act(urn: string): Promise<ActRef | null> {
    const found = await dbGetAct(urn);
    return found ? toActRef(found) : null;
  }

  async versions(urn: string): Promise<VersionRef[]> {
    return (await dbListVersions(urn)).map((v) => ({
      inForceFrom: v.inForceFrom,
      inForceTo: v.inForceTo,
      consolidated: v.consolidated,
      dateConflict: v.dateConflict,
    }));
  }

  async articles(urn: string, date?: string): Promise<ArticleRef[]> {
    const { articlesAt } = await import('@antinomia/corpus');
    return (await articlesAt(urn, date)).map((a) => ({
      number: a.number,
      heading: a.heading,
      container: a.container,
      text: a.text,
    }));
  }

  async article(urn: string, number: string, date?: string) {
    const found = await dbArticleAt(urn, number, date);
    if (!found) return null;
    return {
      version: {
        inForceFrom: found.version.inForceFrom,
        inForceTo: found.version.inForceTo,
        consolidated: found.version.consolidated,
        dateConflict: found.version.dateConflict,
      },
      article: {
        number: found.article.number,
        heading: found.article.heading,
        container: found.article.container,
        text: found.article.text,
      },
    };
  }

  async articleHistory(urn: string, number: string) {
    return dbArticleHistory(urn, number);
  }

  async search(query: string, limit: number) {
    return (await dbSearch(query, { limit })).map((h) => ({
      urn: h.urn,
      title: h.title,
      articleNumber: h.articleNumber,
      snippet: h.snippet,
    }));
  }

  async graph(urn: string, depth: 1 | 2) {
    const [ego, strati] = await Promise.all([dbEgoNetwork(urn, depth), dbLayeredGraph(urn, depth)]);
    const perUrn = new Map(strati.nodes.map((n) => [n.urn, n]));
    return {
      nodes: ego.nodes.map((n) => ({
        urn: n.urn,
        title: n.title,
        abrogated: n.abrogated,
        date: perUrn.get(n.urn)?.date ?? null,
        layer: perUrn.get(n.urn)?.layer ?? (n.urn === urn ? 0 : 1),
      })),
      edges: ego.edges.map((e) => ({
        type: e.type,
        sourceUrn: e.sourceUrn,
        targetUrn: e.targetUrn,
        targetArticle: e.targetArticle,
        effectiveFrom: e.effectiveFrom,
        confidence: e.confidence,
      })),
    };
  }

  async metrics(): Promise<SnapshotCheckMetric[]> {
    const { computeMetrics } = await import('@antinomia/engine');
    return computeMetrics();
  }

  async stats(): Promise<Record<string, unknown>> {
    return { fonte: 'database', ...(await dbCorpusStats()) };
  }
}

function toActRef(a: {
  urn: string;
  title: string;
  actType: string | null;
  publicationDate: string | null;
  abrogated: boolean;
  abrogatedFrom: string | null;
  versionCount: number;
}): ActRef {
  return {
    urn: a.urn,
    title: a.title,
    actType: a.actType,
    publicationDate: a.publicationDate,
    abrogated: a.abrogated,
    abrogatedFrom: a.abrogatedFrom,
    versionCount: a.versionCount,
  };
}

function toSnapshotAnomaly(a: {
  id: string;
  checkId: string;
  level: number;
  title: string;
  plainLanguage: string;
  urns: string[];
  windowFrom: string | null;
  windowTo: string | null;
  rule: string;
  evidence: unknown;
  resolutions: unknown;
  severity: string;
  published: boolean;
  computedAt: Date;
}): SnapshotAnomaly {
  return {
    id: a.id,
    checkId: a.checkId,
    level: a.level,
    title: a.title,
    plainLanguage: a.plainLanguage,
    urns: a.urns,
    windowFrom: a.windowFrom,
    windowTo: a.windowTo,
    rule: a.rule,
    evidence: a.evidence,
    resolutions: a.resolutions,
    severity: a.severity,
    published: a.published,
    computedAt: a.computedAt.toISOString(),
  };
}

/** Estratto centrato sul primo termine trovato. */
function snippet(text: string, query: string, radius = 160): string {
  const term = query.toLowerCase().split(/\s+/).find((t) => t.length > 2) ?? '';
  const at = text.toLowerCase().indexOf(term);
  if (at < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
