/**
 * Verifica incrociata delle declaratorie di illegittimità.
 *
 * Due fonti indipendenti dicono la stessa cosa, e possiamo confrontarle.
 *
 *  - La **Corte costituzionale** pubblica il dispositivo delle proprie
 *    pronunce. Da lì leggiamo gli estremi della norma caduta.
 *  - **Normattiva** annota gli stessi eventi nel testo dell'atto colpito, in
 *    coda all'articolo, con la formula:
 *
 *      AGGIORNAMENTO (10) La Corte Costituzionale, con sentenza 13 - 16
 *      febbraio 2012, n. 22 (in G.U. 1a s.s. 22/2/2012, n. 8) ha dichiarato
 *      "l'illegittimita' costituzionale dell'articolo 2, comma 2-quater…"
 *
 * Nessuna delle due deriva dall'altra, quindi l'accordo è una misura vera della
 * precisione della nostra lettura del dispositivo — non un controllo circolare.
 *
 * Perché serve un modulo e non una query estemporanea: è l'unica precisione che
 * possiamo misurare **senza revisione umana**, e va rimisurata a ogni
 * aggiornamento del corpus, altrimenti la prossima regressione del parser passa
 * inosservata.
 *
 * Quello che questa verifica **non** dice: che le declaratorie non confermate
 * siano sbagliate. La nota può stare su un altro articolo dello stesso atto,
 * oppure l'atto può essere nel corpus in una versione che non la contiene. Il
 * numero è una conferma, non una condanna.
 */
import { getPrisma } from '../store/client.js';

export interface EsitoVerifica {
  ecli: string;
  targetUrn: string;
  targetArticle: string | null;
  confidence: string;
  /** `true` quando Normattiva annota la stessa pronuncia sull'atto colpito. */
  confermata: boolean;
}

export interface RapportoVerifica {
  totali: number;
  confermate: number;
  perConfidenza: Array<{ confidence: string; archi: number; confermate: number; accordo: number }>;
  esiti: EsitoVerifica[];
}

/**
 * La nota di Normattiva che registra una pronuncia.
 *
 * Si cercano insieme il numero della sentenza, l'anno e la parola chiave: il
 * solo numero non basta (nel testo di una legge «n. 22» compare di continuo) e
 * la sola parola chiave nemmeno.
 */
export function citaLaPronuncia(testo: string, anno: string, numero: string): boolean {
  if (!/illegittimit/i.test(testo)) return false;
  const re = new RegExp(
    `sentenza[^.]{0,80}${escape(anno)}[^.]{0,20}n\\.\\s*${escape(numero)}(?![0-9])`,
    'i',
  );
  return re.test(testo);
}

export async function verificaDichiarazioni(): Promise<RapportoVerifica> {
  const prisma = getPrisma();
  const archi = await prisma.relation.findMany({
    where: { type: 'DICHIARA_ILLEGITTIMO', knownTo: null },
    select: { sourceUrn: true, targetUrn: true, targetArticle: true, confidence: true },
  });
  if (archi.length === 0) {
    return { totali: 0, confermate: 0, perConfidenza: [], esiti: [] };
  }

  // Il testo corrente di ciascun atto colpito: le note di aggiornamento stanno
  // nel testo dell'articolo, non in un campo a parte.
  const urnColpiti = [...new Set(archi.map((a) => a.targetUrn))];
  const versioni = await prisma.actVersion.findMany({
    where: { actUrn: { in: urnColpiti }, knownTo: null },
    orderBy: [{ actUrn: 'asc' }, { inForceFrom: 'desc' }],
    select: { id: true, actUrn: true },
  });
  const ultimaPerAtto = new Map<string, string>();
  for (const v of versioni) if (!ultimaPerAtto.has(v.actUrn)) ultimaPerAtto.set(v.actUrn, v.id);

  const articoli = await prisma.article.findMany({
    where: { versionId: { in: [...ultimaPerAtto.values()] } },
    select: { versionId: true, text: true },
  });
  const testoPerVersione = new Map<string, string[]>();
  for (const a of articoli) {
    const lista = testoPerVersione.get(a.versionId);
    if (lista) lista.push(a.text);
    else testoPerVersione.set(a.versionId, [a.text]);
  }

  const esiti: EsitoVerifica[] = archi.map((arco) => {
    const [, , , anno = '', numero = ''] = arco.sourceUrn.split(':');
    const versione = ultimaPerAtto.get(arco.targetUrn);
    const testi = versione ? (testoPerVersione.get(versione) ?? []) : [];
    return {
      ecli: arco.sourceUrn,
      targetUrn: arco.targetUrn,
      targetArticle: arco.targetArticle,
      confidence: arco.confidence,
      confermata: testi.some((t) => citaLaPronuncia(t, anno, numero)),
    };
  });

  const per = new Map<string, { archi: number; confermate: number }>();
  for (const e of esiti) {
    const acc = per.get(e.confidence) ?? { archi: 0, confermate: 0 };
    acc.archi++;
    if (e.confermata) acc.confermate++;
    per.set(e.confidence, acc);
  }

  return {
    totali: esiti.length,
    confermate: esiti.filter((e) => e.confermata).length,
    perConfidenza: [...per.entries()]
      .map(([confidence, v]) => ({
        confidence,
        ...v,
        accordo: v.archi > 0 ? v.confermate / v.archi : 0,
      }))
      .sort((a, b) => (a.confidence < b.confidence ? -1 : 1)),
    esiti,
  };
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
