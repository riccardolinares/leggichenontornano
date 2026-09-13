/**
 * Gli strumenti che il server MCP mette in mano all'assistente.
 *
 * Una premessa che governa tutto il file. Un assistente che legge questi dati
 * li riassumerà, e un riassunto è il punto esatto in cui una cautela sparisce:
 * «la Corte ha dichiarato illegittimo l'articolo» è vero, «quell'articolo non
 * vale più» è falso se la declaratoria era parziale, e la differenza sta in una
 * riga che un riassunto taglia volentieri.
 *
 * Per questo ogni risposta porta con sé, nel testo, tre cose:
 *
 *  1. il **testo originale** prima di qualunque campo estratto;
 *  2. la **regola in chiaro** del controllo, quando si parla di una
 *     segnalazione — così l'assistente può dire *perché* il motore l'ha vista,
 *     invece di inventare una motivazione;
 *  3. l'avvertenza di **non ufficialità**, che non è una formula legale ma
 *     l'unica cosa che distingue questo dataset dalla Gazzetta Ufficiale.
 *
 * Non esiste uno strumento che chieda un giudizio, né che restituisca una
 * conclusione senza le prove per contestarla.
 */
import type { SnapshotAnomaly, SnapshotReader } from '@leggichenontornano/corpus';
import { ATTRIBUTION, DISCLAIMER } from '@leggichenontornano/corpus';

export const AVVERTENZA = `${DISCLAIMER} ${ATTRIBUTION}`;

/** Taglia un testo lungo senza spezzarlo a metà parola. */
function accorcia(testo: string, max: number): string {
  if (testo.length <= max) return testo;
  const tagliato = testo.slice(0, max);
  const spazio = tagliato.lastIndexOf(' ');
  return `${tagliato.slice(0, spazio > max * 0.8 ? spazio : max)}… [troncato: ${testo.length} caratteri in tutto]`;
}

function etichettaAtto(reader: SnapshotReader, urn: string): string {
  const atto = reader.act(urn.split('~')[0] ?? urn);
  return atto ? `${atto.title} (${atto.urn})` : urn;
}

/**
 * Il risultato di uno strumento.
 *
 * `type` e non `interface`: il tipo che l'SDK si aspetta ha un index signature,
 * e in TypeScript un'interface non vi si assegna implicitamente mentre un alias
 * sì. È una distinzione che non si vede finché non la si incontra.
 */
export type RisultatoTestuale = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/**
 * Compone il testo di una risposta.
 *
 * Le righe vuote si conservano: in Markdown una riga vuota prima di un titolo è
 * la differenza fra un titolo e una riga di testo con dei cancelletti davanti.
 * Un primo tentativo le scartava con `filter(Boolean)` e il risultato arrivava
 * all'assistente tutto attaccato.
 */
function testo(...parti: Array<string | false | null | undefined>): RisultatoTestuale {
  return {
    content: [{ type: 'text', text: parti.filter((p) => typeof p === 'string').join('\n') }],
  };
}

function errore(messaggio: string): RisultatoTestuale {
  return { content: [{ type: 'text', text: messaggio }], isError: true };
}

/* ------------------------------------------------------------------ ricerca */

export function cercaNorme(
  reader: SnapshotReader,
  args: { query: string; limite?: number },
): RisultatoTestuale {
  const risultati = reader.search(args.query, args.limite ?? 10);
  if (risultati.length === 0) {
    return testo(
      `Nessun articolo contiene «${args.query}».`,
      '',
      'Il corpus è **parziale per costruzione**: non contiene tutta la legislazione italiana,',
      'ma le collezioni ingerite. Un risultato vuoto non significa che la norma non esista.',
    );
  }
  return testo(
    `${risultati.length} articoli contengono «${args.query}».`,
    '',
    ...risultati.map(
      ({ act, article }) =>
        `## ${act.title}\n` +
        `URN: \`${act.urn}\`${article.number ? ` — articolo ${article.number}` : ''}\n` +
        `${act.abrogated ? '**Atto abrogato.**\n' : ''}` +
        `\n${accorcia(article.text, 700)}\n`,
    ),
    '---',
    AVVERTENZA,
  );
}

/* -------------------------------------------------------------- testo norma */

export function leggiNorma(
  reader: SnapshotReader,
  args: { urn: string; data?: string; articolo?: string },
): RisultatoTestuale {
  const atto = reader.act(args.urn);
  if (!atto) {
    return errore(
      `Nessun atto con URN \`${args.urn}\` nel dataset.\n` +
        'Il corpus è parziale: prova `cerca_norme` per trovare l’URN esatto.',
    );
  }
  const versione = reader.versionAt(args.urn, args.data);
  if (!versione) {
    return errore(
      `\`${args.urn}\` esiste, ma il dataset non ha una versione in vigore ` +
        `${args.data ? `al ${args.data}` : 'oggi'}.`,
    );
  }
  const articoli = reader
    .articles(versione.id)
    .filter((a) => a.principal)
    .filter((a) => !args.articolo || a.number === args.articolo.toLowerCase());

  if (articoli.length === 0) {
    return errore(
      `\`${args.urn}\` non ha un articolo ${args.articolo} nella versione in vigore dal ${versione.inForceFrom}.`,
    );
  }

  return testo(
    `# ${atto.title}`,
    `URN: \`${atto.urn}\``,
    `Versione in vigore dal ${versione.inForceFrom}${versione.inForceTo ? ` al ${versione.inForceTo}` : ' (ancora in vigore)'}.`,
    atto.abrogated
      ? `\n**Atto abrogato** dal ${atto.abrogatedFrom ?? 'data non registrata'}${atto.abrogatedBy ? `, da ${etichettaAtto(reader, atto.abrogatedBy)}` : ''}.`
      : '',
    versione.dateConflict
      ? `\n**Attenzione**: la fonte dichiara due date diverse per questa versione (${versione.dateConflict}).`
      : '',
    '',
    ...articoli
      .slice(0, args.articolo ? 50 : 12)
      .map(
        (a) =>
          `## Articolo ${a.number ?? a.eId}${a.heading ? ` — ${a.heading}` : ''}\n\n${accorcia(a.text, 4000)}`,
      ),
    articoli.length > 12 && !args.articolo
      ? `\n_(${articoli.length} articoli in tutto: chiedi un articolo singolo per leggerlo per intero.)_`
      : '',
    '',
    '---',
    AVVERTENZA,
  );
}

/* ------------------------------------------------------- storia di un articolo */

export function storiaArticolo(
  reader: SnapshotReader,
  args: { urn: string; articolo: string },
): RisultatoTestuale {
  const storia = reader.articleHistory(args.urn, args.articolo.toLowerCase());
  if (storia.length === 0) {
    return errore(
      `Nessuna versione dell’articolo ${args.articolo} di \`${args.urn}\` nel dataset.`,
    );
  }
  return testo(
    `# Articolo ${args.articolo} di ${etichettaAtto(reader, args.urn)}`,
    `${storia.length} versioni nel dataset.`,
    '',
    'La multivigenza è il punto: la stessa norma dice cose diverse a date diverse,',
    'e citare «l’articolo» senza dire *a quale data* è il modo più comune di sbagliare.',
    '',
    ...storia.map(
      (v) =>
        `## Dal ${v.from}${v.to ? ` al ${v.to}` : ' (versione corrente)'}\n` +
        `${v.heading ? `**${v.heading}**\n\n` : ''}${accorcia(v.text ?? '(testo non disponibile in questa versione)', 1500)}`,
    ),
    '',
    '---',
    AVVERTENZA,
  );
}

/* ------------------------------------------------------------- segnalazioni */

function formattaSegnalazione(a: SnapshotAnomaly, completa: boolean): string {
  const prove = Array.isArray(a.evidence) ? (a.evidence as Array<Record<string, unknown>>) : [];
  const risoluzioni = Array.isArray(a.resolutions)
    ? (a.resolutions as Array<Record<string, unknown>>)
    : [];

  const righe = [
    `# ${a.title}`,
    '',
    a.plainLanguage,
    '',
    `Identificatore: \`${a.id}\` — controllo \`${a.checkId}\` (livello ${a.level}, gravità ${a.severity})`,
    a.published
      ? '**Pubblicata**: il controllo che l’ha prodotta ha superato il cancello di pubblicazione.'
      : '**In coda interna**: il controllo che l’ha prodotta non ha ancora una precisione misurata, quindi questa segnalazione non compare sul sito.',
    `Norme coinvolte: ${a.urns.map((u) => `\`${u}\``).join(', ')}`,
    a.windowFrom
      ? `Finestra in cui entrambe erano in vigore: dal ${a.windowFrom}${a.windowTo ? ` al ${a.windowTo}` : ', e lo sono tuttora'}.`
      : '',
  ];

  if (completa) {
    righe.push(
      '',
      '## I testi originali',
      '',
      'Leggili **prima** di valutare la segnalazione: se l’errore sta nella nostra lettura della',
      'fonte, si vede qui e non altrove.',
      '',
      ...prove.map(
        (p) =>
          `### ${String(p['label'] ?? p['urn'] ?? '')}\n` +
          `\`${String(p['urn'] ?? '')}\`\n\n> ${accorcia(String(p['quote'] ?? '(nessuna citazione registrata)'), 900)}`,
      ),
      '',
      '## La regola che l’ha prodotta',
      '',
      'Non è una spiegazione scritta da un modello: è la query che gira.',
      '',
      '```sql',
      a.rule,
      '```',
      '',
      '## C’è una spiegazione?',
      '',
      'I criteri che potrebbero risolvere l’apparente contraddizione. Compaiono sempre,',
      'anche quando dicono che nessuno si applica: se comparissero a intermittenza,',
      'la loro assenza diventerebbe un segnale ambiguo.',
      '',
      ...risoluzioni.map(
        (r) =>
          `- **${String(r['criterion'] ?? '')}** — ${String(r['status'] ?? '')}: ${String(r['explanation'] ?? '')}`,
      ),
      '',
      'Se pensi che questa segnalazione non regga, il progetto vuole saperlo: il pulsante',
      '«Non è un conflitto» sulla scheda apre una issue pubblica, e le risposte cambiano la',
      'precisione misurata del controllo — possono toglierlo dal sito.',
    );
  }

  righe.push('', '---', AVVERTENZA);
  return righe.filter((r) => r !== undefined).join('\n');
}

export function elencaSegnalazioni(
  reader: SnapshotReader,
  args: { controllo?: string; urn?: string; includiNonPubblicate?: boolean; limite?: number },
): RisultatoTestuale {
  let elenco = args.urn ? reader.anomaliesFor(args.urn) : reader.data.anomalies;
  if (!args.includiNonPubblicate) elenco = elenco.filter((a) => a.published);
  if (args.controllo) elenco = elenco.filter((a) => a.checkId === args.controllo);
  const limite = args.limite ?? 15;

  if (elenco.length === 0) {
    return testo(
      'Nessuna segnalazione corrisponde.',
      '',
      '**Assenza di segnale non significa norma coerente.** Il corpus è parziale, i controlli',
      'sono pochi, e quelli senza una precisione misurata non pubblicano affatto. Usa',
      '`stato_del_progetto` per vedere cosa gira davvero e con quale copertura.',
    );
  }

  return testo(
    `${elenco.length} segnalazioni corrispondono${elenco.length > limite ? `, ne mostro ${limite}` : ''}.`,
    '',
    ...elenco.slice(0, limite).map((a) => `- \`${a.id}\` [${a.checkId}] ${a.title}`),
    '',
    'Per i testi originali e la regola, chiedi `leggi_segnalazione` con l’identificatore.',
    '',
    '---',
    AVVERTENZA,
  );
}

export function leggiSegnalazione(reader: SnapshotReader, args: { id: string }): RisultatoTestuale {
  const a = reader.anomaly(args.id);
  if (!a) return errore(`Nessuna segnalazione con identificatore \`${args.id}\`.`);
  return testo(formattaSegnalazione(a, true));
}

/* ---------------------------------------------------------------- pronunce */

export function pronunceSuNorma(reader: SnapshotReader, args: { urn: string }): RisultatoTestuale {
  const trovate = reader.pronunceSuAtto(args.urn);
  if (trovate.length === 0) {
    return testo(
      `Nessuna dichiarazione di illegittimità costituzionale su \`${args.urn}\` nel dataset.`,
      '',
      'Il dataset copre le pronunce dal 2001 e solo quelle che colpiscono atti presenti nel',
      'corpus: l’assenza qui non è una prova che la norma non sia mai stata impugnata.',
    );
  }
  return testo(
    `# Pronunce su ${etichettaAtto(reader, args.urn)}`,
    '',
    'Una dichiarazione di illegittimità **non è un’abrogazione**: la norma cessa di avere',
    'efficacia, e quando la declaratoria è parziale il testo resta con un contenuto diverso',
    'da quello scritto. È la distinzione che un riassunto perde per prima.',
    '',
    ...trovate.map(({ pronuncia, relazioni }) =>
      [
        `## ${pronuncia.tipologia === 'O' ? 'Ordinanza' : 'Sentenza'} n. ${pronuncia.numero}/${pronuncia.anno}`,
        pronuncia.dataDeposito ? `Depositata il ${pronuncia.dataDeposito}.` : '',
        `Colpisce: ${relazioni
          .map((r) =>
            r.targetArticle
              ? `art. ${r.targetArticle}${r.targetParagraphs.length > 0 ? `, comma ${r.targetParagraphs.join(', ')}` : ''}`
              : 'l’intero atto',
          )
          .join('; ')}`,
        '',
        '> ' + accorcia(relazioni[0]?.evidence ?? '', 800),
        '',
        `\`${pronuncia.ecli}\`${pronuncia.url ? ` — ${pronuncia.url}` : ''}`,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    '',
    'Gli estremi sono letti automaticamente dal dispositivo della Corte. Prima di trarne',
    'conclusioni, apri il testo integrale.',
    '',
    '---',
    'Fonte delle pronunce: Corte costituzionale, dati.cortecostituzionale.it, CC BY-SA 3.0.',
    AVVERTENZA,
  );
}

/* -------------------------------------------------------- stato del progetto */

export function statoDelProgetto(reader: SnapshotReader, provenienza: string): RisultatoTestuale {
  const m = reader.data.manifest;
  const metriche = reader.data.metrics;
  const contatore = reader.counter();
  const verticali = reader.verticals();

  return testo(
    '# Cosa questo dataset sa, e cosa non sa',
    '',
    `Dati: ${provenienza}.`,
    m ? `Generato il ${m.generatedAt.slice(0, 10)}.` : '',
    '',
    '## Cosa il progetto NON fa',
    '',
    '- Nessuna consulenza legale: nessuna segnalazione è un parere.',
    '- Nessuna dichiarazione di illegittimità: la può fare solo la Corte costituzionale.',
    '- **Nessun modello linguistico giudica se due norme si contraddicono.** Il modello estrae',
    '  campi da un comma alla volta; la contraddizione è una query su quei campi.',
    '- Nessun punteggio di qualità legislativa, nessuna classifica politica.',
    '- **Assenza di segnale ≠ norma coerente.**',
    '',
    '## Copertura',
    '',
    m
      ? `${m.counts.acts} atti, ${m.counts.articles} articoli, ${m.counts.relations} relazioni, ` +
          `${m.counts.anomalies} segnalazioni di cui ${m.counts.publishedAnomalies} pubblicate.`
      : 'Manifesto non disponibile.',
    '',
    'Il corpus è **parziale per costruzione**: contiene le collezioni ingerite, non tutta la',
    'legislazione italiana.',
    '',
    '## Precisione per controllo',
    '',
    ...metriche.map(
      (c) =>
        `- **${c.label}** (${c.checkId}, livello ${c.level}): ${c.found} segnalazioni, ` +
        `${c.reviewed} revisioni umane, precisione ${c.precision === null ? 'non misurata' : `${Math.round(c.precision * 100)}%`}. ` +
        `${c.published ? 'Pubblica' : 'Non pubblica'} — ${c.reason}`,
    ),
    '',
    m
      ? `Soglia di pubblicazione: ${Math.round(m.publicationThreshold.minPrecision * 100)}% di precisione ` +
          `su almeno ${m.publicationThreshold.minSample} revisioni umane.`
      : '',
    '',
    verticali.length > 0
      ? '## Fin dove arriva il confronto semantico\n\n' +
          verticali
            .map(
              (v) =>
                `- **${v.label}**: ${v.acts.length} atti, ${v.propositions} proposizioni estratte da ${v.extractor}. ` +
                `Una divergenza verso una norma fuori da questo elenco **non la vediamo**.`,
            )
            .join('\n')
      : '',
    '',
    contatore ? `## ${contatore.label}\n\n${contatore.totalDaysLate} — ${contatore.caveat}` : '',
    '',
    '---',
    AVVERTENZA,
  );
}
