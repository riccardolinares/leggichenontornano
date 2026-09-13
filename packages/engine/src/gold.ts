/**
 * Il gold standard: anomalie già annotate da giuristi, usate come verità di
 * riferimento.
 *
 * Non possiamo misurare la precisione su un campione che scegliamo noi e
 * giudichiamo noi. Servono annotazioni prodotte per altri scopi da chi ha
 * l'autorità per farle: pareri del Consiglio di Stato, sentenze di illegittimità
 * costituzionale, rimessioni alle Sezioni Unite, circolari interpretative.
 * Vedi `docs/gold-standard.md`.
 *
 * Questo modulo fa due cose: importa le annotazioni e dice, per ciascuna, se il
 * motore l'ha trovata. Il secondo numero è il **recall**, che non ottimizziamo
 * ma dobbiamo conoscere: un controllo con precisione perfetta e recall
 * dell'1% è un controllo che non serve, e senza misurarlo non lo sapremmo.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getPrisma } from '@antinomia/corpus';

export type FonteGold =
  | 'consiglio-di-stato'
  | 'corte-costituzionale'
  | 'sezioni-unite'
  | 'circolare';

export interface VoceGold {
  /** Tipo di fonte dell'annotazione. */
  sourceKind: FonteGold;
  /** Estremi del documento: numero del parere, ECLI della sentenza, protocollo della circolare. */
  sourceRef: string;
  sourceUrl?: string;
  /** URN delle norme coinvolte. */
  urns: string[];
  /** Controllo che dovrebbe intercettarla, se lo sappiamo. */
  expectCheck?: string;
  /** Cosa dice la fonte, con parole nostre ma senza interpretazione. */
  summary: string;
}

/**
 * Importa voci da un file JSONL.
 *
 * L'identificatore è derivato dal contenuto: reimportare lo stesso file non
 * duplica nulla, e una voce corretta a mano nel file sostituisce la precedente
 * invece di affiancarsi.
 */
export async function importaGold(path: string): Promise<{ importate: number; totali: number }> {
  const prisma = getPrisma();
  const voci = readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as VoceGold);

  let importate = 0;
  for (const voce of voci) {
    const id = `gold_${createHash('sha256')
      .update(`${voce.sourceKind}|${voce.sourceRef}|${voce.urns.join(',')}`)
      .digest('hex')
      .slice(0, 20)}`;
    await prisma.goldItem.upsert({
      where: { id },
      create: {
        id,
        sourceKind: voce.sourceKind,
        sourceRef: voce.sourceRef,
        sourceUrl: voce.sourceUrl ?? null,
        urns: voce.urns,
        expectCheck: voce.expectCheck ?? null,
        summary: voce.summary,
      },
      update: {
        sourceUrl: voce.sourceUrl ?? null,
        urns: voce.urns,
        expectCheck: voce.expectCheck ?? null,
        summary: voce.summary,
      },
    });
    importate++;
  }
  return { importate, totali: await prisma.goldItem.count() };
}

export interface EsitoGold {
  id: string;
  sourceKind: string;
  sourceRef: string;
  expectCheck: string | null;
  urns: string[];
  /** `true` quando esiste una segnalazione che tocca gli stessi URN. */
  trovata: boolean;
  /** Identificatori delle segnalazioni che la intercettano. */
  segnalazioni: string[];
  summary: string;
}

export interface RapportoGold {
  totali: number;
  trovate: number;
  /** Recall complessivo: quante annotazioni il motore intercetta. */
  recall: number;
  perControllo: Array<{ checkId: string; attese: number; trovate: number; recall: number }>;
  esiti: EsitoGold[];
}

/**
 * Confronta il gold standard con le segnalazioni prodotte.
 *
 * Il criterio di corrispondenza è volutamente **generoso**: una segnalazione
 * intercetta un'annotazione se tocca almeno un URN di atto in comune. Un
 * criterio stretto misurerebbe la nostra capacità di indovinare la partizione
 * esatta che il giurista aveva in mente, che non è quello che ci interessa
 * sapere. La generosità è dichiarata: il recall qui è un limite superiore.
 */
export async function valutaGold(): Promise<RapportoGold> {
  const prisma = getPrisma();
  const [voci, anomalie] = await Promise.all([
    prisma.goldItem.findMany(),
    prisma.anomaly.findMany({
      where: { resolvedAt: null },
      select: { id: true, checkId: true, urns: true },
    }),
  ]);

  const perAtto = new Map<string, Array<{ id: string; checkId: string }>>();
  for (const a of anomalie) {
    for (const urn of a.urns) {
      const atto = urn.split('~')[0]!;
      const lista = perAtto.get(atto);
      if (lista) lista.push({ id: a.id, checkId: a.checkId });
      else perAtto.set(atto, [{ id: a.id, checkId: a.checkId }]);
    }
  }

  const esiti: EsitoGold[] = voci.map((voce) => {
    const candidate = voce.urns
      .flatMap((u) => perAtto.get(u.split('~')[0]!) ?? [])
      .filter((a) => !voce.expectCheck || a.checkId === voce.expectCheck);
    const segnalazioni = [...new Set(candidate.map((c) => c.id))];
    return {
      id: voce.id,
      sourceKind: voce.sourceKind,
      sourceRef: voce.sourceRef,
      expectCheck: voce.expectCheck,
      urns: voce.urns,
      trovata: segnalazioni.length > 0,
      segnalazioni,
      summary: voce.summary,
    };
  });

  const perControllo = new Map<string, { attese: number; trovate: number }>();
  for (const esito of esiti) {
    const key = esito.expectCheck ?? '(non specificato)';
    const acc = perControllo.get(key) ?? { attese: 0, trovate: 0 };
    acc.attese++;
    if (esito.trovata) acc.trovate++;
    perControllo.set(key, acc);
  }

  const trovate = esiti.filter((e) => e.trovata).length;
  return {
    totali: esiti.length,
    trovate,
    recall: esiti.length > 0 ? trovate / esiti.length : 0,
    perControllo: [...perControllo.entries()].map(([checkId, v]) => ({
      checkId,
      attese: v.attese,
      trovate: v.trovate,
      recall: v.attese > 0 ? v.trovate / v.attese : 0,
    })),
    esiti,
  };
}
