/**
 * Lettore del dataset: la stessa interfaccia di lettura del database, servita da
 * file JSONL.
 *
 * Esiste perché il sito si genera staticamente dal dataset (nessun database al
 * momento della build) e perché chi scarica il dataset deve poter rieseguire le
 * nostre interrogazioni con lo stesso codice che usiamo noi. Se le due letture
 * divergessero, il dataset smetterebbe di essere una prova.
 */
import { readJson, readJsonl, snapshotPath } from './io.js';
import type {
  SnapshotAct,
  SnapshotAnomaly,
  SnapshotArticle,
  SnapshotCheckMetric,
  SnapshotCounter,
  SnapshotVertical,
  SnapshotPronuncia,
  SnapshotVerifica,
  SnapshotManifest,
  SnapshotRelation,
  SnapshotVersion,
} from './types.js';

export interface SnapshotData {
  acts: SnapshotAct[];
  versions: SnapshotVersion[];
  articles: SnapshotArticle[];
  relations: SnapshotRelation[];
  anomalies: SnapshotAnomaly[];
  metrics: SnapshotCheckMetric[];
  manifest: SnapshotManifest | null;
  counter?: SnapshotCounter | null;
  verticals?: SnapshotVertical[];
  pronunce?: SnapshotPronuncia[];
  verifiche?: SnapshotVerifica[];
}

export class SnapshotReader {
  readonly data: SnapshotData;
  private readonly actByUrn: Map<string, SnapshotAct>;
  private readonly versionsByAct: Map<string, SnapshotVersion[]>;
  private readonly articlesByVersion: Map<string, SnapshotArticle[]>;
  private readonly anomalyById: Map<string, SnapshotAnomaly>;
  private readonly anomaliesByUrn: Map<string, SnapshotAnomaly[]>;

  constructor(data: SnapshotData) {
    this.data = data;
    this.actByUrn = new Map(data.acts.map((a) => [a.urn, a]));
    this.versionsByAct = groupBy(data.versions, (v) => v.actUrn);
    for (const list of this.versionsByAct.values()) {
      list.sort((a, b) =>
        a.inForceFrom < b.inForceFrom ? -1 : a.inForceFrom > b.inForceFrom ? 1 : 0,
      );
    }
    this.articlesByVersion = groupBy(data.articles, (a) => a.versionId);
    for (const list of this.articlesByVersion.values())
      list.sort((a, b) => a.position - b.position);
    this.anomalyById = new Map(data.anomalies.map((a) => [a.id, a]));
    this.anomaliesByUrn = new Map();
    for (const anomaly of data.anomalies) {
      for (const urn of anomaly.urns) {
        const list = this.anomaliesByUrn.get(urn);
        if (list) list.push(anomaly);
        else this.anomaliesByUrn.set(urn, [anomaly]);
      }
    }
  }

  static fromDirectory(dir: string): SnapshotReader {
    return new SnapshotReader({
      acts: readJsonl<SnapshotAct>(snapshotPath(dir, 'acts')),
      versions: readJsonl<SnapshotVersion>(snapshotPath(dir, 'versions')),
      articles: readJsonl<SnapshotArticle>(snapshotPath(dir, 'articles')),
      relations: readJsonl<SnapshotRelation>(snapshotPath(dir, 'relations')),
      anomalies: readJsonl<SnapshotAnomaly>(snapshotPath(dir, 'anomalies')),
      metrics: readJson<SnapshotCheckMetric[]>(snapshotPath(dir, 'metrics'), []),
      manifest: readJson<SnapshotManifest | null>(snapshotPath(dir, 'manifest'), null),
      counter: readJson<SnapshotCounter | null>(snapshotPath(dir, 'counter'), null),
      verticals: readJson<SnapshotVertical[]>(snapshotPath(dir, 'verticals'), []),
      pronunce: readJsonl<SnapshotPronuncia>(snapshotPath(dir, 'pronunce')),
      verifiche: readJsonl<SnapshotVerifica>(snapshotPath(dir, 'verifiche')),
    });
  }

  act(urn: string): SnapshotAct | null {
    return this.actByUrn.get(urn) ?? null;
  }

  versions(urn: string): SnapshotVersion[] {
    return this.versionsByAct.get(urn) ?? [];
  }

  /** Versione vigente alla data indicata; `null` prima dell'entrata in vigore. */
  versionAt(urn: string, date?: string): SnapshotVersion | null {
    const when = date ?? todayIso();
    const versions = this.versions(urn);
    let found: SnapshotVersion | null = null;
    for (const v of versions) {
      if (v.inForceFrom <= when) found = v;
      else break;
    }
    return found;
  }

  articles(versionId: string): SnapshotArticle[] {
    return this.articlesByVersion.get(versionId) ?? [];
  }

  articlesAt(urn: string, date?: string): SnapshotArticle[] {
    const version = this.versionAt(urn, date);
    return version ? this.articles(version.id) : [];
  }

  articleAt(
    urn: string,
    articleNumber: string,
    date?: string,
  ): { version: SnapshotVersion; article: SnapshotArticle } | null {
    const version = this.versionAt(urn, date);
    if (!version) return null;
    const wanted = articleNumber.toLowerCase();
    const candidates = this.articles(version.id).filter((a) => a.number === wanted);
    const article = candidates.find((a) => a.principal) ?? candidates[0];
    return article ? { version, article } : null;
  }

  /**
   * Storia di un articolo, con le finestre in cui il testo non è cambiato
   * accorpate: la barra di multivigenza mostra i cambiamenti, non le versioni.
   */
  articleHistory(
    urn: string,
    articleNumber: string,
  ): Array<{ from: string; to: string | null; text: string | null; heading: string | null }> {
    const wanted = articleNumber.toLowerCase();
    const out: Array<{
      from: string;
      to: string | null;
      text: string | null;
      heading: string | null;
    }> = [];
    for (const version of this.versions(urn)) {
      const candidates = this.articles(version.id).filter((a) => a.number === wanted);
      const article = candidates.find((a) => a.principal) ?? candidates[0] ?? null;
      const previous = out[out.length - 1];
      if (previous && previous.text === (article?.text ?? null)) {
        previous.to = version.inForceTo;
        continue;
      }
      out.push({
        from: version.inForceFrom,
        to: version.inForceTo,
        text: article?.text ?? null,
        heading: article?.heading ?? null,
      });
    }
    return out;
  }

  anomaly(id: string): SnapshotAnomaly | null {
    return this.anomalyById.get(id) ?? null;
  }

  /** Solo le anomalie che hanno superato il gate di pubblicazione. */
  publishedAnomalies(): SnapshotAnomaly[] {
    return this.data.anomalies.filter((a) => a.published);
  }

  anomaliesFor(urn: string): SnapshotAnomaly[] {
    return (this.anomaliesByUrn.get(urn) ?? []).filter((a) => a.published);
  }

  /** Archi in uscita e in ingresso su un atto: l'ego-network a profondità 1. */
  egoNetwork(urn: string): { nodes: SnapshotAct[]; edges: SnapshotRelation[] } {
    const edges = this.data.relations.filter((r) => r.sourceUrn === urn || r.targetUrn === urn);
    const urns = new Set<string>([urn]);
    for (const e of edges) {
      urns.add(e.sourceUrn);
      urns.add(e.targetUrn);
    }
    const nodes: SnapshotAct[] = [];
    for (const u of urns) {
      const act = this.actByUrn.get(u);
      if (act) nodes.push(act);
    }
    return { nodes, edges };
  }

  /** Il contatore nazionale, quando la pipeline lo ha generato. */
  counter(): SnapshotCounter | null {
    return this.data.counter ?? null;
  }

  /** I verticali del layer semantico, con il confine per atti che si sono dati. */
  verticals(): SnapshotVertical[] {
    return this.data.verticals ?? [];
  }

  /**
   * Le pronunce che hanno dichiarato illegittima una norma di questo atto.
   *
   * Si passa dagli archi, non da un campo sull'atto: la relazione è tipizzata
   * e datata, e un flag «questo atto ha preso una pronuncia» perderebbe quale
   * articolo, da quando, e con quali parole.
   */
  pronunceSuAtto(
    urn: string,
  ): Array<{ pronuncia: SnapshotPronuncia; relazioni: SnapshotRelation[] }> {
    const archi = this.data.relations.filter(
      (r) => r.type === 'DICHIARA_ILLEGITTIMO' && r.targetUrn === urn,
    );
    if (archi.length === 0) return [];
    const perEcli = new Map<string, SnapshotRelation[]>();
    for (const a of archi) {
      const lista = perEcli.get(a.sourceUrn);
      if (lista) lista.push(a);
      else perEcli.set(a.sourceUrn, [a]);
    }
    const out: Array<{ pronuncia: SnapshotPronuncia; relazioni: SnapshotRelation[] }> = [];
    for (const [ecli, relazioni] of perEcli) {
      const pronuncia = (this.data.pronunce ?? []).find((p) => p.ecli === ecli);
      if (pronuncia) out.push({ pronuncia, relazioni });
    }
    return out.sort((a, b) => perDepositoDecrescente(a.pronuncia, b.pronuncia));
  }

  /** Tutte le pronunce del dataset, dalla più recente. */
  pronunce(): SnapshotPronuncia[] {
    return [...(this.data.pronunce ?? [])].sort(perDepositoDecrescente);
  }

  /** Una pronuncia per ECLI, che è l'identificatore che la Corte le dà. */
  pronuncia(ecli: string): SnapshotPronuncia | null {
    return (this.data.pronunce ?? []).find((p) => p.ecli === ecli) ?? null;
  }

  /**
   * Le norme colpite da una pronuncia: il verso opposto di `pronunceSuAtto`.
   *
   * Serve a rispondere alla domanda che si fa chi cerca una sentenza per
   * numero — «cosa ha abbattuto, di preciso» — che dal lato dell'atto non si
   * vede: dall'atto si vede cosa è stato colpito **lì**, non l'intera portata
   * della decisione.
   */
  attiColpitiDa(ecli: string): Array<{ act: SnapshotAct; relazioni: SnapshotRelation[] }> {
    const archi = this.data.relations.filter(
      (r) => r.type === 'DICHIARA_ILLEGITTIMO' && r.sourceUrn === ecli,
    );
    const perAtto = new Map<string, SnapshotRelation[]>();
    for (const a of archi) {
      const lista = perAtto.get(a.targetUrn);
      if (lista) lista.push(a);
      else perAtto.set(a.targetUrn, [a]);
    }
    const out: Array<{ act: SnapshotAct; relazioni: SnapshotRelation[] }> = [];
    for (const [urn, relazioni] of perAtto) {
      const act = this.actByUrn.get(urn);
      if (act) out.push({ act, relazioni });
    }
    return out;
  }

  metric(checkId: string): SnapshotCheckMetric | null {
    return this.data.metrics.find((m) => m.checkId === checkId) ?? null;
  }

  /**
   * Ricerca testuale semplice sul dataset. Non sostituisce la ricerca full-text
   * di PostgreSQL: serve alla generazione statica e all'uso offline del dataset,
   * e lo dichiara invece di fingersi qualcosa che non è.
   */
  search(query: string, limit = 20): Array<{ act: SnapshotAct; article: SnapshotArticle }> {
    const terms = normalizzaRicerca(query)
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2);
    if (terms.length === 0) return [];
    const out: Array<{ act: SnapshotAct; article: SnapshotArticle; score: number }> = [];
    for (const article of this.data.articles) {
      const haystack = normalizzaRicerca(`${article.heading ?? ''} ${article.text}`);
      let score = 0;
      for (const term of terms) if (haystack.includes(term)) score++;
      if (score === terms.length) {
        const act = this.actByUrn.get(article.actUrn);
        if (act) out.push({ act, article, score });
      }
    }
    return out.slice(0, limit).map(({ act, article }) => ({ act, article }));
  }
}

/**
 * Minuscole **e senza accenti**, su entrambi i lati del confronto.
 *
 * Chi cerca scrive «tracciabilita», il testo di legge dice «tracciabilità», e
 * senza questa normalizzazione la ricerca non trova niente — restituendo un
 * «nessun risultato» che somiglia a un fatto sulla legge e non lo è.
 */
function normalizzaRicerca(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Dalla più recente, e con l'uguaglianza gestita.
 *
 * Un comparatore che non restituisce mai `0` viola il contratto di `sort`:
 * due decisioni depositate lo stesso giorno — o entrambe senza data — si
 * dichiarerebbero a vicenda «viene prima», e l'ordine finale dipenderebbe
 * dall'implementazione. Qui l'ordine deve essere lo stesso ovunque, perché
 * il sito lo genera staticamente e chi rilegge il dataset deve ritrovarlo.
 */
function perDepositoDecrescente(
  a: { dataDeposito: string | null },
  b: { dataDeposito: string | null },
): number {
  const primo = a.dataDeposito ?? '';
  const secondo = b.dataDeposito ?? '';
  if (primo === secondo) return 0;
  return primo < secondo ? 1 : -1;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
