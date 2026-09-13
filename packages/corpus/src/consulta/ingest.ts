/**
 * Ingestione delle pronunce della Corte costituzionale.
 *
 * Produce due cose dalla stessa sorgente, e la distinzione conta:
 *
 *  - **archi del grafo** `DICHIARA_ILLEGITTIMO`, che entrano nel motore come
 *    ogni altra relazione tipizzata e datata;
 *  - **voci di gold standard**, che servono a misurare il motore e non devono
 *    mai alimentarlo. Una pronuncia usata come verità di riferimento e insieme
 *    come input renderebbe la misura circolare.
 *
 * Qui le due strade si separano subito e restano separate.
 */
import { getPrisma } from '../store/client.js';
import { ARCHIVI_PRONUNCE, ConsultaClient, CONSULTA_LICENCE } from './client.js';
import { parseDispositivo, type DichiarazioneIllegittimita } from './dispositivo.js';
import { consultaUrl, readPronunceArchive, type Pronuncia } from './pronunce.js';
import { relazioniDaPronunce } from './relazioni.js';

export interface OpzioniConsulta {
  /** Periodi da scaricare. Se omesso, tutti. */
  periodi?: readonly string[];
  cacheDir?: string;
  /** Se `false`, non scrive nel database: utile per misurare senza toccare nulla. */
  persist?: boolean;
  onProgress?: (message: string) => void;
}

export interface RapportoConsulta {
  pronunce: number;
  dichiarazioni: number;
  /** Dichiarazioni con un atto statale riconosciuto. */
  risolte: number;
  relazioniScritte: number;
  /** Motivi per cui una dichiarazione non ha prodotto un arco, con i conteggi. */
  scartate: Array<{ motivo: string; quante: number }>;
  voceGoldScritte: number;
  licenza: string;
}

export async function ingestConsulta(opts: OpzioniConsulta = {}): Promise<RapportoConsulta> {
  const log = opts.onProgress ?? (() => undefined);
  const client = new ConsultaClient({
    ...(opts.cacheDir ? { cacheDir: opts.cacheDir } : {}),
    onProgress: log,
  });

  const archivi = ARCHIVI_PRONUNCE.filter((a) => !opts.periodi || opts.periodi.includes(a.periodo));
  const pronunce: Pronuncia[] = [];
  for (const archivio of archivi) {
    const bytes = await client.archivio(archivio.path);
    const lette = readPronunceArchive(bytes);
    log(`${archivio.periodo}: ${lette.length} pronunce`);
    pronunce.push(...lette);
  }

  const dichiarazioni: DichiarazioneIllegittimita[] = pronunce.flatMap((p) =>
    parseDispositivo(p.ecli, p.dispositivo),
  );
  const risolte = dichiarazioni.filter((d) => d.actUrn !== null).length;
  log(`${dichiarazioni.length} dichiarazioni di illegittimità, ${risolte} con un atto statale`);

  if (opts.persist === false) {
    return riepilogo(pronunce, dichiarazioni, [], 0, 0);
  }

  const prisma = getPrisma();
  const attiNoti = new Set(
    (await prisma.act.findMany({ select: { urn: true } })).map((a) => a.urn),
  );
  const { relazioni, scartate } = relazioniDaPronunce(pronunce, dichiarazioni, attiNoti);
  log(`${relazioni.length} archi DICHIARA_ILLEGITTIMO verso atti del corpus`);

  // Le pronunce che producono un arco vanno salvate **prima** dell'arco: il
  // dispositivo è la prova che il sito mostrerà sotto la segnalazione, e un
  // arco senza la sua prova non è mostrabile.
  const citate = new Set(relazioni.map((r) => r.sourceUrn));
  const daSalvare = pronunce.filter((p) => citate.has(p.ecli));
  for (const blocco of chunk(daSalvare, 200)) {
    await prisma.pronuncia.createMany({
      data: blocco.map((p) => ({
        ecli: p.ecli,
        numero: p.numero,
        anno: p.anno,
        tipologia: p.tipologia,
        dataDecisione: p.dataDecisione,
        dataDeposito: p.dataDeposito,
        presidente: p.presidente,
        redattore: p.redattore,
        dispositivo: p.dispositivo,
        epigrafe: p.epigrafe,
        url: consultaUrl(p.ecli),
      })),
      skipDuplicates: true,
    });
  }
  log(`${daSalvare.length} pronunce salvate`);

  const knownAt = new Date();
  let scritte = 0;
  for (const blocco of chunk(relazioni, 500)) {
    const risultato = await prisma.relation.createMany({
      data: blocco.map((r) => ({
        id: r.id,
        type: 'DICHIARA_ILLEGITTIMO' as const,
        sourceUrn: r.sourceUrn,
        sourceArticle: r.sourceArticle,
        sourceParagraph: r.sourceParagraph,
        targetUrn: r.targetUrn,
        targetArticle: r.targetArticle,
        targetParagraphs: r.targetParagraphs,
        targetLetters: r.targetLetters,
        targetAnnex: r.targetAnnex,
        wholeAct: r.wholeAct,
        effectiveFrom: r.effectiveFrom,
        evidence: r.evidence,
        confidence: r.confidence,
        origin: r.origin,
        sourceEcli: r.sourceUrn,
        knownFrom: knownAt,
      })),
      skipDuplicates: true,
    });
    scritte += risultato.count;
  }

  const gold = await scriviGold(pronunce, dichiarazioni);
  log(`${scritte} archi scritti, ${gold} voci di gold standard`);
  return riepilogo(pronunce, dichiarazioni, scartate, scritte, gold);
}

/**
 * Le dichiarazioni diventano voci del gold standard.
 *
 * Vanno in `GoldItem`, non in `Anomaly`: sono verità di riferimento contro cui
 * si misura il motore, e il motore non le vede mai come input. Anche quelle su
 * leggi regionali entrano: misurano la nostra copertura, e una copertura che
 * non conosciamo è peggio di una bassa.
 */
async function scriviGold(
  pronunce: readonly Pronuncia[],
  dichiarazioni: readonly DichiarazioneIllegittimita[],
): Promise<number> {
  const prisma = getPrisma();
  const perEcli = new Map(pronunce.map((p) => [p.ecli, p]));
  const perVoce = new Map<string, { urns: Set<string>; quote: string }>();

  for (const d of dichiarazioni) {
    if (!d.actUrn) continue;
    const voce = perVoce.get(d.ecli) ?? { urns: new Set<string>(), quote: d.quote };
    for (const art of d.articles.length > 0 ? d.articles : ['']) {
      voce.urns.add(art ? `${d.actUrn}~art${art}` : d.actUrn);
    }
    perVoce.set(d.ecli, voce);
  }

  let scritte = 0;
  for (const [ecli, voce] of perVoce) {
    const pronuncia = perEcli.get(ecli);
    const id = `gold_cc_${ecli.replace(/[^A-Za-z0-9]/g, '_')}`;
    const summary =
      `La Corte costituzionale ha dichiarato l'illegittimità costituzionale delle norme indicate. ` +
      `Dispositivo: «${voce.quote.slice(0, 240)}»`;
    await prisma.goldItem.upsert({
      where: { id },
      create: {
        id,
        sourceKind: 'corte-costituzionale',
        sourceRef: ecli,
        sourceUrl: consultaUrl(ecli),
        urns: [...voce.urns],
        expectCheck: null,
        summary,
      },
      update: { urns: [...voce.urns], summary, sourceUrl: consultaUrl(ecli) },
    });
    scritte++;
    void pronuncia;
  }
  return scritte;
}

function riepilogo(
  pronunce: readonly Pronuncia[],
  dichiarazioni: readonly DichiarazioneIllegittimita[],
  scartate: ReadonlyArray<{ motivo: string }>,
  relazioniScritte: number,
  voceGoldScritte: number,
): RapportoConsulta {
  const perMotivo = new Map<string, number>();
  for (const s of scartate) perMotivo.set(s.motivo, (perMotivo.get(s.motivo) ?? 0) + 1);
  return {
    pronunce: pronunce.length,
    dichiarazioni: dichiarazioni.length,
    risolte: dichiarazioni.filter((d) => d.actUrn !== null).length,
    relazioniScritte,
    scartate: [...perMotivo.entries()]
      .map(([motivo, quante]) => ({ motivo, quante }))
      .sort((a, b) => b.quante - a.quante),
    voceGoldScritte,
    licenza: CONSULTA_LICENCE,
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
