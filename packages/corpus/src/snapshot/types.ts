/**
 * Formato del dataset derivato.
 *
 * Il dataset è pubblicato come release artifact in JSONL: una riga per record,
 * un file per tipo. Non è un formato elegante, è un formato che si legge con
 * `grep`, si carica in qualunque strumento e non richiede di installare niente
 * per verificarci sopra una nostra affermazione.
 *
 * È anche la sorgente da cui il sito viene generato staticamente: sito e dataset
 * non possono divergere perché sono la stessa cosa letta due volte.
 */

export interface SnapshotAct {
  urn: string;
  title: string;
  actType: string | null;
  authority: string | null;
  sourceRank: number;
  publicationDate: string | null;
  gazzettaNumber: string | null;
  abrogated: boolean;
  abrogatedFrom: string | null;
  abrogatedBy: string | null;
  versionCount: number;
}

export interface SnapshotVersion {
  id: string;
  actUrn: string;
  ordinal: number;
  inForceFrom: string;
  inForceTo: string | null;
  consolidated: boolean;
  dateConflict: string | null;
}

export interface SnapshotArticle {
  id: string;
  versionId: string;
  actUrn: string;
  eId: string;
  number: string | null;
  num: string | null;
  heading: string | null;
  container: string | null;
  principal: boolean;
  text: string;
  position: number;
}

export interface SnapshotRelation {
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

/**
 * Il confronto fatto da un modello, sulle sole segnalazioni di livello 4.
 *
 * Sta in un campo separato e opzionale: una segnalazione che non ce l'ha non
 * contiene una riga di prosa generata da nessuna parte, e chi legge il dataset
 * lo sa senza doverci credere sulla parola.
 */
export interface SnapshotAnalisiAssistita {
  modello: string;
  confidenza: 'alta' | 'media' | 'bassa';
  ragionamento: string;
  citazioni: unknown;
}

export interface SnapshotAnomaly {
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
  computedAt: string;
  /**
   * Quando questa segnalazione è comparsa per la prima volta.
   *
   * Non coincide con `computedAt`, che dice quando è girata l'ultima analisi:
   * una segnalazione trovata a marzo e ancora viva oggi ha `computedAt` di
   * oggi e `firstSeenAt` di marzo. È la differenza fra «cosa c'è» e «cosa è
   * nuovo», e serve per dire cosa abbiamo trovato per ultimo.
   */
  firstSeenAt: string;
  /** Presente solo sulle segnalazioni di livello 4. */
  assistita?: SnapshotAnalisiAssistita | null;
}

/**
 * Una pronuncia della Corte costituzionale che ha colpito una norma del corpus.
 *
 * Nel dataset sta in un file suo, non fra gli atti: una sentenza non è un atto
 * normativo e non deve comparire nell'elenco delle norme. Il legame con la
 * norma colpita passa dagli archi `DICHIARA_ILLEGITTIMO`, la cui sorgente è
 * l'ECLI.
 */
export interface SnapshotPronuncia {
  ecli: string;
  numero: string;
  anno: string;
  /** `S` sentenza, `O` ordinanza. */
  tipologia: string;
  dataDeposito: string | null;
  /** Il dispositivo: le parole con cui la Corte ha deciso. */
  dispositivo: string;
  url: string | null;
}

/**
 * L'accordo fra il dispositivo della Corte e la nota di Normattiva.
 *
 * Sta nel dataset perché è l'unica precisione misurata **senza revisione
 * umana** che il progetto possieda, e una misura che non si pubblica non serve
 * a chi deve decidere se fidarsi.
 */
export interface SnapshotConcordanza {
  confidence: string;
  archi: number;
  confermate: number;
  accordo: number;
}

/**
 * La verifica in Gazzetta Ufficiale di un mandato attuativo.
 *
 * Sta nel dataset perché è la prova. Il contatore nazionale dice quanti
 * mandati sono stati verificati e con che esito; queste righe dicono **quali**,
 * con la query esatta, l'URL interrogato e — dove il provvedimento c'è — i suoi
 * estremi e la riga che lo lega al mandato. Senza, il numero andrebbe creduto
 * sulla parola, e questo progetto esiste per non chiederlo.
 *
 * Le righe `non-verificabile` restano nel dataset come le altre: sapere dove la
 * verifica non arriva è un'informazione, e nasconderla farebbe sembrare la
 * copertura migliore di com'è.
 */
export interface SnapshotVerifica {
  /** Chiave del mandato: atto, articolo, comma e termine. */
  id: string;
  actUrn: string;
  articleNumber: string | null;
  provisionNumber: string | null;
  /** Strumento previsto, come lo nomina il testo della legge. */
  strumento: string;
  deadlineDays: number;
  dueBy: string | null;
  /** La frase del comma da cui il mandato è stato letto. */
  mandato: string;
  /** `adottato` | `non-adottato` | `non-verificabile` */
  esito: string;
  /** Perché questo esito, in lingua comune. */
  motivo: string;
  /** La frase esatta cercata in Gazzetta Ufficiale. */
  query: string;
  url: string;
  fonte: string;
  finestraDa: number;
  finestraA: number;
  risultati: number;
  verificatoIl: string;
  provvedimentoTipo: string | null;
  provvedimentoTitolo: string | null;
  /** Il fascicolo, es. `GU n.284 del 5-12-2017`. */
  gazzetta: string | null;
  gazzettaData: string | null;
  codiceRedazionale: string | null;
  provvedimentoUrl: string | null;
  /** La citazione letterale su cui si basa la corrispondenza. */
  citazione: string | null;
}

export interface SnapshotCheckMetric {
  checkId: string;
  label: string;
  level: number;
  /** Segnalazioni prodotte dal controllo. */
  found: number;
  /** Revisioni umane registrate su questo controllo. */
  reviewed: number;
  /** Revisioni che hanno confermato la segnalazione. */
  confirmed: number;
  /** Precisione misurata, `null` quando il campione è insufficiente. */
  precision: number | null;
  /** `true` quando il controllo ha superato il gate di pubblicazione. */
  published: boolean;
  /** Perché il controllo è (o non è) pubblicato, in lingua comune. */
  reason: string;
}

/**
 * Un verticale del layer semantico, con il confine che si è dato.
 *
 * Sta nel dataset perché la copertura del livello 3 è un limite del prodotto, e
 * i limiti del prodotto devono essere leggibili senza fidarsi di noi: qui ci
 * sono gli URN esatti degli atti confrontati, e il lettore può contarli.
 */
export interface SnapshotVertical {
  vertical: string;
  label: string;
  /** URN degli atti fondativi, dichiarati a mano. */
  roots: string[];
  /** Radici dichiarate che il corpus ingerito non contiene. */
  missingRoots: string[];
  /** Tutti gli atti su cui il livello 3 ha effettivamente lavorato. */
  acts: string[];
  /** Tipi di relazione che allargano il corpus di un passo. */
  expansion: string[];
  /** Concetti del vocabolario controllato. */
  concepts: number;
  /** Proposizioni estratte, e quante hanno un concetto (le uniche confrontabili). */
  propositions: number;
  propositionsWithConcept: number;
  extractor: string;
  computedAt: string;
}

export interface SnapshotManifest {
  /** Versione del formato del dataset. */
  formatVersion: 1;
  generatedAt: string;
  /** Stato di conoscenza del corpus a cui il dataset si riferisce. */
  knownAt: string;
  counts: {
    acts: number;
    versions: number;
    articles: number;
    relations: number;
    anomalies: number;
    publishedAnomalies: number;
    /** Pronunce della Corte costituzionale incluse, quando ce ne sono. */
    pronunce?: number;
    /** Verifiche in Gazzetta Ufficiale incluse, quando ce ne sono. */
    verifiche?: number;
  };
  sources: Array<{
    name: string;
    collection?: string;
    format?: string;
    licence: string;
    retrievedAt?: string;
    sha256?: string;
  }>;
  /**
   * Accordo fra le declaratorie lette dai dispositivi della Corte e le note di
   * aggiornamento che Normattiva scrive negli atti colpiti. Due fonti
   * indipendenti: l'accordo è una misura, non un controllo circolare.
   */
  concordanzaPronunce?: SnapshotConcordanza[];
  /** Soglia di pubblicazione vigente, ripetuta nel dataset perché ci si possa fare affidamento. */
  publicationThreshold: { minPrecision: number; minSample: number };
  disclaimer: string;
}

/**
 * Il contatore nazionale.
 *
 * Deve essere deterministico, crescente e con un referente concreto: «giorni di
 * ritardo accumulati dai provvedimenti attuativi previsti e mai adottati» è una
 * frase che si può verificare, «indice di disfunzione normativa» non lo è.
 */
export interface SnapshotCounter {
  label: string;
  totalDaysLate: number;
  mandates: number;
  acts: number;
  /** Mandati scaduti per i quali la verifica in Gazzetta è stata fatta. */
  verified: number;
  /**
   * Dei verificati, quelli il cui provvedimento risulta pubblicato **dopo** la
   * scadenza del termine. Sono i giorni che il contatore conta e che però un
   * decreto, arrivando tardi, ha chiuso.
   */
  adottatiInRitardo: number;
  /** Dei verificati, quelli per cui il provvedimento non risulta pubblicato. */
  nonAdottati: number;
  computedAt: string;
  caveat: string;
}

export const DISCLAIMER =
  "La banca dati Normattiva non ha carattere di ufficialità. L'unico testo ufficiale è quello pubblicato sulla Gazzetta Ufficiale della Repubblica Italiana, che prevale in caso di discordanza. Questo dataset è un'elaborazione automatica e non costituisce consulenza legale.";

export const ATTRIBUTION =
  'Elaborazione su dati Normattiva (dati.normattiva.it), licenza CC BY 4.0.';
