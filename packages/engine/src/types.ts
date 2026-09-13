/**
 * I tipi del motore delle anomalie.
 *
 * Per tre livelli su quattro vale la regola di sempre: `plainLanguage` viene da
 * un template deterministico del singolo controllo, `rule` è la regola
 * serializzata in chiaro, `evidence` contiene citazioni testuali con il loro
 * URN, e non esiste un campo libero in cui un verdetto possa entrare (ADR 0001).
 *
 * Il **livello 4** è l'eccezione, ed è dichiarata: `assistita` è il campo in cui
 * entra il ragionamento di un modello che ha confrontato due norme. Esiste
 * perché ci sono contrasti che nessuna query trova — due disposizioni che si
 * escludono a vicenda senza condividere una parola — e rinunciarci significava
 * lasciarli fuori dal sito (ADR 0011).
 *
 * Il campo è **opzionale e separato**: nessun controllo dei livelli 1-3 lo
 * riempie, e una segnalazione che ce l'ha si riconosce dal tipo prima ancora
 * che dalla pagina. È il contrario di infilare prosa generata dentro
 * `plainLanguage`, dove si confonderebbe con il resto.
 */

export type AnomalyLevel = 1 | 2 | 3 | 4;

export type Severity = 'alta' | 'media' | 'bassa';

/** Una prova: un frammento di testo con la sua provenienza esatta. */
export interface EvidenceItem {
  /** URN della norma da cui la prova proviene, con partizione quando nota. */
  urn: string;
  /** Etichetta leggibile, es. «art. 6, comma 1». */
  label: string;
  /** Testo citato letteralmente, mai riscritto. */
  quote: string;
  /** Finestra di vigenza del testo citato. */
  inForceFrom?: string | null;
  inForceTo?: string | null;
  /** Come siamo arrivati a questa prova: `grafo`, `testo`, `metadato`. */
  kind: 'grafo' | 'testo' | 'metadato';
}

/**
 * Un criterio classico di risoluzione delle antinomie.
 *
 * La riga compare su **ogni** scheda, anche quando dice che nessun criterio si
 * applica: se comparisse a intermittenza, la sua assenza diventerebbe un segnale
 * ambiguo e il lettore inizierebbe a interpretarla.
 */
export interface Resolution {
  criterion: 'specialita' | 'posteriorita' | 'gerarchia' | 'nessuno';
  /** `si-applica` | `non-si-applica` | `da-valutare` */
  status: 'si-applica' | 'non-si-applica' | 'da-valutare';
  /** Motivazione da template, mai generata. */
  explanation: string;
}

/**
 * Quello che un modello ha concluso confrontando due norme, e su cosa.
 *
 * Ogni campo ha una funzione precisa nel rendere la conclusione contestabile:
 *
 * - `citazioni` sono porzioni **letterali** dei due testi, ricontrollate dal
 *   codice: se una citazione non compare alla lettera nel testo da cui dice di
 *   venire, la segnalazione viene scartata prima di esistere;
 * - `confidenza` è dichiarata dal modello e mostrata al lettore, perché «forse»
 *   e «certamente» non vanno nello stesso indice senza distinzione;
 * - `ragionamento` è prosa, ed è l'unico punto del dataset in cui ce n'è di
 *   generata. Sta in un campo suo, etichettato, che la pagina mostra come tale.
 */
export interface AnalisiAssistita {
  /** Identificatore del modello e versione delle istruzioni. */
  modello: string;
  confidenza: 'alta' | 'media' | 'bassa';
  /** Perché le due disposizioni non stanno insieme, secondo il modello. */
  ragionamento: string;
  /** Le porzioni letterali su cui la conclusione poggia, una per norma. */
  citazioni: EvidenceItem[];
}

/** Una segnalazione prodotta da un controllo. */
export interface AnomalyFinding {
  /** Identificatore stabile: due esecuzioni sullo stesso corpus lo riproducono. */
  id: string;
  checkId: string;
  level: AnomalyLevel;
  /** Titolo come frase leggibile ad alta voce, da template del controllo. */
  title: string;
  /** «Cosa succede in pratica», in lingua comune, da template del controllo. */
  plainLanguage: string;
  /** URN coinvolti, in ordine di rilevanza. */
  urns: string[];
  /** Finestra in cui l'anomalia sussiste. */
  windowFrom: string | null;
  windowTo: string | null;
  /** La regola, in chiaro, mostrata nel dettaglio tecnico della scheda. */
  rule: string;
  evidence: EvidenceItem[];
  resolutions: Resolution[];
  severity: Severity;
  /**
   * Presente **solo** sulle segnalazioni di livello 4.
   *
   * La sua assenza è essa stessa un'informazione: una segnalazione senza questo
   * campo non ha una riga di prosa generata da nessuna parte.
   */
  assistita?: AnalisiAssistita;
}

/** Il contesto che un controllo riceve: solo letture, mai scritture. */
export interface CheckContext {
  /** Data di riferimento per «oggi». Esplicita, così i test sono deterministici. */
  today: string;
  /** Limite di segnalazioni per controllo; utile nei giri di prova. */
  limit?: number;
}

/**
 * Definizione di un controllo.
 *
 * `rule` è la regola in forma leggibile, ed è la stessa stringa che finisce
 * nella scheda. Non è documentazione: è il contratto fra ciò che il codice fa e
 * ciò che diciamo di fare.
 */
export interface CheckDefinition {
  id: string;
  level: AnomalyLevel;
  /** Etichetta breve per i filtri dell'indice. */
  label: string;
  /** Che cosa cerca, in una frase, in lingua comune. */
  description: string;
  /** La regola in chiaro, mostrata all'utente nel dettaglio tecnico. */
  rule: string;
  /** Precisione attesa dichiarata a priori, per confronto con quella misurata. */
  expectedPrecision: string;
  /**
   * `true` se il controllo non usa alcuna estrazione da modello. I controlli
   * deterministici sono gli unici che partono pubblicabili per costruzione.
   */
  deterministic: boolean;
  /**
   * `true` quando il confronto lo fa un modello, non una query.
   *
   * Distinto da `!deterministic`: il livello 3 usa un modello per **estrarre**
   * campi e poi confronta con una query, il livello 4 gli fa fare il confronto.
   * Sono due gradi di fiducia diversi e vanno detti diversamente.
   */
  assistito?: boolean;
}

/** Un controllo eseguibile. */
export interface Check<TInput> {
  definition: CheckDefinition;
  run(input: TInput, ctx: CheckContext): AnomalyFinding[];
}
