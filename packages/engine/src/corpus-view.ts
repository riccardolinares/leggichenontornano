/**
 * La proiezione del corpus su cui girano i controlli.
 *
 * I controlli sono funzioni pure: ricevono questa struttura e restituiscono
 * segnalazioni. Non aprono connessioni, non fanno query, non scrivono. È ciò che
 * permette di scriverne i test su un corpus di tre atti costruito a mano e di
 * essere sicuri che sul corpus vero facciano la stessa cosa.
 *
 * **Sulla scala.** La vista tiene in memoria atti, versioni e relazioni; gli
 * articoli sono indicizzati per versione. Con il corpus statale completo
 * (centinaia di migliaia di atti) questo non regge in un solo processo: il
 * runner costruisce la vista **a lotti**, un insieme di atti alla volta insieme
 * al loro intorno nel grafo, perché i controlli di livello 1 hanno tutti raggio
 * finito. Il tipo è lo stesso, cambia solo quanto ci si mette dentro.
 */

export interface ActView {
  urn: string;
  title: string;
  actType: string | null;
  sourceRank: number;
  publicationDate: string | null;
  /** Data di entrata in vigore della prima versione. */
  inForceFrom: string | null;
  abrogated: boolean;
  abrogatedFrom: string | null;
  abrogatedBy: string | null;
}

export interface VersionView {
  id: string;
  actUrn: string;
  inForceFrom: string;
  inForceTo: string | null;
}

export interface ArticleView {
  versionId: string;
  actUrn: string;
  number: string | null;
  heading: string | null;
  text: string;
  /** `true` per gli articoli del corpo principale dell'atto. */
  principal: boolean;
}

export interface ProvisionView {
  id: string;
  actUrn: string;
  articleNumber: string | null;
  number: string | null;
  kind: string;
  text: string;
  inForceFrom: string;
  inForceTo: string | null;
}

export interface RelationView {
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
  origin: string;
}

export interface CorpusViewData {
  acts: ActView[];
  versions: VersionView[];
  articles: ArticleView[];
  relations: RelationView[];
  provisions?: ProvisionView[];
  /** URN degli atti di cui abbiamo almeno una versione consolidata (multivigente). */
  consolidatedActs?: string[];
}

export class CorpusView {
  readonly acts: ReadonlyMap<string, ActView>;
  readonly relations: readonly RelationView[];
  readonly provisions: readonly ProvisionView[];
  /** Atti di cui possediamo almeno una versione consolidata. */
  readonly consolidated: ReadonlySet<string>;
  private readonly versionsByAct: Map<string, VersionView[]>;
  private readonly articlesByVersion: Map<string, ArticleView[]>;

  constructor(data: CorpusViewData) {
    this.acts = new Map(data.acts.map((a) => [a.urn, a]));
    this.relations = data.relations;
    this.provisions = data.provisions ?? [];
    this.consolidated = new Set(data.consolidatedActs ?? []);
    this.versionsByAct = new Map();
    for (const v of data.versions) {
      const list = this.versionsByAct.get(v.actUrn);
      if (list) list.push(v);
      else this.versionsByAct.set(v.actUrn, [v]);
    }
    for (const list of this.versionsByAct.values()) {
      list.sort((a, b) => (a.inForceFrom < b.inForceFrom ? -1 : a.inForceFrom > b.inForceFrom ? 1 : 0));
    }
    this.articlesByVersion = new Map();
    for (const a of data.articles) {
      const list = this.articlesByVersion.get(a.versionId);
      if (list) list.push(a);
      else this.articlesByVersion.set(a.versionId, [a]);
    }
  }

  act(urn: string): ActView | null {
    return this.acts.get(urn) ?? null;
  }

  /** `true` quando l'atto è nel corpus ingerito. Distinto da «non ha anomalie». */
  hasAct(urn: string): boolean {
    return this.acts.has(urn);
  }

  versions(urn: string): readonly VersionView[] {
    return this.versionsByAct.get(urn) ?? [];
  }

  versionAt(urn: string, date: string): VersionView | null {
    let found: VersionView | null = null;
    for (const v of this.versions(urn)) {
      if (v.inForceFrom <= date) found = v;
      else break;
    }
    return found;
  }

  articlesAt(urn: string, date: string): readonly ArticleView[] {
    const version = this.versionAt(urn, date);
    if (!version) return [];
    return this.articlesByVersion.get(version.id) ?? [];
  }

  articleAt(urn: string, articleNumber: string, date: string): ArticleView | null {
    const wanted = articleNumber.toLowerCase();
    const candidates = this.articlesAt(urn, date).filter((a) => a.number === wanted);
    return candidates.find((a) => a.principal) ?? candidates[0] ?? null;
  }

  /** I numeri di articolo presenti in un atto a una data. */
  articleNumbersAt(urn: string, date: string): Set<string> {
    const out = new Set<string>();
    for (const a of this.articlesAt(urn, date)) {
      if (a.number) out.add(a.number);
    }
    return out;
  }

  /**
   * Abbiamo il testo di quest'atto **come era** alla data indicata, o solo il
   * testo originale?
   *
   * La distinzione decide se un controllo può parlare. Se del d.lgs. 50/2016
   * abbiamo solo il testo del 2016 e un rinvio del 2022 punta al suo art. 3-bis,
   * l'articolo può benissimo essere stato introdotto nel 2019: non lo sappiamo,
   * e dirlo assente sarebbe una segnalazione falsa su una legge.
   *
   * Copertura significa: esiste una versione consolidata che copre quella data,
   * oppure la data cade dentro la finestra chiusa di una versione che abbiamo.
   */
  hasTextCoverageAt(urn: string, date: string): boolean {
    const version = this.versionAt(urn, date);
    if (!version) return false;
    if (version.inForceTo !== null && version.inForceTo >= date) return true;
    // Ultima versione nota, aperta a destra: copre la data solo se l'atto è
    // distribuito in forma multivigente, cioè se abbiamo più di una versione o
    // se quella che abbiamo è una consolidata.
    return this.versions(urn).length > 1 || this.consolidated.has(urn);
  }

  /**
   * Un atto risulta abrogato alla data indicata?
   *
   * Se la data di efficacia dell'abrogazione non è nota, l'abrogazione conta
   * comunque: un atto che il grafo dice abrogato è abrogato, e ignorarlo perché
   * manca una data produrrebbe silenzio proprio sui casi peggio documentati.
   */
  isAbrogatedAt(urn: string, date: string): boolean {
    const act = this.acts.get(urn);
    if (!act || !act.abrogated) return false;
    if (!act.abrogatedFrom) return true;
    return act.abrogatedFrom <= date;
  }

  relationsFrom(urn: string): RelationView[] {
    return this.relations.filter((r) => r.sourceUrn === urn);
  }

  relationsTo(urn: string): RelationView[] {
    return this.relations.filter((r) => r.targetUrn === urn);
  }

  /** Tutte le relazioni ad alta confidenza di un certo tipo. */
  relationsOfType(...types: string[]): RelationView[] {
    const set = new Set(types);
    return this.relations.filter((r) => set.has(r.type) && r.confidence === 'alta');
  }

  provisionsOf(urn: string): ProvisionView[] {
    return this.provisions.filter((p) => p.actUrn === urn);
  }
}
