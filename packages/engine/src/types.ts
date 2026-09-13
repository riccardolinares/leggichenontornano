/**
 * I tipi del motore delle anomalie.
 *
 * Una scelta di progetto vale la pena di essere dichiarata qui, perché è il
 * punto in cui potrebbe essere aggirata: **`AnomalyFinding` non ha un campo in
 * cui possa entrare una spiegazione generata da un modello linguistico**.
 *
 * `plainLanguage` è prodotto da un template deterministico di proprietà del
 * singolo controllo, `rule` è la regola serializzata in chiaro, `evidence`
 * contiene citazioni testuali con il loro URN. Non c'è un `summary` libero, non
 * c'è una `explanation`. Chi volesse infilare un verdetto di modello in una
 * segnalazione dovrebbe cambiare questa interfaccia, e il diff sarebbe visibile
 * (ADR 0001).
 */

export type AnomalyLevel = 1 | 2 | 3;

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
}

/** Un controllo eseguibile. */
export interface Check<TInput> {
  definition: CheckDefinition;
  run(input: TInput, ctx: CheckContext): AnomalyFinding[];
}
