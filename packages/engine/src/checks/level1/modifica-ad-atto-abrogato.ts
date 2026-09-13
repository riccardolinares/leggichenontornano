/**
 * Livello 1 — Modifica a una norma già abrogata.
 *
 * Un atto dispone una modifica su un articolo di un altro atto, ma a quella data
 * l'atto bersaglio risultava già abrogato. La modifica cade nel vuoto: non c'è
 * un testo su cui incidere.
 *
 * È il caso più indifendibile della tassonomia e per questo il primo controllo
 * implementato. Zero intelligenza artificiale: due archi del grafo e un
 * confronto fra date.
 */
import type { Check } from '../../types.js';
import type { CorpusView } from '../../corpus-view.js';
import { resolutionsFor } from '../../resolution.js';
import {
  actLabel,
  actTitle,
  dateLabel,
  findingId,
  graphEvidence,
  partitionLabel,
  withPartition,
} from '../helpers.js';

export const MODIFICA_AD_ATTO_ABROGATO: Check<CorpusView> = {
  definition: {
    id: 'modifica-ad-atto-abrogato',
    level: 1,
    label: 'Modifica a una norma già abrogata',
    description:
      'Un atto modifica un articolo di un altro atto che, alla data in cui la modifica prende effetto, risultava già abrogato.',
    rule: [
      'SELECT m.sourceUrn, m.targetUrn, m.targetArticle',
      'FROM Relation m                       -- la modifica',
      'JOIN Relation a                       -- l’abrogazione precedente',
      '  ON a.targetUrn = m.targetUrn',
      'WHERE m.type IN (MODIFICA, SOSTITUISCE, INTRODUCE)',
      '  AND a.type = ABROGA AND a.wholeAct = true',
      '  AND m.confidence = alta AND a.confidence = alta',
      '  AND a.effectiveFrom <= m.effectiveFrom  -- l’abrogazione viene prima',
      '  AND m.sourceUrn <> a.sourceUrn          -- non è l’atto che abroga e riordina',
    ].join('\n'),
    expectedPrecision: '~100% (attraversamento del grafo, nessuna estrazione)',
    deterministic: true,
  },

  run(view, ctx) {
    const findings = [];
    const modifications = view.relationsOfType('MODIFICA', 'SOSTITUISCE', 'INTRODUCE');

    for (const mod of modifications) {
      if (!mod.effectiveFrom) continue;
      const target = view.act(mod.targetUrn);
      if (!target || !target.abrogated || !target.abrogatedFrom) continue;

      // L'abrogazione deve precedere la modifica, non seguirla.
      if (target.abrogatedFrom > mod.effectiveFrom) continue;

      // Un atto che abroga e contestualmente riordina il testo abrogato non sta
      // sbagliando: sta facendo il suo lavoro. Si escludono le modifiche disposte
      // dallo stesso atto che ha abrogato.
      if (target.abrogatedBy === mod.sourceUrn) continue;

      const source = view.act(mod.sourceUrn);
      const abrogator = target.abrogatedBy ? view.act(target.abrogatedBy) : null;
      const partition = partitionLabel(mod.targetArticle, mod.targetParagraphs);
      const sourceName = actLabel(source, mod.sourceUrn);
      const targetName = actLabel(target, mod.targetUrn);

      findings.push({
        id: findingId(
          'modifica-ad-atto-abrogato',
          mod.sourceUrn,
          mod.targetUrn,
          mod.targetArticle,
          mod.targetParagraphs.join('.'),
        ),
        checkId: 'modifica-ad-atto-abrogato',
        level: 1 as const,
        title: `${sourceName} modifica ${partition} di un atto abrogato ${monthsBefore(target.abrogatedFrom, mod.effectiveFrom)}`,
        plainLanguage: [
          `Il ${dateLabel(mod.effectiveFrom)} ${sourceName} dispone una modifica su ${partition} di ${targetName}.`,
          `Quell'atto era però già stato abrogato il ${dateLabel(target.abrogatedFrom)}${
            abrogator ? ` da ${actLabel(abrogator, target.abrogatedBy!)}` : ''
          }.`,
          'La modifica interviene quindi su un testo che, a quella data, non era più in vigore.',
        ].join(' '),
        urns: [withPartition(mod.targetUrn, mod.targetArticle), mod.sourceUrn],
        windowFrom: mod.effectiveFrom,
        windowTo: null,
        rule: MODIFICA_AD_ATTO_ABROGATO.definition.rule,
        evidence: [
          graphEvidence(
            mod.sourceUrn,
            `Modifica disposta da ${sourceName}${actTitle(source) ? ` — ${actTitle(source)}` : ''}`,
            mod.evidence ?? `Relazione ${mod.type} verso ${mod.targetUrn}`,
            { from: mod.effectiveFrom },
          ),
          graphEvidence(
            mod.targetUrn,
            `Abrogazione di ${targetName}`,
            abrogator
              ? `Abrogato con effetto dal ${dateLabel(target.abrogatedFrom)} da ${actLabel(abrogator, target.abrogatedBy!)}.`
              : `Abrogato con effetto dal ${dateLabel(target.abrogatedFrom)}.`,
            { from: target.abrogatedFrom },
          ),
        ],
        resolutions: resolutionsFor(source, target),
        severity: 'alta' as const,
      });

      if (ctx.limit && findings.length >= ctx.limit) break;
    }

    return findings;
  },
};

/** «quattro mesi prima», «due anni prima»: serve al titolo, che deve dire qualcosa. */
function monthsBefore(abrogatedFrom: string, modifiedAt: string): string {
  const days = Math.round(
    (Date.parse(`${modifiedAt}T00:00:00Z`) - Date.parse(`${abrogatedFrom}T00:00:00Z`)) / 86_400_000,
  );
  if (days < 31) return `${days} giorni prima`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} mesi prima`;
  return `${Math.round(months / 12)} anni prima`;
}
