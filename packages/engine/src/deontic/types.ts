/**
 * Il layer semantico: proposizioni deontiche normalizzate.
 *
 * Questo è il punto in cui un modello linguistico entra nel progetto, e l'unico.
 * Entra per **estrarre struttura**, mai per giudicare (ADR 0001). Il tipo
 * `DeonticProposition` è il contratto: un estrattore riempie questi campi, e
 * nient'altro. Non c'è un campo «il modello pensa che…».
 *
 * La contraddizione, dopo, è una query su queste righe.
 */

export type DeonticMode = 'OBBLIGO' | 'DIVIETO' | 'PERMESSO' | 'POTERE' | 'ONERE';

export interface DeonticProposition {
  /** URN completo con partizione: `urn:nir:...;241~art3-com2`. */
  urn: string;
  /** Identificatore del comma da cui proviene. */
  provisionId: string;
  mode: DeonticMode;
  /** Soggetto o fattispecie, come appare nel testo. */
  subject: string;
  /**
   * Concetto del vocabolario controllato a cui il soggetto è stato ricondotto.
   * `null` quando nessun concetto corrisponde: in quel caso la proposizione non
   * entra nei confronti, perché senza vocabolario due token uguali non sono due
   * cose uguali.
   */
  subjectConcept: string | null;
  /** Oggetto della condotta. */
  object: string;
  /** Termine in giorni, quando il testo ne pone uno. */
  deadlineDays: number | null;
  /** Termine così come scritto. */
  deadlineText: string | null;
  /** Conseguenza o sanzione. */
  consequence: string | null;
  conditions: string[];
  exceptions: string[];
  /** Ambito di applicazione, dal vocabolario controllato. */
  scope: string | null;
  /** Verticale tematico attivo. */
  vertical: string;
  /** Finestra di vigenza: senza questa, il filtro temporale non è applicabile. */
  inForceFrom: string;
  inForceTo: string | null;
  /** Chi ha prodotto l'estrazione: nome e versione, per la riproducibilità. */
  extractor: string;
  /** Frase da cui l'estrazione è stata fatta, conservata come prova. */
  quote: string;
}

/**
 * Un estrattore di proposizioni.
 *
 * L'interfaccia è deliberatamente povera: prende un testo e restituisce campi.
 * Non riceve l'altra norma con cui la prima potrebbe confliggere, e quindi non
 * può esprimere un giudizio di conflitto nemmeno volendo.
 */
export interface DeonticExtractor {
  /** Nome e versione, registrati su ogni proposizione. */
  readonly name: string;
  extract(input: ExtractionInput): Promise<DeonticProposition[]> | DeonticProposition[];
}

export interface ExtractionInput {
  urn: string;
  provisionId: string;
  text: string;
  vertical: string;
  inForceFrom: string;
  inForceTo: string | null;
  /** Vocabolario controllato del verticale attivo. */
  vocabulary: Vocabulary;
}

/**
 * Vocabolario controllato di un verticale.
 *
 * È il filtro che impedisce a «impresa» negli appalti e «impresa» nel fisco di
 * essere considerate la stessa fattispecie. Gli embedding, quando ci saranno,
 * serviranno a generare candidati; la decisione resta qui.
 */
export interface Vocabulary {
  vertical: string;
  label: string;
  concepts: VocabularyConcept[];
}

export interface VocabularyConcept {
  /** Identificatore stabile del concetto, es. `stazione-appaltante`. */
  id: string;
  label: string;
  /** Forme testuali che denotano il concetto in questo dominio. */
  synonyms: string[];
  /** Concetto padre, per la gerarchia delle fattispecie. */
  broader?: string;
  /** Note per il revisore umano. */
  note?: string;
}
