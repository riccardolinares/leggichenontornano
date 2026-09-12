/**
 * Lettura dal corpus: le interrogazioni che servono all'API pubblica e al sito.
 *
 * Ogni funzione che restituisce testo normativo restituisce anche la finestra di
 * vigenza da cui quel testo proviene. Non è una comodità: sul sito il testo
 * originale sta sempre sopra i campi estratti e accanto alla sua data, e un
 * livello di accesso che restituisse testo senza data renderebbe quel requisito
 * impossibile da rispettare in modo affidabile.
 */
import { getPrisma } from './client.js';

export interface ActSummary {
  urn: string;
  title: string;
  actType: string | null;
  publicationDate: string | null;
  abrogated: boolean;
  abrogatedFrom: string | null;
  versionCount: number;
}

export interface VersionSummary {
  id: string;
  ordinal: number;
  inForceFrom: string;
  inForceTo: string | null;
  consolidated: boolean;
  dateConflict: string | null;
}

export interface ArticleText {
  id: string;
  eId: string;
  number: string | null;
  num: string | null;
  heading: string | null;
  container: string | null;
  text: string;
  position: number;
}

export interface ArticleAtDate {
  act: ActSummary;
  version: VersionSummary;
  article: ArticleText;
  provisions: Array<{ eId: string; kind: string; number: string | null; text: string }>;
}

export async function listActs(opts: { skip?: number; take?: number } = {}): Promise<ActSummary[]> {
  const prisma = getPrisma();
  const rows = await prisma.act.findMany({
    skip: opts.skip ?? 0,
    take: opts.take ?? 100,
    orderBy: [{ publicationDate: 'desc' }, { urn: 'asc' }],
    include: { _count: { select: { versions: true } } },
  });
  return rows.map(toActSummary);
}

export async function getAct(urn: string): Promise<ActSummary | null> {
  const prisma = getPrisma();
  const row = await prisma.act.findUnique({
    where: { urn },
    include: { _count: { select: { versions: true } } },
  });
  return row ? toActSummary(row) : null;
}

/** Tutte le versioni note di un atto, nello stato di conoscenza corrente. */
export async function listVersions(urn: string): Promise<VersionSummary[]> {
  const prisma = getPrisma();
  const rows = await prisma.actVersion.findMany({
    where: { actUrn: urn, knownTo: null },
    orderBy: { inForceFrom: 'asc' },
  });
  return rows.map((v) => ({
    id: v.id,
    ordinal: v.ordinal,
    inForceFrom: v.inForceFrom,
    inForceTo: v.inForceTo,
    consolidated: v.consolidated,
    dateConflict: v.dateConflict,
  }));
}

/**
 * La versione vigente a una data. `date` in formato ISO; se omessa, oggi.
 * Il confronto sulle stringhe ISO è esatto e permette al database di usare
 * l'indice su `(actUrn, inForceFrom)` senza conversioni.
 */
export async function versionAt(urn: string, date?: string): Promise<VersionSummary | null> {
  const prisma = getPrisma();
  const when = date ?? new Date().toISOString().slice(0, 10);
  const row = await prisma.actVersion.findFirst({
    where: { actUrn: urn, knownTo: null, inForceFrom: { lte: when } },
    orderBy: { inForceFrom: 'desc' },
  });
  return row
    ? {
        id: row.id,
        ordinal: row.ordinal,
        inForceFrom: row.inForceFrom,
        inForceTo: row.inForceTo,
        consolidated: row.consolidated,
        dateConflict: row.dateConflict,
      }
    : null;
}

/** Gli articoli di un atto alla data indicata. */
export async function articlesAt(urn: string, date?: string): Promise<ArticleText[]> {
  const prisma = getPrisma();
  const version = await versionAt(urn, date);
  if (!version) return [];
  const rows = await prisma.article.findMany({
    where: { versionId: version.id },
    orderBy: { position: 'asc' },
  });
  return rows.map(toArticleText);
}

/**
 * Un singolo articolo a una data: è la risposta a `/norma/{urn}~art3?v=2013-04-20`,
 * l'URL che deve poter essere incollato in una memoria difensiva (ADR 0008).
 */
export async function articleAt(
  urn: string,
  articleNumber: string,
  date?: string,
): Promise<ArticleAtDate | null> {
  const prisma = getPrisma();
  const [act, version] = await Promise.all([getAct(urn), versionAt(urn, date)]);
  if (!act || !version) return null;
  const article = await prisma.article.findFirst({
    where: { versionId: version.id, number: articleNumber.toLowerCase() },
    include: { provisions: { orderBy: { position: 'asc' } } },
  });
  if (!article) return null;
  return {
    act,
    version,
    article: toArticleText(article),
    provisions: article.provisions.map((p) => ({
      eId: p.eId,
      kind: p.kind,
      number: p.number,
      text: p.text,
    })),
  };
}

/**
 * Storia di un articolo: una riga per ogni finestra in cui il testo è rimasto
 * identico. Le versioni consecutive che non toccano l'articolo vengono
 * accorpate, perché venti scalini identici sulla barra di multivigenza sono
 * rumore e nascondono i due scalini che contano.
 */
export async function articleHistory(
  urn: string,
  articleNumber: string,
): Promise<Array<{ from: string; to: string | null; text: string | null; heading: string | null }>> {
  const prisma = getPrisma();
  const versions = await listVersions(urn);
  if (versions.length === 0) return [];
  const articles = await prisma.article.findMany({
    where: {
      versionId: { in: versions.map((v) => v.id) },
      number: articleNumber.toLowerCase(),
    },
    select: { versionId: true, text: true, heading: true },
  });
  const byVersion = new Map(articles.map((a) => [a.versionId, a]));

  const out: Array<{ from: string; to: string | null; text: string | null; heading: string | null }> =
    [];
  for (const version of versions) {
    const found = byVersion.get(version.id) ?? null;
    const previous = out[out.length - 1];
    if (previous && previous.text === (found?.text ?? null)) {
      previous.to = version.inForceTo;
      continue;
    }
    out.push({
      from: version.inForceFrom,
      to: version.inForceTo,
      text: found?.text ?? null,
      heading: found?.heading ?? null,
    });
  }
  return out;
}

export interface SearchHit {
  urn: string;
  title: string;
  articleNumber: string | null;
  heading: string | null;
  snippet: string;
  rank: number;
}

/**
 * Ricerca full-text con il dizionario italiano di PostgreSQL.
 *
 * Si cerca solo nella versione vigente alla data indicata: cercare in tutte le
 * versioni di tutti gli atti restituirebbe lo stesso articolo venti volte, una
 * per ogni sua riformulazione storica.
 */
export async function search(
  query: string,
  opts: { date?: string; limit?: number } = {},
): Promise<SearchHit[]> {
  const prisma = getPrisma();
  const when = opts.date ?? new Date().toISOString().slice(0, 10);
  const limit = Math.min(opts.limit ?? 20, 100);
  return prisma.$queryRaw<SearchHit[]>`
    WITH vigenti AS (
      SELECT DISTINCT ON (v."actUrn") v."id", v."actUrn"
      FROM "ActVersion" v
      WHERE v."knownTo" IS NULL AND v."inForceFrom" <= ${when}
      ORDER BY v."actUrn", v."inForceFrom" DESC
    )
    SELECT a."urn"                AS urn,
           a."title"              AS title,
           art."number"           AS "articleNumber",
           art."heading"          AS heading,
           ts_headline('italian', art."text", plainto_tsquery('italian', ${query}),
                       'MaxWords=40, MinWords=15, ShortWord=3, MaxFragments=1') AS snippet,
           ts_rank(to_tsvector('italian', art."text"),
                   plainto_tsquery('italian', ${query})) AS rank
    FROM "Article" art
    JOIN vigenti v ON v."id" = art."versionId"
    JOIN "Act" a   ON a."urn" = v."actUrn"
    WHERE to_tsvector('italian', art."text") @@ plainto_tsquery('italian', ${query})
    ORDER BY rank DESC, a."publicationDate" DESC
    LIMIT ${limit}
  `;
}

/** Conteggi complessivi, mostrati nella pagina «Dati». */
export async function corpusStats(): Promise<{
  acts: number;
  versions: number;
  articles: number;
  relations: number;
  abrogatedActs: number;
  lastRun: { finishedAt: Date | null; status: string } | null;
}> {
  const prisma = getPrisma();
  const [acts, versions, articles, relations, abrogatedActs, lastRun] = await Promise.all([
    prisma.act.count(),
    prisma.actVersion.count({ where: { knownTo: null } }),
    prisma.article.count(),
    prisma.relation.count({ where: { knownTo: null } }),
    prisma.act.count({ where: { abrogated: true } }),
    prisma.pipelineRun.findFirst({ orderBy: { startedAt: 'desc' } }),
  ]);
  return {
    acts,
    versions,
    articles,
    relations,
    abrogatedActs,
    lastRun: lastRun ? { finishedAt: lastRun.finishedAt, status: lastRun.status } : null,
  };
}

type ActRow = {
  urn: string;
  title: string;
  actType: string | null;
  publicationDate: string | null;
  abrogated: boolean;
  abrogatedFrom: string | null;
  _count: { versions: number };
};

function toActSummary(row: ActRow): ActSummary {
  return {
    urn: row.urn,
    title: row.title,
    actType: row.actType,
    publicationDate: row.publicationDate,
    abrogated: row.abrogated,
    abrogatedFrom: row.abrogatedFrom,
    versionCount: row._count.versions,
  };
}

function toArticleText(row: {
  id: string;
  eId: string;
  number: string | null;
  num: string | null;
  heading: string | null;
  container: string | null;
  text: string;
  position: number;
}): ArticleText {
  return {
    id: row.id,
    eId: row.eId,
    number: row.number,
    num: row.num,
    heading: row.heading,
    container: row.container,
    text: row.text,
    position: row.position,
  };
}
