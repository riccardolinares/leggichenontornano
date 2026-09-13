/**
 * Livello 1 — Rinvio a una norma abrogata.
 *
 * Una norma ancora in vigore rinvia a un atto che nel frattempo è stato
 * abrogato. Chi legge la prima norma viene mandato a leggere un testo che non
 * c'è più.
 *
 * Attenzione a un caso che **non** è un'anomalia e va escluso: il rinvio
 * *recettizio* a un testo storico (tipicamente in una norma transitoria) è
 * legittimo e frequente. Non lo distinguiamo dai metadati, quindi questo
 * controllo segnala solo i rinvii da atti la cui vigenza si estende oltre
 * l'abrogazione del bersaglio, e la scheda dichiara esplicitamente il limite.
 */
import type { Check } from '../../types.js';
import type { CorpusView } from '../../corpus-view.js';
import { noResolution, resolutionsFor } from '../../resolution.js';
import {
  actLabel,
  actLabelConArticolo,
  actLabelPreposizioneA,
  dateLabel,
  findingId,
  graphEvidence,
  partitionLabel,
  textEvidence,
  withPartition,
} from '../helpers.js';

export const RINVIO_AD_ATTO_ABROGATO: Check<CorpusView> = {
  definition: {
    id: 'rinvio-ad-atto-abrogato',
    level: 1,
    label: 'Rinvio a una norma abrogata',
    description:
      'Una norma ancora in vigore rinvia a un atto che è stato successivamente abrogato.',
    rule: [
      'SELECT r.sourceUrn, r.targetUrn, r.targetArticle',
      'FROM Relation r',
      'JOIN Act bersaglio ON bersaglio.urn = r.targetUrn',
      'JOIN Act rinviante ON rinviante.urn = r.sourceUrn',
      'WHERE r.type = RINVIA AND r.confidence = alta',
      '  AND bersaglio.abrogated = true',
      '  AND rinviante.abrogated = false          -- chi rinvia è ancora in vigore',
      '  AND bersaglio.abrogatedFrom > r.effectiveFrom  -- il rinvio precede l’abrogazione',
    ].join('\n'),
    expectedPrecision:
      '~100% sul fatto (rinvio e abrogazione sono entrambi nel grafo); la qualificazione come problema dipende dalla natura recettizia o formale del rinvio',
    deterministic: true,
  },

  run(view, ctx) {
    const findings = [];

    for (const ref of view.relationsOfType('RINVIA')) {
      const target = view.act(ref.targetUrn);
      const source = view.act(ref.sourceUrn);
      if (!target?.abrogated || !target.abrogatedFrom) continue;
      if (!source || source.abrogated) continue;

      // L'atto che abroga nomina necessariamente l'atto che sta abrogando: è il
      // modo in cui lo abroga, non una svista. Stesso trattamento riservato alle
      // modifiche disposte dall'abrogante.
      if (target.abrogatedBy === ref.sourceUrn) continue;

      // Se il rinvio è stato introdotto dopo l'abrogazione, il caso è diverso e
      // peggiore, ma è un altro controllo: qui si guardano i rinvii che erano
      // corretti quando furono scritti e che il tempo ha reso ciechi.
      if (ref.effectiveFrom && ref.effectiveFrom > target.abrogatedFrom) continue;

      const sourceName = actLabel(source, ref.sourceUrn);
      const targetName = actLabel(target, ref.targetUrn);
      const abrogator = target.abrogatedBy ? view.act(target.abrogatedBy) : null;
      // «rinvia a l'intero atto di X» non è italiano: quando la relazione
      // riguarda l'atto nel suo insieme la frase cambia forma, non si incolla
      // un'etichetta dentro uno stampo che non la regge.
      const bersaglioA = ref.targetArticle
        ? `a ${partitionLabel(ref.targetArticle, ref.targetParagraphs)} di ${targetName}`
        : actLabelPreposizioneA(target, ref.targetUrn);

      // Il testo originale che contiene il rinvio, quando sappiamo in quale
      // articolo si trova: citare il comma intero è l'unico modo perché chi
      // legge possa giudicare se il rinvio è recettizio o formale.
      const quoted = ref.sourceArticle
        ? view.articleAt(ref.sourceUrn, ref.sourceArticle, target.abrogatedFrom)
        : null;

      findings.push({
        id: findingId('rinvio-ad-atto-abrogato', ref.sourceUrn, ref.targetUrn, ref.targetArticle),
        checkId: 'rinvio-ad-atto-abrogato',
        level: 1 as const,
        // Il titolo nomina **entrambi** gli atti: «rinvia a un atto abrogato» si
        // legge bene ma non dice niente, e chi riceve il link su un telefono
        // vede solo quello.
        title: `${sourceName} rinvia ancora ${bersaglioA}, abrogat${femminileDa(ref.targetUrn)} da ${quantoTempo(target.abrogatedFrom, ctx.today)}`,
        // La spiegazione in lingua comune parte da cosa succede a chi la norma
        // la deve applicare, non dalla ricostruzione dei fatti: quella viene
        // dopo, ed è già nel titolo.
        plainLanguage: [
          `Chi applica ${actLabelConArticolo(source, ref.sourceUrn)}${
            ref.sourceArticle ? `, art. ${ref.sourceArticle},` : ''
          } trova un richiamo ${bersaglioA}, che dal ${dateLabel(target.abrogatedFrom)} non è più in vigore: deve ricostruire da sé quale disciplina si applichi al suo posto.`,
          abrogator
            ? `L'abrogazione è stata disposta ${actLabelPreposizioneA(abrogator, target.abrogatedBy!).replace(/^al(la)?\b/, (m) => (m === 'alla' ? 'dalla' : 'dal'))}.`
            : '',
          `${actLabelConArticolo(source, ref.sourceUrn).replace(/^il\b/, 'Il').replace(/^la\b/, 'La')} è invece ancora in vigore.`,
        ]
          .filter(Boolean)
          .join(' '),
        urns: [ref.sourceUrn, withPartition(ref.targetUrn, ref.targetArticle)],
        windowFrom: target.abrogatedFrom,
        windowTo: null,
        rule: RINVIO_AD_ATTO_ABROGATO.definition.rule,
        evidence: [
          quoted
            ? textEvidence(
                withPartition(ref.sourceUrn, ref.sourceArticle),
                `${sourceName}, art. ${ref.sourceArticle} — testo che contiene il rinvio`,
                quoted.text,
              )
            : graphEvidence(
                ref.sourceUrn,
                `Rinvio contenuto in ${sourceName}`,
                ref.evidence ?? `Rinvio a ${ref.targetUrn}`,
                { from: ref.effectiveFrom },
              ),
          graphEvidence(
            ref.targetUrn,
            `Abrogazione di ${targetName}`,
            abrogator
              ? `Abrogato con effetto dal ${dateLabel(target.abrogatedFrom)} da ${actLabel(abrogator, target.abrogatedBy!)}.`
              : `Abrogato con effetto dal ${dateLabel(target.abrogatedFrom)}.`,
            { from: target.abrogatedFrom },
          ),
        ],
        resolutions: [
          ...resolutionsFor(source, target),
          noResolution(
            'Se il rinvio è recettizio, cioè incorpora il testo storico invece di richiamare la disciplina vigente, l’abrogazione del bersaglio non lo svuota. Questa distinzione non è ricavabile dai metadati e va verificata leggendo la norma.',
          ),
        ],
        severity: 'media' as const,
      });

      if (ctx.limit && findings.length >= ctx.limit) break;
    }

    return findings;
  },
};

/** Concordanza del participio: «abrogata la legge», «abrogato il decreto». */
function femminileDa(urn: string): 'a' | 'o' {
  return /:(legge|costituzione|legge\.costituzionale)[:.]/.test(urn) ? 'a' : 'o';
}

/** «tre anni», «otto mesi», «venti giorni»: serve al titolo, che deve dire quanto. */
function quantoTempo(da: string, a: string): string {
  const giorni = Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000,
  );
  if (giorni < 60) return `${giorni} giorni`;
  const mesi = Math.round(giorni / 30.44);
  if (mesi < 24) return `${mesi} mesi`;
  const anni = Math.round(mesi / 12);
  return anni === 1 ? 'un anno' : `${anni} anni`;
}
