/**
 * Dalle dichiarazioni di illegittimità agli archi del grafo.
 *
 * Una pronuncia di illegittimità costituzionale **non è un'abrogazione**, e
 * tenerle distinte non è pedanteria giuridica: l'abrogazione dispone per il
 * futuro, la declaratoria di illegittimità fa cessare l'efficacia della norma
 * *ex tunc*, con il limite dei rapporti esauriti. Per il grafo la conseguenza
 * pratica è la stessa — un rinvio a una norma caduta è un rinvio che non torna —
 * ma il nome dell'arco deve dire quale delle due cose è successa, perché la
 * scheda lo mostrerà a chi quella differenza la conosce.
 *
 * L'arco parte dall'**ECLI della pronuncia**, non da un URN:NIR. È voluto: la
 * sorgente non è un atto normativo e non deve fingersi tale.
 */
import { relationId, type RelationRecord } from '../graph/build-relations.js';
import type { DichiarazioneIllegittimita } from './dispositivo.js';
import type { Pronuncia } from './pronunce.js';

export interface EsitoRelazioni {
  relazioni: RelationRecord[];
  /** Dichiarazioni che non hanno prodotto un arco, con il motivo. */
  scartate: Array<{ ecli: string; motivo: string }>;
}

/**
 * Costruisce gli archi `DICHIARA_ILLEGITTIMO`.
 *
 * `attiNoti`, quando fornito, restringe agli atti presenti nel corpus: un arco
 * verso un atto che non abbiamo non è sbagliato, ma non è verificabile da chi
 * legge il sito, e il grafo si riempirebbe di nodi senza testo.
 */
export function relazioniDaPronunce(
  pronunce: readonly Pronuncia[],
  dichiarazioni: readonly DichiarazioneIllegittimita[],
  attiNoti?: ReadonlySet<string>,
): EsitoRelazioni {
  const perEcli = new Map(pronunce.map((p) => [p.ecli, p]));
  const relazioni: RelationRecord[] = [];
  const scartate: Array<{ ecli: string; motivo: string }> = [];
  const viste = new Set<string>();

  for (const d of dichiarazioni) {
    if (!d.actUrn) {
      scartate.push({ ecli: d.ecli, motivo: d.skipped ?? 'atto non riconosciuto' });
      continue;
    }
    if (attiNoti && !attiNoti.has(d.actUrn)) {
      scartate.push({ ecli: d.ecli, motivo: 'atto non presente nel corpus ingerito' });
      continue;
    }
    const pronuncia = perEcli.get(d.ecli);
    // La data da cui l'arco vale è quella del **deposito**: è da lì che la
    // pronuncia ha effetto, non dalla camera di consiglio.
    const effectiveFrom = pronuncia?.dataDeposito ?? pronuncia?.dataDecisione ?? null;

    // Un articolo per arco: il grafo si interroga per articolo, e un arco che
    // ne elencasse tre non risponderebbe alla domanda «questo articolo è
    // caduto?».
    const bersagli = d.articles.length > 0 ? d.articles : [null];
    for (const articolo of bersagli) {
      const rel: Omit<RelationRecord, 'id'> = {
        type: 'DICHIARA_ILLEGITTIMO',
        sourceUrn: d.ecli,
        sourceArticle: null,
        sourceParagraph: null,
        targetUrn: d.actUrn,
        targetArticle: articolo,
        targetParagraphs: articolo && d.articles.length === 1 ? [...d.paragraphs] : [],
        targetLetters: articolo && d.articles.length === 1 ? [...d.letters] : [],
        targetAnnex: null,
        // Solo una declaratoria totale su un atto senza articoli nominati
        // colpisce l'atto intero.
        wholeAct: d.articles.length === 0 && d.scope === 'totale',
        effectiveFrom,
        evidence: d.quote,
        // La declaratoria parziale non fa cadere la norma: ne cambia il
        // contenuto. L'arco esiste, ma non deve fondare da solo la conclusione
        // «questa norma non c'è più».
        confidence: d.scope === 'parziale' ? 'bassa' : d.confidence,
        origin: 'consulta',
      };
      const id = relationId(rel);
      if (viste.has(id)) continue;
      viste.add(id);
      relazioni.push({ id, ...rel });
    }
  }

  return { relazioni, scartate };
}
