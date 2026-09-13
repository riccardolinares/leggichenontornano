/**
 * Livello 3 — Stesso adempimento, termini diversi.
 *
 * Qui si vede a cosa serviva tutto il resto. La contraddizione **non è un
 * giudizio**: è questo `JOIN`.
 *
 *   stessa modalità deontica
 *   ∧ stesso soggetto (via vocabolario controllato)
 *   ∧ fattispecie sovrapposta
 *   ∧ finestre di vigenza intersecanti
 *   ∧ valore divergente
 *
 * Il filtro temporale non è opzionale e viene applicato **per primo**: due norme
 * mai vigenti contemporaneamente non sono in contraddizione, e senza questo
 * filtro quella categoria di falsi positivi domina l'output.
 *
 * Il modello ha estratto i campi. Qui non viene interrogato: viene interrogata
 * una tabella.
 */
import type { Check } from '../../types.js';
import type { DeonticProposition } from '../../deontic/types.js';
import { VocabularyIndex } from '../../deontic/vocabulary.js';
import type { ActView } from '../../corpus-view.js';
import { noResolution, resolutionsFor } from '../../resolution.js';
import { actLabel, dateLabel, findingId, textEvidence } from '../helpers.js';

export interface TerminiInput {
  propositions: readonly DeonticProposition[];
  vocabulary: VocabularyIndex;
  /** Per costruire le righe di possibile risoluzione. */
  acts: ReadonlyMap<string, ActView>;
  /**
   * Differenza minima fra due termini perché valga la pena segnalarla, in
   * giorni. Un giorno di differenza fra «entro trenta giorni» e «entro un mese»
   * è un artefatto della conversione, non un'antinomia.
   */
  minDeltaDays?: number;
}

export const TERMINI_DIVERGENTI: Check<TerminiInput> = {
  definition: {
    id: 'termini-divergenti',
    level: 3,
    label: 'Stesso adempimento, termini diversi',
    description:
      'Due norme contemporaneamente vigenti impongono lo stesso adempimento allo stesso soggetto con termini diversi.',
    rule: [
      'SELECT a.urn, b.urn, a.deadlineDays, b.deadlineDays',
      'FROM Proposition a',
      'JOIN Proposition b ON a.id < b.id',
      'WHERE a.mode = b.mode                          -- stessa modalità deontica',
      '  AND a.subjectConcept = b.subjectConcept      -- stesso soggetto, via vocabolario',
      '  AND a.subjectConcept IS NOT NULL             -- senza concetto non si confronta',
      '  AND overlaps(a.scope, b.scope)               -- fattispecie sovrapposta',
      '  AND intersect(a.vigenza, b.vigenza) <> ∅     -- FILTRO TEMPORALE, applicato per primo',
      '  AND a.deadlineDays IS NOT NULL',
      '  AND b.deadlineDays IS NOT NULL',
      '  AND abs(a.deadlineDays - b.deadlineDays) >= sogliaDelta',
      '  AND a.urn <> b.urn',
      '',
      '-- Nessun modello linguistico partecipa a questa query. I campi confrontati',
      '-- sono stati estratti prima, uno per volta, senza che l’estrattore vedesse',
      '-- mai le due norme insieme.',
    ].join('\n'),
    expectedPrecision: '50-80%, dipende dalla qualità del vocabolario del verticale',
    deterministic: false,
  },

  run(input, ctx) {
    const findings = [];
    const minDelta = input.minDeltaDays ?? 5;

    // Si indicizza per (modalità, concetto): il prodotto cartesiano su tutte le
    // proposizioni non serve, e su un verticale vero sarebbe proibitivo.
    const buckets = new Map<string, DeonticProposition[]>();
    for (const p of input.propositions) {
      if (!p.subjectConcept || p.deadlineDays === null) continue;
      const key = `${p.mode}|${p.subjectConcept}`;
      const list = buckets.get(key);
      if (list) list.push(p);
      else buckets.set(key, [p]);
    }

    for (const group of buckets.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i]!;
          const b = group[j]!;
          if (sameAct(a.urn, b.urn)) continue;

          // Primo filtro, sempre: le vigenze devono intersecarsi.
          const window = intersect(a, b);
          if (!window) continue;

          // Le fattispecie devono sovrapporsi nella gerarchia del vocabolario.
          // Due concetti fratelli non bastano: «lavori» e «servizi» sono
          // entrambi appalti e restano cose diverse.
          if (a.scope && b.scope && !input.vocabulary.overlaps(a.scope, b.scope)) continue;

          const delta = Math.abs(a.deadlineDays! - b.deadlineDays!);
          if (delta < minDelta) continue;

          const actA = input.acts.get(baseUrn(a.urn)) ?? null;
          const actB = input.acts.get(baseUrn(b.urn)) ?? null;
          const concept = input.vocabulary.byId(a.subjectConcept!);
          const nameA = actLabel(actA, baseUrn(a.urn));
          const nameB = actLabel(actB, baseUrn(b.urn));

          findings.push({
            id: findingId('termini-divergenti', a.urn, b.urn, String(a.deadlineDays), String(b.deadlineDays)),
            checkId: 'termini-divergenti',
            level: 3 as const,
            title: `Per lo stesso adempimento, ${nameA} dà ${a.deadlineDays} giorni e ${nameB} ne dà ${b.deadlineDays}`,
            plainLanguage: [
              `Due norme in vigore nello stesso periodo impongono ${modeVerb(a.mode)} a ${concept?.label ?? a.subject}.`,
              `La prima fissa un termine di ${a.deadlineDays} giorni, la seconda di ${b.deadlineDays}: ${delta} giorni di differenza.`,
              `Le due norme sono state entrambe in vigore dal ${dateLabel(window.from)}${window.to ? ` al ${dateLabel(window.to)}` : ', e lo sono tuttora'}.`,
              'Chi deve adempiere non sa quale termine rispettare.',
            ].join(' '),
            urns: [a.urn, b.urn],
            windowFrom: window.from,
            windowTo: window.to,
            rule: TERMINI_DIVERGENTI.definition.rule,
            evidence: [
              textEvidence(a.urn, `${nameA} — estratto: termine ${a.deadlineDays} giorni`, a.quote, {
                from: a.inForceFrom,
                to: a.inForceTo,
              }),
              textEvidence(b.urn, `${nameB} — estratto: termine ${b.deadlineDays} giorni`, b.quote, {
                from: b.inForceFrom,
                to: b.inForceTo,
              }),
            ],
            resolutions: [
              ...resolutionsFor(actA, actB),
              noResolution(
                `I campi confrontati sono stati estratti automaticamente da ${a.extractor}. Prima di trarre conclusioni, controlla i due testi originali qui sopra: l’errore potrebbe stare nell’estrazione e non nella legge.`,
              ),
            ],
            severity: delta > 60 ? ('alta' as const) : ('media' as const),
          });

          if (ctx.limit && findings.length >= ctx.limit) return findings;
        }
      }
    }

    return findings;
  },
};

function modeVerb(mode: DeonticProposition['mode']): string {
  switch (mode) {
    case 'OBBLIGO':
      return 'lo stesso obbligo';
    case 'DIVIETO':
      return 'lo stesso divieto';
    case 'ONERE':
      return 'lo stesso onere';
    case 'POTERE':
      return 'lo stesso potere';
    case 'PERMESSO':
      return 'la stessa facoltà';
  }
}

function intersect(
  a: DeonticProposition,
  b: DeonticProposition,
): { from: string; to: string | null } | null {
  const from = a.inForceFrom >= b.inForceFrom ? a.inForceFrom : b.inForceFrom;
  const to = minOpen(a.inForceTo, b.inForceTo);
  if (to !== null && from > to) return null;
  return { from, to };
}

function minOpen(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a <= b ? a : b;
}

function baseUrn(urn: string): string {
  return urn.split('~')[0] ?? urn;
}

function sameAct(a: string, b: string): boolean {
  return baseUrn(a) === baseUrn(b);
}
