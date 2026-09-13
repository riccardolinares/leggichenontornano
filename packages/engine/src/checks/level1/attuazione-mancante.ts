/**
 * Livello 1 — Decreto attuativo mai emanato.
 *
 * Una norma rinvia a un provvedimento attuativo da adottare «entro N giorni
 * dall'entrata in vigore della presente legge». Il termine è scaduto e il
 * provvedimento non risulta pubblicato.
 *
 * **Il cancello.** Questo controllo segnala solo i **mandati** per i quali
 * abbiamo verificato in Gazzetta Ufficiale l'assenza del provvedimento attuativo
 * (`implementationCoverage`, alimentato da `VerificaAttuazione`). Per tutti gli
 * altri l'estrazione del mandato viene comunque prodotta — serve al contatore
 * nazionale dei giorni di ritardo — ma non diventa una segnalazione pubblica.
 *
 * La granularità è il mandato e non l'atto, e la differenza non è accademica:
 * una legge può prevedere dieci decreti, nove arrivati e uno no. Un cancello
 * per atto pubblicherebbe dieci segnalazioni, nove delle quali false.
 *
 * Il motivo è il principio del progetto: «non ho trovato il decreto» e «il
 * decreto non esiste» sono due affermazioni diverse, e su un corpus parziale la
 * prima non autorizza la seconda. Pubblicarle come se fossero la stessa cosa
 * produrrebbe esattamente la segnalazione falsa che il progetto non può
 * permettersi.
 */
import { createHash } from 'node:crypto';
import type { Check, CheckContext } from '../../types.js';
import type { CorpusView, ProvisionView } from '../../corpus-view.js';
import { noResolution } from '../../resolution.js';
import { actLabel, dateLabel, findingId, textEvidence, withPartition } from '../helpers.js';

/** Un mandato attuativo estratto dal testo di un comma. */
export interface Mandate {
  actUrn: string;
  articleNumber: string | null;
  provisionNumber: string | null;
  /** Tipo di provvedimento atteso, come nominato dal testo. */
  instrument: string;
  /** Termine in giorni, normalizzato. */
  deadlineDays: number;
  /** Testo del termine così come scritto. */
  deadlineText: string;
  /** Data entro cui il provvedimento andava adottato. */
  dueBy: string | null;
  /** Frase da cui il mandato è stato letto. */
  quote: string;
}

// Lo strumento si legge insieme all'autorità che lo adotta: «decreto» da solo
// non dice nulla, «decreto del Ministro» sì, ed è quello che finisce nel titolo
// della segnalazione. I complementi si prendono finché sono separati da spazio,
// quindi «decreto del Ministro dell'economia» si ferma a «del Ministro»: una
// scelta prudente, che preferisce troncare a inventare.
const INSTRUMENT =
  "(?:decreto|regolamento|provvedimento|d\\.?p\\.?c\\.?m\\.?)(?:\\s+(?:del|dello|della|dei|degli|delle|di)\\s+[A-Za-zà-ù'’]+){0,4}";

/**
 * «entro sessanta giorni», «entro 90 giorni», «entro sei mesi», «entro un anno».
 * I numeri in lettere sono la forma normale nei testi di legge: ignorarli
 * significherebbe perdere la maggioranza dei mandati.
 */
const DEADLINE_RE = new RegExp(
  `entro\\s+(?:il\\s+termine\\s+di\\s+)?([a-zà-ù]+|\\d+)\\s+(giorni|giorno|mesi|mese|anni|anno)`,
  'i',
);

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  dodici: 12,
  quindici: 15,
  venti: 20,
  trenta: 30,
  quaranta: 40,
  quarantacinque: 45,
  cinquanta: 50,
  sessanta: 60,
  novanta: 90,
  centoventi: 120,
  centottanta: 180,
  centoventotto: 128,
};

/**
 * Estrae i mandati attuativi dal testo di un comma.
 *
 * Deterministico e volutamente stretto: richiede che nella stessa frase
 * compaiano lo strumento («con decreto del Ministro…»), il verbo di adozione e
 * il termine. Una frase che nomina un decreto senza imporre un termine non è un
 * mandato con scadenza e non va contata fra i ritardi.
 */
export function extractMandates(
  provision: ProvisionView,
  actInForceFrom: string | null,
): Mandate[] {
  const out: Mandate[] = [];
  // Si lavora frase per frase: un comma può contenere sia un mandato con termine
  // sia altri richiami a decreti che con quel termine non c'entrano.
  for (const sentence of provision.text.split(/(?<=[.;])\s+/)) {
    const instrument = new RegExp(`\\bcon\\s+${INSTRUMENT}`, 'i').exec(sentence);
    if (!instrument) continue;
    if (
      !/\b(?:sono|è|e')\s+(?:adottat|stabilit|definit|determinat|approvat|individuat|discipli)/i.test(
        sentence,
      ) &&
      !/\bsi\s+provvede\b/i.test(sentence)
    ) {
      continue;
    }
    const deadline = DEADLINE_RE.exec(sentence);
    if (!deadline) continue;

    const days = toDays(deadline[1]!, deadline[2]!);
    if (days === null) continue;

    out.push({
      actUrn: provision.actUrn,
      articleNumber: provision.articleNumber,
      provisionNumber: provision.number,
      instrument: normalizeInstrument(instrument[0]),
      deadlineDays: days,
      deadlineText: deadline[0],
      dueBy: actInForceFrom ? addDays(actInForceFrom, days) : null,
      quote: sentence.trim(),
    });
  }
  return out;
}

function toDays(value: string, unit: string): number | null {
  const n = /^\d+$/.test(value) ? Number(value) : NUMBER_WORDS[value.toLowerCase()];
  if (!n) return null;
  const u = unit.toLowerCase();
  if (u.startsWith('giorn')) return n;
  if (u.startsWith('mes')) return Math.round(n * 30.44);
  if (u.startsWith('ann')) return Math.round(n * 365.25);
  return null;
}

function normalizeInstrument(raw: string): string {
  return raw
    .replace(/^con\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysLate(dueBy: string, today: string): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueBy}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * La chiave di un mandato: gli stessi componenti dell'identificatore della
 * segnalazione, e gli stessi che la verifica in Gazzetta Ufficiale registra.
 *
 * Serve perché il cancello lavora **sul singolo mandato** e non sull'atto: una
 * legge con dieci mandati di cui nove attuati non deve produrre dieci
 * segnalazioni perché il decimo manca.
 */
export function mandateKey(mandate: {
  actUrn: string;
  articleNumber: string | null;
  provisionNumber: string | null;
  deadlineDays: number;
}): string {
  const parti = [
    mandate.actUrn,
    mandate.articleNumber ?? '',
    mandate.provisionNumber ?? '',
    String(mandate.deadlineDays),
  ].join('|');
  return `vga_${createHash('sha1').update(parti).digest('hex').slice(0, 16)}`;
}

export interface AttuazioneInput {
  view: CorpusView;
  /**
   * Mandati per i quali l'assenza del provvedimento è stata verificata in
   * Gazzetta Ufficiale. Solo questi producono segnalazioni pubblicabili.
   *
   * L'insieme contiene chiavi di mandato (`mandateKey`). Accetta anche URN di
   * atto, che è la forma con cui il gold standard esprime la copertura: una
   * voce di gold su un atto copre tutti i suoi mandati, ed è l'unica granularità
   * che una fonte giuridica esterna ci dà.
   */
  implementationCoverage: ReadonlySet<string>;
  /** Provvedimenti attuativi noti, per URN dell'atto che li prevedeva. */
  implementations: ReadonlyMap<string, readonly string[]>;
}

export const ATTUAZIONE_MANCANTE: Check<AttuazioneInput> = {
  definition: {
    id: 'attuazione-mancante',
    level: 1,
    label: 'Decreto attuativo mai emanato',
    description:
      'Una norma prevede un provvedimento attuativo entro un termine; il termine è scaduto e il provvedimento non risulta pubblicato.',
    rule: [
      'SELECT m.actUrn, m.articleNumber, m.dueBy',
      'FROM Mandato m                                  -- estratto dal testo del comma',
      'WHERE m.dueBy < oggi',
      '  AND m.chiave IN implementationCoverage        -- assenza verificata in Gazzetta Ufficiale',
      '  AND NOT EXISTS (',
      '        SELECT 1 FROM Attuazione a WHERE a.forActUrn = m.actUrn',
      '      )',
      '',
      '-- Il mandato si estrae con una regola fissa: nella stessa frase devono',
      '-- comparire lo strumento («con decreto…»), il verbo di adozione e il',
      '-- termine. Nessun modello linguistico è coinvolto.',
    ].join('\n'),
    expectedPrecision: '~100% sui mandati con assenza verificata in Gazzetta Ufficiale',
    deterministic: true,
  },

  run(input, ctx: CheckContext) {
    const findings = [];
    for (const mandate of allMandates(input.view)) {
      if (!mandate.dueBy || mandate.dueBy >= ctx.today) continue;
      if (
        !input.implementationCoverage.has(mandateKey(mandate)) &&
        !input.implementationCoverage.has(mandate.actUrn)
      ) {
        continue;
      }
      if ((input.implementations.get(mandate.actUrn) ?? []).length > 0) continue;

      const act = input.view.act(mandate.actUrn);
      const name = actLabel(act, mandate.actUrn);
      const late = daysLate(mandate.dueBy, ctx.today);
      const where = mandate.articleNumber
        ? `art. ${mandate.articleNumber}${mandate.provisionNumber ? `, comma ${mandate.provisionNumber}` : ''}`
        : 'una disposizione';

      findings.push({
        id: findingId(
          'attuazione-mancante',
          mandate.actUrn,
          mandate.articleNumber,
          mandate.provisionNumber,
          String(mandate.deadlineDays),
        ),
        checkId: 'attuazione-mancante',
        level: 1 as const,
        title: `${name} aspetta il suo ${mandate.instrument} da ${formatLate(late)}`,
        plainLanguage: [
          `${name}, al ${where}, prevede che si provveda con ${mandate.instrument} ${mandate.deadlineText} dall'entrata in vigore.`,
          `Il termine è scaduto il ${dateLabel(mandate.dueBy)}: sono passati ${late} giorni.`,
          'Finché il provvedimento non arriva, quella parte della legge non produce effetti.',
        ].join(' '),
        urns: [withPartition(mandate.actUrn, mandate.articleNumber)],
        windowFrom: mandate.dueBy,
        windowTo: null,
        rule: ATTUAZIONE_MANCANTE.definition.rule,
        evidence: [
          textEvidence(
            withPartition(mandate.actUrn, mandate.articleNumber),
            `${name}, ${where}`,
            mandate.quote,
          ),
        ],
        resolutions: [
          noResolution(
            'Nessun criterio di risoluzione delle antinomie si applica: non c’è un conflitto fra norme, c’è una norma che attende un atto che non è stato adottato.',
          ),
        ],
        severity: late > 730 ? ('alta' as const) : ('media' as const),
      });

      if (ctx.limit && findings.length >= ctx.limit) break;
    }
    return findings;
  },
};

/**
 * Tutti i mandati estraibili dal corpus, indipendentemente dalla copertura.
 *
 * Alimenta il contatore nazionale dei giorni di ritardo, che è un dato
 * aggregato: sommare ritardi su un corpus parziale sottostima, e sottostimare è
 * l'errore innocuo. Affermare che un singolo decreto manca senza averlo
 * verificato è l'errore che non possiamo permetterci, e per quello serve la
 * copertura.
 */
export function allMandates(view: CorpusView): Mandate[] {
  const out: Mandate[] = [];
  for (const provision of view.provisions) {
    const act = view.act(provision.actUrn);
    out.push(...extractMandates(provision, act?.inForceFrom ?? null));
  }
  return out;
}

function formatLate(days: number): string {
  if (days < 60) return `${days} giorni`;
  if (days < 730) return `${Math.round(days / 30.44)} mesi`;
  return `${Math.round(days / 365.25)} anni`;
}
