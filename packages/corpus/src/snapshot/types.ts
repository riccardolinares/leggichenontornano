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
  };
  sources: Array<{
    name: string;
    collection?: string;
    format?: string;
    licence: string;
    retrievedAt?: string;
    sha256?: string;
  }>;
  /** Soglia di pubblicazione vigente, ripetuta nel dataset perché ci si possa fare affidamento. */
  publicationThreshold: { minPrecision: number; minSample: number };
  disclaimer: string;
}

export const DISCLAIMER =
  'La banca dati Normattiva non ha carattere di ufficialità. L\'unico testo ufficiale è quello pubblicato sulla Gazzetta Ufficiale della Repubblica Italiana, che prevale in caso di discordanza. Questo dataset è un\'elaborazione automatica e non costituisce consulenza legale.';

export const ATTRIBUTION =
  'Elaborazione su dati Normattiva (dati.normattiva.it), licenza CC BY 4.0.';
