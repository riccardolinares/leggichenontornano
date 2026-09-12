/**
 * Attraversamenti del grafo, scritti in SQL.
 *
 * Il grafo sta in PostgreSQL e si percorre con `WITH RECURSIVE` (ADR 0006). Le
 * query sono qui, in chiaro, per due ragioni: perché sono la cosa che il motore
 * di livello 1 fa davvero, e perché la scheda anomalia mostra all'utente la
 * regola che l'ha generata — e una regola mostrata deve esistere in una forma
 * leggibile, non essere ricostruita a posteriori per l'interfaccia.
 *
 * Tutte le query filtrano su `knownTo IS NULL`: si interroga lo stato di
 * conoscenza corrente. Per rieseguire un controllo sullo stato di conoscenza di
 * una data passata si usa `asOfKnowledge`.
 */
import { getPrisma } from './client.js';

export interface GraphEdge {
  id: string;
  type: string;
  sourceUrn: string;
  sourceArticle: string | null;
  targetUrn: string;
  targetArticle: string | null;
  targetParagraphs: string[];
  wholeAct: boolean;
  effectiveFrom: string | null;
  evidence: string | null;
  confidence: string;
  depth: number;
}

export interface EgoNetworkNode {
  urn: string;
  title: string;
  actType: string | null;
  abrogated: boolean;
  depth: number;
}

export interface EgoNetwork {
  center: string;
  nodes: EgoNetworkNode[];
  edges: GraphEdge[];
}

/**
 * Ego-network a profondità limitata attorno a un atto.
 *
 * Profondità 1 o 2, mai libera: le reti di citazioni normative sono scale-free e
 * a profondità 3 attorno a un hub come la l. 241/1990 si ottiene mezzo corpus
 * (ADR 0003). Il limite è un parametro della query, non una raccomandazione.
 */
export async function egoNetwork(urn: string, depth: 1 | 2 = 1): Promise<EgoNetwork> {
  const prisma = getPrisma();
  const edges = await prisma.$queryRaw<GraphEdge[]>`
    WITH RECURSIVE intorno AS (
      SELECT r."id", r."type"::text, r."sourceUrn", r."sourceArticle",
             r."targetUrn", r."targetArticle", r."targetParagraphs",
             r."wholeAct", r."effectiveFrom", r."evidence", r."confidence",
             1 AS depth
      FROM "Relation" r
      WHERE r."knownTo" IS NULL
        AND (r."sourceUrn" = ${urn} OR r."targetUrn" = ${urn})

      UNION

      SELECT r."id", r."type"::text, r."sourceUrn", r."sourceArticle",
             r."targetUrn", r."targetArticle", r."targetParagraphs",
             r."wholeAct", r."effectiveFrom", r."evidence", r."confidence",
             i.depth + 1
      FROM "Relation" r
      JOIN intorno i
        ON r."sourceUrn" IN (i."sourceUrn", i."targetUrn")
        OR r."targetUrn" IN (i."sourceUrn", i."targetUrn")
      WHERE r."knownTo" IS NULL
        AND i.depth < ${depth}
    )
    SELECT DISTINCT ON (id) * FROM intorno ORDER BY id, depth ASC
  `;

  const urns = new Set<string>([urn]);
  for (const e of edges) {
    urns.add(e.sourceUrn);
    urns.add(e.targetUrn);
  }
  const acts = await prisma.act.findMany({
    where: { urn: { in: [...urns] } },
    select: { urn: true, title: true, actType: true, abrogated: true },
  });
  const depthByUrn = new Map<string, number>([[urn, 0]]);
  for (const e of edges) {
    const other = e.sourceUrn === urn ? e.targetUrn : e.sourceUrn;
    const current = depthByUrn.get(other);
    if (current === undefined || e.depth < current) depthByUrn.set(other, e.depth);
  }

  return {
    center: urn,
    nodes: acts.map((a) => ({ ...a, depth: depthByUrn.get(a.urn) ?? depth })),
    edges,
  };
}

/**
 * Catena di abrogazione che raggiunge un atto: chi lo ha abrogato, e chi ha
 * abrogato quello, e così via. È il percorso che una scheda anomalia deve poter
 * mostrare come sequenza, perché le anomalie sono percorsi, non nodi.
 */
export async function abrogationChain(urn: string, maxDepth = 10): Promise<GraphEdge[]> {
  const prisma = getPrisma();
  return prisma.$queryRaw<GraphEdge[]>`
    WITH RECURSIVE catena AS (
      SELECT r."id", r."type"::text, r."sourceUrn", r."sourceArticle",
             r."targetUrn", r."targetArticle", r."targetParagraphs",
             r."wholeAct", r."effectiveFrom", r."evidence", r."confidence",
             1 AS depth
      FROM "Relation" r
      WHERE r."knownTo" IS NULL
        AND r."type" = 'ABROGA'
        AND r."confidence" = 'alta'
        AND r."targetUrn" = ${urn}

      UNION ALL

      SELECT r."id", r."type"::text, r."sourceUrn", r."sourceArticle",
             r."targetUrn", r."targetArticle", r."targetParagraphs",
             r."wholeAct", r."effectiveFrom", r."evidence", r."confidence",
             c.depth + 1
      FROM "Relation" r
      JOIN catena c ON r."targetUrn" = c."sourceUrn"
      WHERE r."knownTo" IS NULL
        AND r."type" = 'ABROGA'
        AND r."confidence" = 'alta'
        AND c.depth < ${maxDepth}
    )
    SELECT DISTINCT ON (id) * FROM catena ORDER BY id, depth ASC
  `;
}

export interface LayeredNode {
  urn: string;
  title: string;
  /** Data che determina la posizione sull'asse x. */
  date: string | null;
  /** Strato: distanza in archi dal nodo di partenza. */
  layer: number;
}

/**
 * Dati per il DAG a strati con il tempo sull'asse x: nodi con la loro data, archi
 * con il loro tipo. Il layout vero e proprio (dagre/elkjs) è precalcolato altrove
 * e persistito, perché deve essere deterministico e citabile.
 */
export async function layeredGraph(
  urn: string,
  depth: 1 | 2 = 2,
): Promise<{ nodes: LayeredNode[]; edges: GraphEdge[] }> {
  const ego = await egoNetwork(urn, depth);
  const prisma = getPrisma();
  const acts = await prisma.act.findMany({
    where: { urn: { in: ego.nodes.map((n) => n.urn) } },
    select: { urn: true, title: true, publicationDate: true, workDate: true },
  });
  const dateByUrn = new Map(acts.map((a) => [a.urn, a.publicationDate ?? a.workDate]));
  return {
    nodes: ego.nodes.map((n) => ({
      urn: n.urn,
      title: n.title,
      date: dateByUrn.get(n.urn) ?? null,
      layer: n.depth,
    })),
    edges: ego.edges,
  };
}

/**
 * Relazioni in ingresso su un atto, filtrate per tipo. Usata dal motore per
 * chiedere «chi ha modificato questo articolo, e quando».
 */
export async function incomingRelations(
  urn: string,
  types?: readonly string[],
): Promise<GraphEdge[]> {
  const prisma = getPrisma();
  const rows = await prisma.relation.findMany({ where: { targetUrn: urn, knownTo: null } });
  return rows
    .filter((r) => !types || types.includes(r.type))
    .map((r) => ({
      id: r.id,
      type: r.type,
      sourceUrn: r.sourceUrn,
      sourceArticle: r.sourceArticle,
      targetUrn: r.targetUrn,
      targetArticle: r.targetArticle,
      targetParagraphs: r.targetParagraphs,
      wholeAct: r.wholeAct,
      effectiveFrom: r.effectiveFrom,
      evidence: r.evidence,
      confidence: r.confidence,
      depth: 1,
    }));
}

/**
 * Riesegue una lettura del grafo sullo stato di conoscenza di una data passata.
 * È ciò che rende riproducibile una segnalazione pubblicata mesi fa: si guarda
 * il grafo com'era allora, non com'è oggi.
 */
export async function asOfKnowledge(knownAt: Date): Promise<GraphEdge[]> {
  const prisma = getPrisma();
  return prisma.$queryRaw<GraphEdge[]>`
    SELECT r."id", r."type"::text, r."sourceUrn", r."sourceArticle",
           r."targetUrn", r."targetArticle", r."targetParagraphs",
           r."wholeAct", r."effectiveFrom", r."evidence", r."confidence",
           1 AS depth
    FROM "Relation" r
    WHERE r."knownFrom" <= ${knownAt}
      AND (r."knownTo" IS NULL OR r."knownTo" > ${knownAt})
  `;
}
