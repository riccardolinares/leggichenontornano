/**
 * Il registro delle verifiche: cosa è già stato guardato, e quando.
 *
 * Serve a tre cose, e la terza è quella che conta.
 *
 *  - **Riprendere.** Una campagna che interroga un sito pubblico a una
 *    richiesta ogni secolo e mezzo non finisce in un giro. Deve poter ripartire
 *    da dove si era fermata, tutte le notti, senza rifare il lavoro fatto.
 *  - **Non rifare le verifiche recenti.** Un mandato guardato ieri non si
 *    riguarda oggi: sarebbe traffico inutile su un servizio di tutti.
 *  - **Alimentare il cancello.** Le sole verifiche `non-adottato` autorizzano
 *    il controllo `attuazione-mancante` a pubblicare, e lo autorizzano **sul
 *    singolo mandato**, non sull'intero atto. Un atto con dieci mandati di cui
 *    nove attuati non deve produrre dieci segnalazioni.
 */
import { getPrisma } from '../store/client.js';
import type { SnapshotVerifica } from '../snapshot/types.js';
import {
  chiaveMandato,
  verificaMandato,
  type EsitoVerificaAttuazione,
  type MandatoDaVerificare,
  type OpzioniVerifica,
  type RisultatoVerifica,
} from './verifica.js';

/** Scrive le verifiche. Ogni mandato ha una riga sola, sempre l'ultima. */
export async function salvaVerifiche(risultati: readonly RisultatoVerifica[]): Promise<number> {
  const prisma = getPrisma();
  for (const r of risultati) {
    const dati = {
      actUrn: r.actUrn,
      articleNumber: r.articleNumber,
      provisionNumber: r.provisionNumber,
      strumento: r.strumento,
      deadlineDays: r.deadlineDays,
      dueBy: r.dueBy,
      mandato: r.mandato,
      esito: r.esito,
      motivo: r.motivo,
      query: r.query,
      url: r.url,
      fonte: r.fonte,
      finestraDa: r.finestraDa,
      finestraA: r.finestraA,
      risultati: r.risultati,
      verificatoIl: new Date(r.verificatoIl),
      provvedimentoTipo: r.provvedimento?.tipo ?? null,
      provvedimentoTitolo: r.provvedimento?.titolo ?? null,
      gazzetta: r.provvedimento?.gazzetta ?? null,
      gazzettaData: r.provvedimento?.dataPubblicazione ?? null,
      codiceRedazionale: r.provvedimento?.codiceRedazionale ?? null,
      provvedimentoUrl: r.provvedimento?.url ?? null,
      citazione: r.citazione,
    };
    await prisma.verificaAttuazione.upsert({
      where: { id: r.chiave },
      create: { id: r.chiave, ...dati },
      update: dati,
    });
  }
  return risultati.length;
}

/**
 * Il registro come righe JSONL, e il modo di rileggerlo.
 *
 * La campagna gira una notte per volta, e ogni notte su una macchina nuova: il
 * database del runner muore con il job. Perché il lavoro si accumuli il
 * registro deve stare **nel repository**, come ci sta il dataset — si rilegge
 * all'inizio del giro e si riscrive alla fine, e il diff dice cosa è cambiato.
 *
 * È anche la ragione per cui il formato è quello del dataset e non un formato
 * interno: il file che la Action versiona è lo stesso che chiunque scarica.
 */
export async function esportaVerifiche(): Promise<SnapshotVerifica[]> {
  const prisma = getPrisma();
  const righe = await prisma.verificaAttuazione.findMany({
    orderBy: [{ actUrn: 'asc' }, { id: 'asc' }],
  });
  return righe.map((v) => ({
    id: v.id,
    actUrn: v.actUrn,
    articleNumber: v.articleNumber,
    provisionNumber: v.provisionNumber,
    strumento: v.strumento,
    deadlineDays: v.deadlineDays,
    dueBy: v.dueBy,
    mandato: v.mandato,
    esito: v.esito,
    motivo: v.motivo,
    query: v.query,
    url: v.url,
    fonte: v.fonte,
    finestraDa: v.finestraDa,
    finestraA: v.finestraA,
    risultati: v.risultati,
    verificatoIl: v.verificatoIl.toISOString(),
    provvedimentoTipo: v.provvedimentoTipo,
    provvedimentoTitolo: v.provvedimentoTitolo,
    gazzetta: v.gazzetta,
    gazzettaData: v.gazzettaData,
    codiceRedazionale: v.codiceRedazionale,
    provvedimentoUrl: v.provvedimentoUrl,
    citazione: v.citazione,
  }));
}

/** Rilegge nel database un registro esportato. Le righe già presenti si aggiornano. */
export async function importaVerifiche(righe: readonly SnapshotVerifica[]): Promise<number> {
  return salvaVerifiche(
    righe.map((r) => ({
      chiave: r.id,
      actUrn: r.actUrn,
      articleNumber: r.articleNumber,
      provisionNumber: r.provisionNumber,
      strumento: r.strumento,
      deadlineDays: r.deadlineDays,
      dueBy: r.dueBy,
      mandato: r.mandato,
      esito: r.esito as EsitoVerificaAttuazione,
      motivo: r.motivo,
      query: r.query,
      url: r.url,
      fonte: r.fonte,
      finestraDa: r.finestraDa,
      finestraA: r.finestraA,
      risultati: r.risultati,
      verificatoIl: r.verificatoIl,
      citazione: r.citazione,
      provvedimento: r.provvedimentoTipo
        ? {
            tipo: r.provvedimentoTipo,
            titolo: r.provvedimentoTitolo ?? '',
            gazzetta: r.gazzetta,
            dataPubblicazione: r.gazzettaData,
            codiceRedazionale: r.codiceRedazionale,
            url: r.provvedimentoUrl,
          }
        : null,
    })),
  );
}

/** Le chiavi dei mandati per cui l'assenza del provvedimento è verificata. */
export async function mandatiNonAttuati(): Promise<Set<string>> {
  const prisma = getPrisma();
  const righe = await prisma.verificaAttuazione.findMany({
    where: { esito: 'non-adottato' },
    select: { id: true },
  });
  return new Set(righe.map((r) => r.id));
}

/**
 * Gli esiti di tutte le verifiche, per chiave di mandato.
 *
 * È quello che serve al contatore nazionale per dire **quanto** di sé è
 * verificato. Esce anche l'insieme dei mandati il cui provvedimento è arrivato
 * dopo la scadenza: sono i giorni che il contatore somma e che un decreto,
 * arrivando tardi, ha comunque chiuso.
 */
export async function coperturaVerifiche(): Promise<{
  esiti: Map<string, string>;
  inRitardo: Set<string>;
}> {
  const prisma = getPrisma();
  const righe = await prisma.verificaAttuazione.findMany({
    select: { id: true, esito: true, dueBy: true, gazzettaData: true },
  });
  const esiti = new Map<string, string>();
  const inRitardo = new Set<string>();
  for (const r of righe) {
    esiti.set(r.id, r.esito);
    if (r.esito === 'adottato' && r.dueBy && r.gazzettaData && r.gazzettaData > r.dueBy) {
      inRitardo.add(r.id);
    }
  }
  return { esiti, inRitardo };
}

/** Quanti mandati per esito, e quanti adottati dopo la scadenza del termine. */
export interface RiepilogoVerifiche {
  verificati: number;
  adottati: number;
  /** Adottati, ma dopo la data entro cui andavano adottati. */
  adottatiInRitardo: number;
  nonAdottati: number;
  nonVerificabili: number;
  /** I motivi di `non-verificabile`, con i conteggi: dicono dove si è fermi. */
  motiviNonVerificabili: Array<{ motivo: string; quanti: number }>;
  ultimaVerifica: string | null;
}

/**
 * La famiglia di un motivo, per poterli contare.
 *
 * I motivi contengono la query e i conteggi — «l'atto è citato da 275 atti…» —
 * e raggrupparli alla lettera darebbe mille categorie da uno, cioè nessuna
 * informazione. Si tolgono prima le parti variabili: le citazioni fra
 * virgolette basse e i numeri. Quello che resta è la ragione, che è la cosa che
 * si vuole contare.
 */
function famigliaDelMotivo(motivo: string): string {
  const senzaVariabili = motivo
    .replace(/«[^»]*»/g, '…')
    .replace(/\b\d[\d.]*\b/g, 'N')
    .replace(/\s+/g, ' ');
  return (senzaVariabili.split(/(?<=[.:])\s/)[0] ?? senzaVariabili).trim();
}

export async function riepilogoVerifiche(): Promise<RiepilogoVerifiche> {
  const prisma = getPrisma();
  const righe = await prisma.verificaAttuazione.findMany({
    select: { esito: true, motivo: true, dueBy: true, gazzettaData: true, verificatoIl: true },
  });
  const perMotivo = new Map<string, number>();
  let adottatiInRitardo = 0;
  for (const r of righe) {
    if (r.esito === 'non-verificabile') {
      const famiglia = famigliaDelMotivo(r.motivo);
      perMotivo.set(famiglia, (perMotivo.get(famiglia) ?? 0) + 1);
    }
    if (r.esito === 'adottato' && r.dueBy && r.gazzettaData && r.gazzettaData > r.dueBy) {
      adottatiInRitardo++;
    }
  }
  const ultima = righe.reduce<Date | null>(
    (max, r) => (max === null || r.verificatoIl > max ? r.verificatoIl : max),
    null,
  );
  return {
    verificati: righe.length,
    adottati: righe.filter((r) => r.esito === 'adottato').length,
    adottatiInRitardo,
    nonAdottati: righe.filter((r) => r.esito === 'non-adottato').length,
    nonVerificabili: righe.filter((r) => r.esito === 'non-verificabile').length,
    motiviNonVerificabili: [...perMotivo.entries()]
      .map(([motivo, quanti]) => ({ motivo, quanti }))
      .sort((a, b) => b.quanti - a.quanti),
    ultimaVerifica: ultima ? ultima.toISOString() : null,
  };
}

export interface OpzioniCampagna extends OpzioniVerifica {
  /** Quanti mandati verificare in questo giro. */
  quanti?: number;
  /**
   * Giorni entro cui una verifica è considerata ancora buona.
   *
   * Un `non-verificabile` invecchia più in fretta di un `adottato`: il primo
   * può cambiare perché il portale torna raggiungibile, il secondo no. Qui il
   * valore è uno solo per semplicità, e il giro notturno lo tiene alto.
   */
  nonPrimaDiGiorni?: number;
  /** Se `false`, verifica senza scrivere nel database. */
  persist?: boolean;
}

export interface RapportoCampagna {
  esaminati: number;
  saltati: number;
  perEsito: Record<EsitoVerificaAttuazione, number>;
  risultati: RisultatoVerifica[];
  durataMs: number;
}

/**
 * Verifica un blocco di mandati, riprendendo da dove si era rimasti.
 *
 * L'ordine è deterministico — per chiave — e si scartano i mandati già
 * verificati di recente: due giri consecutivi non guardano le stesse cose, e un
 * giro interrotto riprende senza ripartire da capo.
 *
 * I mandati si esaminano raggruppati per atto, perché le ricerche larghe si
 * riusano: novanta commi della stessa legge condividono la stessa domanda
 * «questa legge è mai citata in Gazzetta?», ed è giusto porla una volta sola.
 */
export async function verificaAttuazioni(
  mandati: readonly MandatoDaVerificare[],
  opzioni: OpzioniCampagna = {},
): Promise<RapportoCampagna> {
  const inizio = Date.now();
  const log = opzioni.onProgress ?? (() => undefined);
  const quanti = opzioni.quanti ?? 25;
  const persist = opzioni.persist !== false;

  const recenti = persist ? await verificheRecenti(opzioni.nonPrimaDiGiorni ?? 30) : new Set();
  const ordinati = [...mandati].sort((a, b) => (chiaveMandato(a) < chiaveMandato(b) ? -1 : 1));
  const daFare = ordinati.filter((m) => !recenti.has(chiaveMandato(m)));
  const saltati = ordinati.length - daFare.length;

  // Raggruppare per atto tiene vicine le domande che si riusano, senza toccare
  // l'ordine con cui i mandati vengono presi: si riempie il blocco e basta.
  const blocco = daFare.slice(0, quanti);
  blocco.sort((a, b) => (a.actUrn < b.actUrn ? -1 : a.actUrn > b.actUrn ? 1 : 0));

  const memoria = new Map<string, unknown>();
  const risultati: RisultatoVerifica[] = [];
  const perEsito: Record<EsitoVerificaAttuazione, number> = {
    adottato: 0,
    'non-adottato': 0,
    'non-verificabile': 0,
  };
  for (const [indice, mandato] of blocco.entries()) {
    const esito = await verificaMandato(mandato, opzioni, memoria);
    risultati.push(esito);
    perEsito[esito.esito]++;
    log(
      `${indice + 1}/${blocco.length} ${esito.esito} — ${mandato.actUrn} art. ${mandato.articleNumber ?? '?'}`,
    );
  }

  if (persist && risultati.length > 0) await salvaVerifiche(risultati);

  return {
    esaminati: risultati.length,
    saltati,
    perEsito,
    risultati,
    durataMs: Date.now() - inizio,
  };
}

async function verificheRecenti(giorni: number): Promise<Set<string>> {
  const prisma = getPrisma();
  const soglia = new Date(Date.now() - giorni * 86_400_000);
  const righe = await prisma.verificaAttuazione.findMany({
    where: { verificatoIl: { gte: soglia } },
    select: { id: true },
  });
  return new Set(righe.map((r) => r.id));
}
