/**
 * Rango della fonte nella gerarchia delle fonti del diritto italiano.
 *
 * Serve ai controlli di livello 2 («fonte secondaria che deroga a fonte
 * primaria»). È volutamente grossolano e volutamente esplicito: una tabella che
 * si può leggere, discutere e correggere vale più di un'euristica sepolta in una
 * funzione.
 *
 * Numeri più bassi = rango più alto. Un atto di rango 40 che deroga a un atto di
 * rango 20 è il segnale che il livello 2 cerca.
 */
export const SOURCE_RANKS: ReadonlyArray<readonly [RegExp, number, string]> = [
  [/^costituzione$/i, 10, 'Costituzione'],
  [/^legge[._ ]costituzionale$/i, 10, 'Legge costituzionale'],
  [/^legge$/i, 20, 'Legge ordinaria'],
  [/^decreto[._ -]?legge$/i, 20, 'Decreto-legge'],
  [/^decreto[._ ]legislativo/i, 20, 'Decreto legislativo'],
  [/^regio[._ ]decreto[._ ]legislativo$/i, 20, 'Regio decreto legislativo'],
  [/^regio[._ ]decreto$/i, 25, 'Regio decreto'],
  [/^testo[._ ]unico$/i, 25, 'Testo unico'],
  [/^decreto[._ ]del[._ ]presidente[._ ]della[._ ]repubblica$/i, 30, 'D.P.R.'],
  [/^decreto[._ ]del[._ ]presidente[._ ]del[._ ]consiglio/i, 40, 'D.P.C.M.'],
  [/^decreto[._ ]ministeriale$/i, 40, 'Decreto ministeriale'],
  [/^decreto$/i, 40, 'Decreto'],
  [/^deliberazione$/i, 50, 'Deliberazione'],
  [/^circolare$/i, 60, 'Circolare'],
];

/** Rango numerico di un tipo di atto; 45 (fonte secondaria generica) se ignoto. */
export function sourceRank(actType: string | null | undefined): number {
  if (!actType) return 45;
  for (const [re, rank] of SOURCE_RANKS) {
    if (re.test(actType)) return rank;
  }
  return 45;
}

/** Etichetta leggibile del rango, per l'interfaccia. */
export function sourceRankLabel(actType: string | null | undefined): string {
  if (!actType) return 'Fonte non classificata';
  for (const [re, , label] of SOURCE_RANKS) {
    if (re.test(actType)) return label;
  }
  return 'Fonte non classificata';
}

/** Una fonte di rango `a` è gerarchicamente superiore a una di rango `b`? */
export function isHigherRank(a: number, b: number): boolean {
  return a < b;
}

/** Fonte primaria: rango pari o superiore a quello della legge ordinaria. */
export function isPrimarySource(rank: number): boolean {
  return rank <= 25;
}
