/**
 * Il preambolo come fonte di archi `ATTUA`.
 *
 * Il controllo di livello 2 cerca fonti secondarie che incidono su fonti
 * primarie. Il caso legittimo e frequentissimo è la **delegificazione**: l'art.
 * 17, comma 2, della l. 400/1988 consente a un regolamento governativo di
 * abrogare norme di legge, purché una legge lo autorizzi. Senza questa
 * informazione il controllo segnala come anomalia ogni regolamento di
 * delegificazione, cioè esattamente gli atti che fanno la cosa giusta.
 *
 * L'informazione c'è, ed è sempre nello stesso posto: il preambolo, dove ogni
 * atto elenca i suoi presupposti.
 *
 *   «Visto l'articolo 17, comma 2, della legge 23 agosto 1988, n. 400;»
 *   «Vista la legge 15 marzo 1997, n. 59, e in particolare l'articolo 20;»
 *
 * Le formule di apertura sono fisse — Visto, Vista, Visti, Viste — e questo
 * rende il preambolo analizzabile con una regola, non con un modello.
 */
import { parseActCitations, type AknAct } from '@leggichenontornano/akn-parser';
import { relationId, type RelationRecord } from './build-relations.js';
import { normalizeHref } from './href.js';

/** Le formule con cui un preambolo introduce un presupposto normativo. */
const VISTO_RE = /\b(vist[oaie]|considerat[oaie]|ai sensi del{1,2}['’]?|in\s+attuazione)\b/i;

/** L'art. 17, comma 2, l. 400/1988: la norma che autorizza la delegificazione. */
export const DELEGIFICAZIONE_URN = 'urn:nir:stato:legge:1988-08-23;400';

const DELEGIFICAZIONE_RE =
  /\bart(?:icolo|\.)\s*17\s*,?\s*comma\s*2\b[^.;]{0,120}?\b(?:legge\s+)?23\s+agosto\s+1988\s*,?\s*n\.\s*400/i;

export interface PreamboloAnalisi {
  /** Atti citati fra i presupposti, in forma di URN. */
  presupposti: string[];
  /** `true` quando il preambolo invoca l'art. 17, comma 2, della l. 400/1988. */
  delegificazione: boolean;
  /** Frasi da cui i presupposti sono stati letti, come prova. */
  frasi: string[];
}

/**
 * Analizza il preambolo di un atto.
 *
 * Negli open data il preambolo è marcato: `<preamble><citations><citation>`, un
 * elemento per periodo. Si prendono i periodi che iniziano con una formula di
 * presupposto e si risolvono gli atti che citano.
 */
export function analizzaPreambolo(act: AknAct): PreamboloAnalisi {
  const presupposti = new Set<string>();
  const frasi: string[] = [];

  for (const citazione of act.preambleCitations) {
    if (!VISTO_RE.test(citazione.text)) continue;
    frasi.push(citazione.text.trim().slice(0, 300));

    // Due strade verso lo stesso URN, e si usano entrambe: l'ancoraggio del
    // `<ref>`, che è preciso quando c'è, e la citazione scritta nel testo, che
    // c'è anche quando l'ancoraggio manca.
    for (const ref of citazione.refs) {
      const risolto = normalizeHref(ref.href);
      if (risolto.kind === 'nir' && risolto.urn) presupposti.add(risolto.urn);
    }
    for (const c of parseActCitations(citazione.text)) presupposti.add(c.urn);
  }

  const testo = act.preambleCitations.map((c) => c.text).join(' ');
  return {
    presupposti: [...presupposti],
    delegificazione: DELEGIFICAZIONE_RE.test(testo),
    frasi,
  };
}

/**
 * Archi `ATTUA` dedotti dal preambolo.
 *
 * Un arco `ATTUA` dichiara: «questo atto si fonda su quell'altro». Per un
 * regolamento di delegificazione è la prova che non sta scavalcando la legge,
 * la sta eseguendo.
 */
export function relazioniDaPreambolo(
  act: AknAct,
  opts: { effectiveFrom?: string | null } = {},
): RelationRecord[] {
  const analisi = analizzaPreambolo(act);
  const sourceUrn = act.urn.split('~')[0]!;
  const effectiveFrom = opts.effectiveFrom ?? act.expressionDate ?? act.publication?.date ?? null;
  const out: RelationRecord[] = [];

  for (const targetUrn of analisi.presupposti) {
    if (targetUrn === sourceUrn) continue;
    const base: Omit<RelationRecord, 'id'> = {
      type: 'ATTUA',
      sourceUrn,
      sourceArticle: null,
      sourceParagraph: null,
      targetUrn,
      targetArticle: null,
      targetParagraphs: [],
      targetLetters: [],
      targetAnnex: null,
      wholeAct: true,
      effectiveFrom,
      evidence:
        analisi.frasi.find((f) => f.includes(targetUrn.split(';')[1] ?? '')) ??
        analisi.frasi[0] ??
        null,
      // Il preambolo è una dichiarazione dell'atto su se stesso: è affidabile su
      // *quali* atti invoca, non su cosa esattamente ne faccia. L'arco serve a
      // escludere falsi positivi, non a fondarne di nuovi, e resta quindi ad alta
      // confidenza solo quando il preambolo invoca la delegificazione.
      confidence: analisi.delegificazione ? 'alta' : 'bassa',
      origin: 'preambolo',
    };
    out.push({ id: relationId(base), ...base });
  }

  return out;
}
