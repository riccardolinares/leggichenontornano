/**
 * Da linea temporale a record dello store bitemporale.
 *
 * Gli identificatori sono **derivati dal contenuto**, non generati a caso: la
 * pipeline gira ogni giorno su una GitHub Action e apre una pull request con il
 * diff. Se gli id cambiassero a ogni esecuzione, il diff sarebbe inutile e
 * nessuno si accorgerebbe più di quando il dataset smette di aggiornarsi.
 */
import { createHash } from 'node:crypto';
import type { AknProvision, Timeline } from '@leggichenontornano/akn-parser';
import { buildRelations, type RelationRecord } from '../graph/build-relations.js';
import { sourceRank } from '../source-rank.js';
import { versionKey, type CollectionFile } from './read-collection.js';

export interface ActRecord {
  urn: string;
  title: string;
  actType: string | null;
  authority: string | null;
  sourceRank: number;
  workDate: string | null;
  publicationDate: string | null;
  gazzettaNumber: string | null;
  editorialCode: string | null;
  eli: string | null;
  collection: string | null;
}

export interface VersionRecord {
  id: string;
  actUrn: string;
  ordinal: number;
  inForceFrom: string;
  inForceTo: string | null;
  consolidated: boolean;
  eli: string | null;
  checksum: string;
  sourceFile: string | null;
  dateConflict: string | null;
}

export interface ArticleRecord {
  id: string;
  versionId: string;
  eId: string;
  number: string | null;
  num: string | null;
  heading: string | null;
  partition: string | null;
  container: string | null;
  principal: boolean;
  text: string;
  position: number;
}

export interface ProvisionRecord {
  id: string;
  articleId: string;
  eId: string;
  kind: string;
  number: string | null;
  text: string;
  position: number;
}

export interface IngestBundle {
  act: ActRecord;
  versions: VersionRecord[];
  articles: ArticleRecord[];
  provisions: ProvisionRecord[];
  relations: RelationRecord[];
}

export interface BuildRecordsOptions {
  collection?: string | null;
  fileByVersion?: Map<string, CollectionFile>;
  includeReferences?: boolean;
}

export function buildRecords(timeline: Timeline, opts: BuildRecordsOptions = {}): IngestBundle {
  const first = timeline.versions[0]!;
  const latest = timeline.versions[timeline.versions.length - 1]!;
  const actType = latest.act.actType;

  const act: ActRecord = {
    urn: timeline.urn,
    title: latest.act.title || first.act.title,
    actType,
    authority: latest.act.authority,
    sourceRank: sourceRank(actType),
    workDate: latest.act.workDate,
    publicationDate: latest.act.publication?.date ?? first.act.publication?.date ?? null,
    gazzettaNumber: latest.act.publication?.number ?? null,
    editorialCode: latest.act.eli?.editorialCode ?? null,
    eli: latest.act.eli?.editorialCode ?? null,
    collection: opts.collection ?? null,
  };

  const versions: VersionRecord[] = [];
  const articles: ArticleRecord[] = [];
  const provisions: ProvisionRecord[] = [];

  for (const version of timeline.versions) {
    const file = opts.fileByVersion?.get(versionKey(timeline.urn, version.inForceFrom));
    const versionId = stableId('v', timeline.urn, version.inForceFrom);
    versions.push({
      id: versionId,
      actUrn: timeline.urn,
      ordinal: version.ordinal,
      inForceFrom: version.inForceFrom,
      inForceTo: version.inForceTo,
      consolidated: version.act.consolidated,
      eli: version.act.eli ? version.act.eli.versionKind : null,
      checksum: file?.checksum ?? stableId('c', timeline.urn, version.inForceFrom),
      sourceFile: file?.relativePath ?? null,
      dateConflict: version.dateConflict
        ? `nome file ${version.dateConflict.fromFileName}, FRBRExpression ${version.dateConflict.fromExpression}`
        : null,
    });

    version.act.articles.forEach((article, position) => {
      const articleId = stableId('a', versionId, article.eId || String(position));
      articles.push({
        id: articleId,
        versionId,
        eId: article.eId || `art_${position}`,
        number: article.number,
        num: article.num,
        heading: article.heading,
        partition: article.partition,
        container: article.container,
        principal: article.principal,
        text: article.text,
        position,
      });
      flattenProvisions(article.paragraphs, articleId, provisions);
    });
  }

  // Le relazioni si leggono dall'ultima versione disponibile: è quella che porta
  // l'analisi delle modifiche aggiornata. Le versioni precedenti ripetono le
  // stesse dichiarazioni, e duplicarle gonfierebbe il grafo senza aggiungere
  // informazione.
  const relations = buildRelations(latest.act, {
    includeReferences: opts.includeReferences,
    effectiveFrom: first.inForceFrom,
  });

  return { act, versions, articles, provisions, relations };
}

function flattenProvisions(
  items: readonly AknProvision[],
  articleId: string,
  out: ProvisionRecord[],
  prefix = '',
): void {
  items.forEach((provision, index) => {
    const eId = provision.eId || `${prefix}p${index}`;
    out.push({
      id: stableId('p', articleId, eId),
      articleId,
      eId,
      kind: provision.kind,
      number: provision.number,
      text: provision.text,
      position: out.length,
    });
    if (provision.children.length > 0) {
      flattenProvisions(provision.children, articleId, out, `${eId}.`);
    }
  });
}

/** Id deterministico: prefisso più SHA-256 troncato delle parti. */
export function stableId(prefix: string, ...parts: string[]): string {
  const hash = createHash('sha256').update(parts.join(' ')).digest('hex').slice(0, 24);
  return `${prefix}_${hash}`;
}
