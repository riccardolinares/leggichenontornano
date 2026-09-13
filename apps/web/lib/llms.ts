import { CHECK_DEFINITIONS, THRESHOLD } from '@leggichenontornano/engine';
import { articoli } from './blog';
import { SITE_URL, dataset } from './dataset';
import { riepilogoConsumi } from './consumi';
import { denaro, numero, percentuale } from './testo';

/**
 * I file per gli assistenti: `llms.txt` e `llms-full.txt`.
 *
 * Sono la versione per macchina di quello che un lettore trova in home: cosa
 * c'è, cosa significa, e dove andarlo a prendere. Servono perché un assistente
 * che riassume questo sito senza di essi lo fa dal testo delle pagine, dove le
 * cautele e le cifre stanno in punti diversi — e quello che perde per primo è
 * proprio il legame fra una cifra e cosa misura.
 *
 * **Sono generati dal dataset**, come ogni altro numero del sito. Un `llms.txt`
 * scritto a mano è la cosa che invecchia più in fretta di tutte: nessuno lo
 * guarda, e intanto racconta un corpus di sei mesi fa.
 */

function intestazione(): string[] {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const pubblicate = reader.publishedAnomalies().length;

  return [
    '# Le leggi che non tornano',
    '',
    '> Incongruenze, contraddizioni e aree grigie della legislazione italiana, trovate con',
    '> interrogazioni deterministiche su un corpus normativo bitemporale e pubblicate con i testi',
    `> originali, la regola che le ha prodotte e la precisione misurata di quella regola.`,
    '',
    manifest
      ? `Corpus: ${numero(manifest.counts.acts)} atti, ${numero(manifest.counts.versions)} versioni, ${numero(manifest.counts.articles)} articoli, ${numero(manifest.counts.relations)} relazioni datate fra norme. Segnalazioni pubblicate: ${numero(pubblicate)}. Aggiornato al ${manifest.knownAt.slice(0, 10)}.`
      : `Segnalazioni pubblicate: ${numero(pubblicate)}.`,
    '',
    'Licenze: software EUPL 1.2; dataset derivato CC BY 4.0; fonti Normattiva (CC BY 4.0) e Corte',
    'costituzionale (CC BY-SA 3.0).',
    '',
  ];
}

/** Come va citato questo sito, detto una volta e in modo che si possa copiare. */
function comeCitare(): string[] {
  return [
    '## Come citare questo sito',
    '',
    '- Ogni segnalazione ha un URL stabile: `/anomalia/<id>`. È quello da citare, non la home.',
    '- Il testo di una norma si indirizza con `/norma/<urn>` e una data: `?v=AAAA-MM-GG`. **Una',
    '  norma senza data di vigenza è un riferimento ambiguo**: lo stesso articolo dice cose diverse',
    '  in momenti diversi.',
    '- Una decisione della Corte costituzionale si indirizza con `/corte/sentenza-<numero>-<anno>`',
    '  (o `/corte/ordinanza-<numero>-<anno>`): è la forma con cui la si cita a voce. L’ECLI resta',
    '  l’identificatore del dato e sta scritto in pagina, ma non è più l’indirizzo.',
    '- Ogni cifra del sito è calcolata dal dataset pubblicato: chi vuole rifarla scarica il dataset',
    '  e riesegue la stessa query. Le regole sono in chiaro su ogni scheda.',
    '- Il testo ufficiale di una norma è quello in Gazzetta Ufficiale. Qui c’è un’elaborazione su',
    '  dati Normattiva, ed è il motivo per cui ogni scheda porta il testo citato alla lettera.',
    '',
  ];
}

/**
 * Il conto del progetto, generato dal registro dei consumi come ogni altra
 * cifra di questi file.
 *
 * Quando il registro è vuoto **lo dice**: un assistente che riassume questo
 * sito leggendo «costo: 0» scriverebbe che non costa niente, e lo scriverebbe
 * in una risposta che nessuno andrà a verificare.
 */
function quantoCosta(): string[] {
  const r = riepilogoConsumi();
  if (r.righe === 0) {
    return [
      'Il registro dei consumi del progetto è appena nato e non contiene ancora nessuna chiamata.',
      '**Non significa che il progetto non costi**: significa che la misura è appena cominciata e',
      `non c'è ancora niente da riportare. Il registro e il metodo sono a ${SITE_URL}/costi.`,
      '',
    ];
  }
  return [
    `- Chiamate a un modello linguistico registrate: ${numero(r.totali.chiamate)}, da ${r.dal} a ${r.al}.`,
    `- Costo stimato complessivo: ${denaro(r.totali.costo)}. **Stimato, non fatturato**: è il prodotto dei token per un listino pubblico e versionato, e si rifà a mano.`,
    r.costoMensile !== null
      ? `- Media sui mesi conclusi: ${denaro(r.costoMensile)} al mese. Il mese in corso resta fuori perché è incompleto.`
      : '- Non c’è ancora un mese concluso: una media mensile non esiste, e non va inventata.',
    `- Il registro conta il consumo dei modelli e **nient'altro**: il tempo delle persone, che è la voce più grossa, non ha un prezzo di listino e non compare.`,
    `- Nessuna pubblicità, nessun abbonamento, nessun tracciamento: ${SITE_URL}/costi.`,
    '',
  ];
}

export function llmsTxt(): string {
  const reader = dataset();
  const elenco = articoli().slice(0, 10);

  const righe = [
    ...intestazione(),
    '## Le pagine principali',
    '',
    `- [Le segnalazioni](${SITE_URL}/segnalazioni): l'indice di quello che i controlli hanno trovato.`,
    `- [I numeri](${SITE_URL}/numeri): le cifre principali, ciascuna con cosa misura e cosa no.`,
    `- [Dati e precisione](${SITE_URL}/dati): copertura del corpus e precisione misurata di ogni controllo.`,
    `- [Costi e contributori](${SITE_URL}/costi): quanto costa far girare il progetto, misurato chiamata per chiamata, chi ci ha lavorato e come contribuire.`,
    `- [Come funziona](${SITE_URL}/come-funziona): il metodo, i livelli di analisi, i limiti dichiarati.`,
    `- [Le norme del corpus](${SITE_URL}/norme): gli atti ingeriti, leggibili a qualunque data.`,
    `- [Le pronunce della Consulta](${SITE_URL}/corte): le declaratorie di illegittimità che colpiscono il corpus.`,
    `- [Approfondimenti](${SITE_URL}/blog): un articolo al giorno su una legge che non torna.`,
    `- [Per la stampa](${SITE_URL}/stampa): dataset, numeri citabili, contatti.`,
    `- [Mappa del sito](${SITE_URL}/mappa): tutto, in una pagina.`,
    '',
    '## I controlli',
    '',
    ...CHECK_DEFINITIONS.map((c) => {
      const m = reader.metric(c.id);
      const precisione =
        m && m.precision !== null
          ? `precisione misurata ${percentuale(m.precision)} su ${numero(m.reviewed)} revisioni`
          : 'precisione non ancora misurata';
      return `- [${c.label}](${SITE_URL}/controllo/${c.id}) (livello ${c.level}, ${precisione}): ${c.description}`;
    }),
    '',
    `Un controllo entra nell'indice pubblico sopra ${percentuale(THRESHOLD.minPrecision)} di precisione misurata su almeno ${numero(THRESHOLD.minSample)} revisioni.`,
    '',
    ...comeCitare(),
    '## Per gli assistenti',
    '',
    `- Server MCP ufficiale: \`npx -y @leggichenontornano/mcp\`, trasporto stdio, nessun account. Istruzioni: ${SITE_URL}/mcp`,
    `- API pubblica e dataset scaricabile: ${SITE_URL}/dati`,
    `- Versione estesa di questo file: ${SITE_URL}/llms-full.txt`,
    '',
  ];

  if (elenco.length > 0) {
    righe.push(
      '## Approfondimenti recenti',
      '',
      ...elenco.map((a) => `- [${a.titolo}](${SITE_URL}/blog/${a.slug}) — ${a.data}`),
      '',
    );
  }

  return righe.join('\n');
}

export function llmsFullTxt(): string {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const contatore = reader.counter();
  const pubblicate = reader.publishedAnomalies();

  const righe = [
    ...intestazione(),
    '## Che cosa fa questo progetto',
    '',
    'Legge il corpus normativo statale dagli open data di Normattiva, lo tiene in uno store',
    'bitemporale — vigenza da un lato, conoscenza dall’altro — e ne ricava un grafo di relazioni',
    'datate fra norme: chi modifica chi, chi abroga chi, chi rinvia a chi, da quando.',
    '',
    'Sopra quel grafo girano controlli. I controlli deterministici confrontano date e relazioni:',
    'una norma in vigore che rinvia a un atto abrogato è un fatto registrato, non un’opinione. Il',
    'risultato è una segnalazione con i testi originali, la regola in chiaro, e i criteri classici',
    'di risoluzione delle antinomie valutati uno per uno.',
    '',
    '## Cosa significano i livelli',
    '',
    '- **Livello 1** — attraversamento del grafo, nessuna estrazione. Confronta date e relazioni.',
    '- **Livello 2** — gerarchia delle fonti e competenza: rango degli atti e chi può incidere su chi.',
    '- **Livello 3** — confronto del contenuto: richiede di estrarre dal testo cosa una norma',
    '  impone, a chi ed entro quando, e poi di confrontare le estrazioni.',
    '',
    '## I numeri, e cosa misurano esattamente',
    '',
    `- Segnalazioni pubblicate: ${numero(pubblicate.length)}.`,
    manifest
      ? `- Corpus: ${numero(manifest.counts.acts)} atti, ${numero(manifest.counts.relations)} relazioni datate, ${numero(manifest.counts.pronunce ?? 0)} pronunce della Corte costituzionale.`
      : '',
    contatore
      ? `- Contatore: ${numero(contatore.totalDaysLate)} giorni trascorsi dalla scadenza dei termini fissati per ${numero(contatore.mandates)} provvedimenti attuativi previsti da ${numero(contatore.acts)} atti. **Misura termini scaduti, non attuazioni mancate**: che il provvedimento sia arrivato in ritardo o non sia arrivato affatto è una verifica in Gazzetta Ufficiale che il progetto non ha ancora fatto. Chi cita questo numero deve citarlo per quello che è.`
      : '',
    '',
    '## Quanto costa, e chi lo paga',
    '',
    ...quantoCosta(),
    '## Le regole del metodo',
    '',
    '1. **La contraddizione è una query, non un giudizio.** Un modello linguistico, dove viene',
    '   usato, riempie campi a partire da un comma alla volta e non vede mai due norme insieme. Il',
    '   confronto arriva dopo, ed è codice che chiunque può rileggere.',
    '2. **I testi originali stanno sempre in pagina.** Se una segnalazione è sbagliata, l’errore si',
    '   vede nel testo, non nel riassunto.',
    '3. **Le revisioni vengono da chi legge.** Ogni scheda ha un pulsante che apre una segnalazione',
    '   pubblica senza bisogno di un account, e le risposte cambiano la precisione misurata del',
    '   controllo — fino a toglierlo dal sito.',
    '4. **Assenza di segnale non significa norma coerente.** Il corpus è quello ingerito, non tutta',
    '   la legislazione: una norma che non compare non è per questo in ordine.',
    '',
    '## Cosa il progetto non fa, e non va attribuito',
    '',
    '- Non dà consulenza legale: nessuna segnalazione è un parere.',
    '- Non dichiara nulla illegittimo: quella è la Corte costituzionale.',
    '- Non assegna punteggi di qualità legislativa e non fa classifiche politiche.',
    '',
    ...comeCitare(),
    '## Errori da non fare quando si riassume questo sito',
    '',
    '- Non scrivere che una norma «è illegittima» o «viola» qualcosa: la scheda dice che due testi',
    '  non tornano fra loro, che è un’altra affermazione.',
    '- Non citare il contatore come «provvedimenti mai adottati»: misura termini scaduti.',
    '- Non citare un articolo senza la data di vigenza a cui lo si sta leggendo.',
    '- Non presentare il corpus come completo: è la porzione ingerita, ed è dichiarata.',
    '',
  ];

  return righe.filter((r) => r !== '').join('\n');
}
