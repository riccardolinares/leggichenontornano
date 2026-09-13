/**
 * Livello 2 — Fonte secondaria che incide su fonte primaria.
 *
 * Un regolamento, un decreto ministeriale o un d.P.C.M. modifica o abroga
 * direttamente una disposizione di rango legislativo.
 *
 * Non è di per sé illegittimo: la **delegificazione** (art. 17, comma 2, della
 * l. 400/1988) è esattamente il meccanismo che lo consente, purché una legge
 * autorizzi il regolamento e indichi le norme da abrogare. Per questo il
 * controllo sta al livello 2 e non al livello 1, la precisione attesa è più
 * bassa, e la scheda dichiara l'ipotesi alternativa invece di nasconderla.
 *
 * Quando nel grafo esiste un arco che collega il regolamento a una legge di
 * autorizzazione, il caso non viene segnalato.
 */
import type { Check } from '../../types.js';
import type { CorpusView } from '../../corpus-view.js';
import { noResolution, resolutionsFor } from '../../resolution.js';
import {
  actLabel,
  dateLabel,
  findingId,
  graphEvidence,
  partitionLabel,
  withPartition,
} from '../helpers.js';

/** Soglia: rango <= 25 è fonte primaria, rango >= 30 è fonte secondaria. */
const PRIMARIA = 25;
const SECONDARIA = 30;

export const FONTE_SECONDARIA_SU_PRIMARIA: Check<CorpusView> = {
  definition: {
    id: 'fonte-secondaria-su-primaria',
    level: 2,
    label: 'Fonte secondaria che incide su fonte primaria',
    description:
      'Un atto di rango regolamentare modifica o abroga direttamente una disposizione di rango legislativo.',
    rule: [
      'SELECT r.sourceUrn, r.targetUrn, r.targetArticle',
      'FROM Relation r',
      'JOIN Act fonte     ON fonte.urn = r.sourceUrn',
      'JOIN Act bersaglio ON bersaglio.urn = r.targetUrn',
      'WHERE r.type IN (MODIFICA, ABROGA, SOSTITUISCE) AND r.confidence = alta',
      '  AND fonte.sourceRank     >= 30      -- fonte secondaria',
      '  AND bersaglio.sourceRank <= 25      -- fonte primaria',
      '  AND NOT EXISTS (                    -- nessuna legge di autorizzazione nota',
      '        SELECT 1 FROM Relation d',
      '        WHERE d.sourceUrn = r.sourceUrn AND d.type = ATTUA',
      '      )',
    ].join('\n'),
    expectedPrecision: '70-85%: la delegificazione autorizzata è un caso legittimo e frequente',
    deterministic: true,
  },

  run(view, ctx) {
    const findings = [];

    for (const rel of view.relationsOfType('MODIFICA', 'ABROGA', 'SOSTITUISCE')) {
      const source = view.act(rel.sourceUrn);
      const target = view.act(rel.targetUrn);
      if (!source || !target) continue;
      if (source.sourceRank < SECONDARIA) continue;
      if (target.sourceRank > PRIMARIA) continue;

      // Se il grafo conosce una legge che autorizza questo atto, siamo davanti a
      // una delegificazione e non a un'anomalia.
      const authorised = view
        .relationsFrom(rel.sourceUrn)
        .some((r) => r.type === 'ATTUA' && r.confidence === 'alta');
      if (authorised) continue;

      const sourceName = actLabel(source, rel.sourceUrn);
      const targetName = actLabel(target, rel.targetUrn);
      const partition = partitionLabel(rel.targetArticle, rel.targetParagraphs);
      const verb = rel.type === 'ABROGA' ? 'abroga' : 'modifica';

      findings.push({
        id: findingId(
          'fonte-secondaria-su-primaria',
          rel.sourceUrn,
          rel.targetUrn,
          rel.targetArticle,
          rel.type,
        ),
        checkId: 'fonte-secondaria-su-primaria',
        level: 2 as const,
        title: `${sourceName}, fonte secondaria, ${verb} ${partition} di una fonte primaria`,
        plainLanguage: [
          `${sourceName} è un atto di rango regolamentare, ${targetName} è un atto di rango legislativo.`,
          `Il primo ${verb} direttamente ${partition} del secondo, con effetto dal ${dateLabel(rel.effectiveFrom)}.`,
          'Un atto di rango inferiore che incide su uno di rango superiore è possibile solo se una legge lo autorizza espressamente: nel nostro grafo quell’autorizzazione non risulta.',
        ].join(' '),
        urns: [rel.sourceUrn, withPartition(rel.targetUrn, rel.targetArticle)],
        windowFrom: rel.effectiveFrom,
        windowTo: null,
        rule: FONTE_SECONDARIA_SU_PRIMARIA.definition.rule,
        evidence: [
          graphEvidence(
            rel.sourceUrn,
            `${sourceName} — rango classificato: ${source.sourceRank}`,
            rel.evidence ?? `Relazione ${rel.type} verso ${rel.targetUrn}`,
            { from: rel.effectiveFrom },
          ),
          graphEvidence(
            rel.targetUrn,
            `${targetName} — rango classificato: ${target.sourceRank}`,
            `Atto di rango legislativo colpito da ${partition}.`,
          ),
        ],
        resolutions: [
          ...resolutionsFor(source, target),
          noResolution(
            'Se una legge ha autorizzato la delegificazione ai sensi dell’art. 17, comma 2, della l. 400/1988, l’intervento è legittimo e questa segnalazione è un falso positivo. Il grafo non conosce quella legge di autorizzazione: la verifica va fatta sul preambolo dell’atto.',
          ),
        ],
        severity: 'media' as const,
      });

      if (ctx.limit && findings.length >= ctx.limit) break;
    }

    return findings;
  },
};
