/**
 * Livello 1 — Rinvio a un articolo che non esiste.
 *
 * Una norma rinvia all'«art. N» di un altro atto, ma quell'atto, nel testo
 * vigente alla data del rinvio, non ha un art. N: o non c'è mai stato, o è stato
 * soppresso.
 *
 * Il controllo gira **solo** quando l'atto bersaglio è nel corpus ingerito **e**
 * ne possediamo il testo consolidato a quella data. Non avere l'atto non è
 * un'anomalia: è una lacuna nostra, e confonderle produrrebbe segnalazioni false
 * in massa proprio mentre il corpus cresce.
 *
 * La seconda condizione è la più importante e costa recall volentieri. Se del
 * codice dei contratti pubblici abbiamo solo il testo del 2016 e un rinvio del
 * 2022 punta al suo art. 3-bis, quell'articolo può essere stato introdotto nel
 * 2019: noi non lo sappiamo, e dire «non esiste» sarebbe una segnalazione falsa
 * su una legge. Senza copertura consolidata il controllo tace.
 *
 * **Solo i rinvii, non le modifiche.** Una prima versione guardava anche le
 * relazioni `MODIFICA`, e sul corpus reale produceva questo: il d.P.R. 435/2001
 * introduce l'art. 5-bis nel d.P.R. 322/1998 (con il proprio art. 6) e poi lo
 * modifica (con il proprio art. 19). Le due relazioni portano la stessa data di
 * efficacia, e al momento in cui la si legge l'articolo «non esiste ancora»:
 * segnalarlo significherebbe accusare di un errore chi ha fatto le cose in
 * ordine. Una modifica, per natura, cambia ciò che esiste — anche aggiungendolo.
 * Un rinvio no: deve puntare a qualcosa che c'è già.
 */
import type { Check } from '../../types.js';
import type { CorpusView } from '../../corpus-view.js';
import { noResolution, resolutionsFor } from '../../resolution.js';
import { actLabel, dateLabel, findingId, graphEvidence, withPartition } from '../helpers.js';

export const RINVIO_AD_ARTICOLO_INESISTENTE: Check<CorpusView> = {
  definition: {
    id: 'rinvio-ad-articolo-inesistente',
    level: 1,
    label: 'Rinvio a un articolo che non esiste',
    description:
      'Una norma rinvia a un articolo che, nel testo vigente dell’atto richiamato, non è presente.',
    rule: [
      'SELECT r.sourceUrn, r.targetUrn, r.targetArticle',
      'FROM Relation r',
      'WHERE r.type = RINVIA AND r.confidence = alta   -- solo rinvii: una modifica puo\' aggiungere',
      '  AND r.targetArticle IS NOT NULL',
      '  AND r.targetUrn IN (SELECT urn FROM Act)      -- l’atto è nel corpus',
      '  AND haCoperturaConsolidata(r.targetUrn, r.effectiveFrom)  -- e ne abbiamo il testo a quella data',
      '  AND r.targetArticle NOT IN (',
      '        SELECT number FROM Article a',
      '        JOIN ActVersion v ON v.id = a.versionId',
      '        WHERE v.actUrn = r.targetUrn',
      '          AND v.inForceFrom <= r.effectiveFrom',
      '          AND (v.inForceTo IS NULL OR v.inForceTo >= r.effectiveFrom)',
      '      )',
      '  AND NOT EXISTS (                              -- e nessuno lo sta introducendo',
      '        SELECT 1 FROM Relation i',
      '        WHERE i.type IN (INTRODUCE, MODIFICA, SOSTITUISCE)',
      '          AND i.targetUrn = r.targetUrn',
      '          AND i.targetArticle = r.targetArticle',
      '      )',
    ].join('\n'),
    expectedPrecision:
      '~100% quando il testo del bersaglio è completo; i falsi positivi residui vengono dalla numerazione degli allegati',
    deterministic: true,
  },

  run(view, ctx) {
    const findings = [];

    // Gli articoli che il grafo dichiara introdotti o modificati da qualcuno:
    // se un articolo compare qui, la sua assenza dal nostro testo è una lacuna
    // della nostra copertura, non un buco nella legge.
    const toccati = new Set<string>();
    for (const rel of view.relationsOfType('INTRODUCE', 'MODIFICA', 'SOSTITUISCE')) {
      if (rel.targetArticle) toccati.add(`${rel.targetUrn}~art${rel.targetArticle}`);
    }

    for (const ref of view.relationsOfType('RINVIA')) {
      if (!ref.targetArticle || !ref.effectiveFrom) continue;
      if (!view.hasAct(ref.targetUrn)) continue;

      // Senza il testo consolidato a quella data non si parla: vedi sopra.
      if (!view.hasTextCoverageAt(ref.targetUrn, ref.effectiveFrom)) continue;
      if (toccati.has(`${ref.targetUrn}~art${ref.targetArticle}`)) continue;

      const numbers = view.articleNumbersAt(ref.targetUrn, ref.effectiveFrom);
      // Nessun articolo noto a quella data: non abbiamo il testo, non abbiamo
      // niente da dire. Silenzio, non segnalazione.
      if (numbers.size === 0) continue;
      if (numbers.has(ref.targetArticle)) continue;

      // Gli articoli degli allegati sono numerati a parte e rientrano nella
      // stessa lista solo quando l'allegato è stato ingerito: finché la relazione
      // dichiara un allegato, non ci si pronuncia.
      if (ref.targetParagraphs.length === 0 && /allegato/i.test(ref.evidence ?? '')) continue;

      const source = view.act(ref.sourceUrn);
      const target = view.act(ref.targetUrn);
      const sourceName = actLabel(source, ref.sourceUrn);
      const targetName = actLabel(target, ref.targetUrn);

      findings.push({
        id: findingId(
          'rinvio-ad-articolo-inesistente',
          ref.sourceUrn,
          ref.targetUrn,
          ref.targetArticle,
        ),
        checkId: 'rinvio-ad-articolo-inesistente',
        level: 1 as const,
        title: `${sourceName} rinvia all’art. ${ref.targetArticle} di ${targetName}, che non esiste`,
        plainLanguage: [
          `${sourceName} richiama l'art. ${ref.targetArticle} di ${targetName}.`,
          `Nel testo di quell'atto vigente al ${dateLabel(ref.effectiveFrom)} un art. ${ref.targetArticle} non c'è: l'atto arriva all'art. ${highest(numbers)}.`,
          'Chi cerca di applicare il rinvio non trova nulla da leggere.',
        ].join(' '),
        urns: [ref.sourceUrn, withPartition(ref.targetUrn, ref.targetArticle)],
        windowFrom: ref.effectiveFrom,
        windowTo: null,
        rule: RINVIO_AD_ARTICOLO_INESISTENTE.definition.rule,
        evidence: [
          graphEvidence(
            ref.sourceUrn,
            `Rinvio contenuto in ${sourceName}`,
            ref.evidence ?? `Rinvio all’art. ${ref.targetArticle} di ${ref.targetUrn}`,
            { from: ref.effectiveFrom },
          ),
          graphEvidence(
            ref.targetUrn,
            `Articoli presenti in ${targetName} al ${dateLabel(ref.effectiveFrom)}`,
            `${numbers.size} articoli, dall’art. ${lowest(numbers)} all’art. ${highest(numbers)}. Nessun art. ${ref.targetArticle}.`,
            { from: ref.effectiveFrom },
          ),
        ],
        resolutions: [
          ...resolutionsFor(source, target),
          noResolution(
            'Nessun criterio di risoluzione delle antinomie si applica: qui non ci sono due norme in conflitto, c’è un rinvio che non trova destinazione. Va corretto dal legislatore, non risolto dall’interprete.',
          ),
        ],
        severity: 'alta' as const,
      });

      if (ctx.limit && findings.length >= ctx.limit) break;
    }

    return findings;
  },
};

function highest(numbers: ReadonlySet<string>): string {
  return [...numbers].sort((a, b) => numeric(a) - numeric(b)).at(-1) ?? '?';
}

function lowest(numbers: ReadonlySet<string>): string {
  return [...numbers].sort((a, b) => numeric(a) - numeric(b))[0] ?? '?';
}

function numeric(value: string): number {
  return Number.parseInt(value, 10) || 0;
}
