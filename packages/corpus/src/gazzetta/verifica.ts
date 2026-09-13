/**
 * La verifica in Gazzetta Ufficiale di un mandato attuativo.
 *
 * La domanda è una sola: *questo comma prevedeva un decreto — è stato
 * pubblicato?* Le risposte ammesse sono tre, e mai due insieme.
 *
 *  - `adottato`        c'è un provvedimento che cita quel comma, con lo
 *                      strumento previsto, e ne abbiamo la frase del preambolo;
 *  - `non-adottato`    la ricerca ha coperto tutto l'intervallo e l'atto che
 *                      prevede il provvedimento non è citato **da nessuna
 *                      parte** in Gazzetta in quell'intervallo;
 *  - `non-verificabile` tutto il resto.
 *
 * ## Due domande, e solo la seconda può dire «non adottato»
 *
 * La **prima** è stretta e cerca il provvedimento: la citazione del comma, e
 * poi il preambolo dell'atto trovato, che quel comma lo deve richiamare per
 * davvero. Trova qualcosa in una parte dei casi, e quando trova, dimostra.
 *
 * La **seconda** è larga, e serve al caso opposto. Non poggia sulla citazione
 * del comma — che i preamboli scrivono in dieci modi, «art. 1, co. 5, della l.
 * 81/2017» compreso, e il cui mancato ritrovamento non prova niente — ma sulla
 * citazione dell'atto ridotta all'osso: «22 maggio 2017, n. 81». Quella
 * stringa è dentro ogni forma di richiamo, per esteso o abbreviata. Se **non**
 * compare in nessun atto della Serie Generale nell'intervallo, allora nessun
 * provvedimento attuativo di quella legge è stato pubblicato, e l'affermazione
 * regge.
 *
 * La conseguenza è che le leggi molto citate non producono quasi mai un
 * `non-adottato`. È il verso giusto in cui sbagliare: una copertura bassa
 * costa segnalazioni che non facciamo, una copertura gonfiata costerebbe
 * un'affermazione falsa su una legge — e quella non si recupera.
 */
import { createHash } from 'node:crypto';
import {
  citaIlMandato,
  citazioneAtto,
  citazioniDelComma,
  clausolaDelPreambolo,
  estremiDaUrn,
  famigliaAttesa,
  famigliaDalTipo,
} from './citazione.js';
import { GazzettaClient, GAZZETTA_FONTE, type FinestraAnni } from './client.js';
import { leggiIndiceArticoli, leggiPaginaRisultati, leggiTestoAtto } from './pagine.js';

export type EsitoVerificaAttuazione = 'adottato' | 'non-adottato' | 'non-verificabile';

/**
 * Il mandato da verificare.
 *
 * La forma coincide con quella che il motore estrae dai commi. È ridichiarata
 * qui invece di essere importata perché la dipendenza fra i pacchetti va in un
 * verso solo: il motore conosce il corpus, il corpus non conosce il motore.
 */
export interface MandatoDaVerificare {
  actUrn: string;
  articleNumber: string | null;
  provisionNumber: string | null;
  /** Strumento previsto, come lo nomina il testo della legge. */
  instrument: string;
  deadlineDays: number;
  /** Data entro cui il provvedimento andava adottato. */
  dueBy: string | null;
  /** La frase da cui il mandato è stato letto. */
  quote: string;
}

/** Gli estremi del provvedimento trovato, come li stampa la Gazzetta. */
export interface ProvvedimentoTrovato {
  /** Tipo e data, es. `DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI 26 aprile 2020`. */
  tipo: string;
  titolo: string;
  /** Il fascicolo, es. `GU n.284 del 5-12-2017`. */
  gazzetta: string | null;
  /** Data di pubblicazione in Gazzetta, ISO. */
  dataPubblicazione: string | null;
  codiceRedazionale: string | null;
  url: string | null;
}

/**
 * Una verifica, con la sua prova.
 *
 * Non basta registrare l'esito: senza la query esatta, l'URL interrogato e la
 * data non c'è modo di contestare la verifica, e una verifica che non si può
 * contestare non vale niente. Sono campi obbligatori per questo.
 */
export interface RisultatoVerifica {
  /** Identificatore del mandato: stabile fra un giro e l'altro. */
  chiave: string;
  actUrn: string;
  articleNumber: string | null;
  provisionNumber: string | null;
  strumento: string;
  deadlineDays: number;
  dueBy: string | null;
  /** La frase del comma da cui il mandato è stato letto. */
  mandato: string;
  esito: EsitoVerificaAttuazione;
  /** Perché questo esito, in lingua comune. Sempre valorizzato. */
  motivo: string;
  /** La frase esatta cercata in Gazzetta. */
  query: string;
  /** L'URL interrogato. */
  url: string;
  fonte: string;
  finestraDa: number;
  finestraA: number;
  /** Quanti atti ha restituito l'ultima ricerca utile. */
  risultati: number;
  verificatoIl: string;
  provvedimento: ProvvedimentoTrovato | null;
  /** La citazione letterale su cui si basa la corrispondenza. */
  citazione: string | null;
}

/**
 * La chiave di un mandato.
 *
 * Gli stessi componenti con cui il motore costruisce l'identificatore della
 * segnalazione: così la verifica e la segnalazione parlano dello stesso
 * mandato, e il cancello di pubblicazione può confrontarle.
 */
export function chiaveMandato(mandato: {
  actUrn: string;
  articleNumber: string | null;
  provisionNumber: string | null;
  deadlineDays: number;
}): string {
  const parti = [
    mandato.actUrn,
    mandato.articleNumber ?? '',
    mandato.provisionNumber ?? '',
    String(mandato.deadlineDays),
  ].join('|');
  return `vga_${createHash('sha1').update(parti).digest('hex').slice(0, 16)}`;
}

export interface OpzioniVerifica {
  client?: GazzettaClient;
  /** Data di riferimento per «oggi», per giri riproducibili. */
  oggi?: string;
  /**
   * Quanti candidati si accetta di esaminare per un mandato.
   *
   * Oltre questo numero la ricerca è considerata ambigua: non perché non si
   * possa scorrere di più, ma perché una citazione che compare in venti atti
   * diversi non identifica un provvedimento attuativo, identifica una norma
   * molto richiamata.
   */
  massimoCandidati?: number;
  onProgress?: (messaggio: string) => void;
}

/**
 * Verifica un mandato. Non solleva: ogni guaio diventa `non-verificabile`.
 *
 * `memoria` permette a più mandati dello stesso atto di condividere le ricerche
 * già fatte. Non è un'ottimizzazione interna: è il modo di non ripetere la
 * stessa domanda a un sito pubblico novanta volte perché novanta commi della
 * stessa legge prevedono un decreto.
 */
export async function verificaMandato(
  mandato: MandatoDaVerificare,
  opzioni: OpzioniVerifica = {},
  memoria: Map<string, unknown> = new Map(),
): Promise<RisultatoVerifica> {
  const client = opzioni.client ?? new GazzettaClient();
  const oggi = opzioni.oggi ?? new Date().toISOString().slice(0, 10);
  const massimoCandidati = opzioni.massimoCandidati ?? 5;
  const log = opzioni.onProgress ?? (() => undefined);

  const base = {
    chiave: chiaveMandato(mandato),
    actUrn: mandato.actUrn,
    articleNumber: mandato.articleNumber,
    provisionNumber: mandato.provisionNumber,
    strumento: mandato.instrument,
    deadlineDays: mandato.deadlineDays,
    dueBy: mandato.dueBy,
    mandato: mandato.quote,
    fonte: GAZZETTA_FONTE,
    verificatoIl: new Date().toISOString(),
    provvedimento: null,
    citazione: null,
  };

  const estremi = estremiDaUrn(mandato.actUrn);
  if (!estremi) {
    return {
      ...base,
      esito: 'non-verificabile',
      motivo:
        'L’atto che prevede il provvedimento non ha estremi citabili in Gazzetta Ufficiale: senza una forma di citazione non c’è una ricerca da fare.',
      query: '',
      url: '',
      finestraDa: 0,
      finestraA: 0,
      risultati: 0,
    };
  }

  const finestra: FinestraAnni = { da: estremi.anno, a: Number(oggi.slice(0, 4)) };
  const vuoto = { finestraDa: finestra.da, finestraA: finestra.a, risultati: 0 };

  if (!mandato.articleNumber) {
    return {
      ...base,
      ...vuoto,
      esito: 'non-verificabile',
      motivo:
        'Il mandato non è agganciato a un articolo dell’atto: la citazione che un preambolo userebbe non si può costruire.',
      query: '',
      url: '',
    };
  }

  const famiglie = famigliaAttesa(mandato.instrument);
  if (!famiglie) {
    return {
      ...base,
      ...vuoto,
      esito: 'non-verificabile',
      motivo: `Il testo dice «${mandato.instrument}» senza nominare chi adotta il provvedimento: non sappiamo in che forma cercarlo in Gazzetta.`,
      query: '',
      url: '',
    };
  }

  // Prima domanda, stretta: esiste un provvedimento che cita **questo comma**?
  //
  // Senza il numero del comma la domanda non si pone: un provvedimento che
  // richiama l'articolo intero può attuare un altro dei suoi commi, e
  // scambiarlo per il nostro sarebbe una corrispondenza inventata. Si passa
  // direttamente alla domanda larga, che un `non-adottato` lo può ancora dare.
  const comma = mandato.provisionNumber;
  for (const query of comma ? citazioniDelComma(estremi, mandato.articleNumber, comma) : []) {
    const pagina = await ricerca(client, query, finestra, memoria);
    if (pagina.stato === 'errore') {
      return {
        ...base,
        ...vuoto,
        esito: 'non-verificabile',
        motivo: pagina.motivo,
        query,
        url: pagina.url,
      };
    }
    if (pagina.esito.stato === 'troppi') {
      return {
        ...base,
        esito: 'non-verificabile',
        motivo: `La ricerca su «${query}» restituisce ${pagina.esito.totale} atti: troppi perché il risultato identifichi un provvedimento.`,
        query,
        url: pagina.url,
        finestraDa: finestra.da,
        finestraA: finestra.a,
        risultati: pagina.esito.totale,
      };
    }
    if (pagina.esito.stato !== 'elenco') continue;

    const candidati = pagina.esito.risultati.filter((r) => {
      const famiglia = famigliaDalTipo(r.tipo);
      return famiglia !== null && famiglie.includes(famiglia);
    });
    if (candidati.length === 0) continue;
    if (candidati.length > massimoCandidati) {
      return {
        ...base,
        esito: 'non-verificabile',
        motivo: `Alla citazione «${query}» rispondono ${candidati.length} provvedimenti dello stesso tipo: la corrispondenza non è univoca.`,
        query,
        url: pagina.url,
        finestraDa: finestra.da,
        finestraA: finestra.a,
        risultati: pagina.esito.totale,
      };
    }

    // Prima quelli il cui **titolo** dichiara di attuare questo comma: sono i
    // provvedimenti attuativi veri, e la Gazzetta li intitola così. Gli altri
    // possono limitarsi a citare il comma di passaggio — o a citare il decreto
    // che lo ha attuato — e fra questi vince il più antico, perché se più
    // provvedimenti insistono sullo stesso comma quello che chiude il ritardo è
    // il primo arrivato.
    const ordinati = [...candidati].sort((a, b) => {
      const titoloA = citaIlMandato(a.titolo, estremi, mandato.articleNumber!, comma!) ? 0 : 1;
      const titoloB = citaIlMandato(b.titolo, estremi, mandato.articleNumber!, comma!) ? 0 : 1;
      if (titoloA !== titoloB) return titoloA - titoloB;
      return (a.dataPubblicazione ?? '') < (b.dataPubblicazione ?? '') ? -1 : 1;
    });
    for (const candidato of ordinati) {
      // Quando il titolo stesso dichiara il mandato — «Assegnazione di risorse
      // finanziarie di cui all'articolo 1, comma 1028, della legge 30 dicembre
      // 2018, n. 145» — la prova è più forte di qualunque riga di preambolo: è
      // il provvedimento che dice di sé cosa attua, ed è la formula con cui la
      // Gazzetta lo indicizza. Vale la citazione, e risparmia due richieste.
      const dalTitolo = citaIlMandato(candidato.titolo, estremi, mandato.articleNumber, comma!);
      const citazione = dalTitolo
        ? candidato.titolo
        : clausolaDelPreambolo(
            (await leggiPreambolo(
              client,
              candidato.dataPubblicazione,
              candidato.codiceRedazionale,
            )) ?? '',
            estremi,
            mandato.articleNumber,
            comma!,
          );
      if (!citazione) continue;
      log(`${mandato.actUrn} art. ${mandato.articleNumber}: adottato — ${candidato.tipo}`);
      return {
        ...base,
        esito: 'adottato',
        motivo: dalTitolo
          ? 'Il titolo con cui il provvedimento è pubblicato in Gazzetta dichiara il mandato che attua.'
          : 'Il preambolo del provvedimento cita il mandato: la corrispondenza è quella riga, non una somiglianza fra titoli.',
        query,
        url: pagina.url,
        finestraDa: finestra.da,
        finestraA: finestra.a,
        risultati: pagina.esito.totale,
        provvedimento: {
          tipo: candidato.tipo,
          titolo: candidato.titolo,
          gazzetta: candidato.riferimento,
          dataPubblicazione: candidato.dataPubblicazione,
          codiceRedazionale: candidato.codiceRedazionale,
          url:
            candidato.dataPubblicazione && candidato.codiceRedazionale
              ? client.schedaAtto(candidato.dataPubblicazione, candidato.codiceRedazionale)
              : null,
        },
        citazione,
      };
    }

    // Trovati, ma nessun preambolo cita davvero quel comma — o non si è potuto
    // leggerlo. Senza la prova letterale non si afferma niente: la
    // corrispondenza resterebbe una nostra deduzione dal risultato di ricerca.
    return {
      ...base,
      esito: 'non-verificabile',
      motivo:
        'Alla citazione rispondono provvedimenti dello strumento previsto, ma nel preambolo di nessuno di essi si legge il richiamo a questo comma: la corrispondenza non è dimostrata.',
      query,
      url: pagina.url,
      finestraDa: finestra.da,
      finestraA: finestra.a,
      risultati: pagina.esito.totale,
    };
  }

  // Seconda domanda, larga: l'atto che prevede il provvedimento è mai citato?
  // È l'unica strada per un «non adottato» che regga.
  const query = citazioneAtto(estremi);
  const pagina = await ricerca(client, query, finestra, memoria);
  if (pagina.stato === 'errore') {
    return {
      ...base,
      ...vuoto,
      esito: 'non-verificabile',
      motivo: pagina.motivo,
      query,
      url: pagina.url,
    };
  }
  if (pagina.esito.stato === 'nessuno') {
    log(`${mandato.actUrn} art. ${mandato.articleNumber}: non adottato`);
    return {
      ...base,
      ...vuoto,
      esito: 'non-adottato',
      motivo: `Fra il ${finestra.da} e il ${finestra.a} nessun atto della Serie Generale cita «${query}»: nessun provvedimento attuativo di questo atto è stato pubblicato in Gazzetta Ufficiale.`,
      query,
      url: pagina.url,
    };
  }
  const quanti =
    pagina.esito.stato === 'elenco'
      ? pagina.esito.totale
      : pagina.esito.stato === 'troppi'
        ? pagina.esito.totale
        : 0;
  return {
    ...base,
    esito: 'non-verificabile',
    motivo: comma
      ? `L’atto è citato da ${quanti} atti pubblicati in Gazzetta, ma nessuno di essi richiama questo comma nella forma cercata e con lo strumento previsto. «Non l’ho trovato» non autorizza a dire «non esiste».`
      : `Il mandato non è agganciato a un comma, e l’atto è citato da ${quanti} atti pubblicati in Gazzetta: un provvedimento che richiama l’articolo intero può attuare un altro dei suoi commi, quindi non si conclude niente.`,
    query,
    url: pagina.url,
    finestraDa: finestra.da,
    finestraA: finestra.a,
    risultati: quanti,
  };
}

type EsitoRicerca =
  | { stato: 'ok'; esito: ReturnType<typeof leggiPaginaRisultati>; url: string }
  | { stato: 'errore'; motivo: string; url: string; riprovabile: boolean };

async function ricerca(
  client: GazzettaClient,
  query: string,
  finestra: FinestraAnni,
  memoria: Map<string, unknown>,
): Promise<EsitoRicerca> {
  const chiave = `${query}|${finestra.da}|${finestra.a}`;
  const gia = memoria.get(chiave);
  if (gia) return gia as EsitoRicerca;

  // Fino a tre tentativi, e solo quando la pagina non si riconosce.
  //
  // Non è ostinazione: il portale ogni tanto risponde con la propria pagina
  // iniziale invece che con i risultati, e ricaricare il modulo lo rimette in
  // sesto. Su un campione di dodici ricerche capitava tre volte; senza questo
  // giro, un quarto delle verifiche finirebbe `non-verificabile` per una
  // ragione che non ha niente a che fare con la legge che stiamo verificando.
  //
  // Tre e non di più. Martellare un sito pubblico finché non dà la risposta che
  // ci fa comodo è l'opposto di quello che questa verifica deve fare, e ogni
  // tentativo rispetta comunque la pausa che il client impone.
  let risultato = await unTentativo(client, query, finestra);
  for (let tentativo = 1; tentativo < 3; tentativo++) {
    if (risultato.stato !== 'errore' || !risultato.riprovabile) break;
    risultato = await unTentativo(client, query, finestra);
  }
  memoria.set(chiave, risultato);
  return risultato;
}

async function unTentativo(
  client: GazzettaClient,
  query: string,
  finestra: FinestraAnni,
): Promise<EsitoRicerca> {
  try {
    const risposta = await client.cerca(query, finestra);
    if (risposta.stato !== 200) {
      return {
        stato: 'errore',
        motivo: `La Gazzetta Ufficiale ha risposto ${risposta.stato}: la ricerca non è stata fatta.`,
        url: risposta.url,
        riprovabile: false,
      };
    }
    const esito = leggiPaginaRisultati(risposta.corpo);
    if (esito.stato === 'non-riconosciuta') {
      return {
        stato: 'errore',
        motivo:
          'La pagina dei risultati non ha la forma attesa: uno zero risultati letto da una pagina che non si riconosce non è una prova.',
        url: risposta.url,
        riprovabile: true,
      };
    }
    return { stato: 'ok', esito, url: risposta.url };
  } catch (errore) {
    return {
      stato: 'errore',
      motivo: `La Gazzetta Ufficiale non è raggiungibile (${errore instanceof Error ? errore.message : String(errore)}): la ricerca non è stata fatta.`,
      url: client.url('/'),
      riprovabile: false,
    };
  }
}

/**
 * Il preambolo di un provvedimento.
 *
 * Il testo non sta nella scheda: sta nella pagina dell'articolo, e l'indice
 * dell'atto completo dice dove. Due richieste, fatte solo sui candidati che
 * hanno già superato la ricerca — non su tutta la Gazzetta.
 */
async function leggiPreambolo(
  client: GazzettaClient,
  dataPubblicazione: string | null,
  codiceRedazionale: string | null,
): Promise<string | null> {
  if (!dataPubblicazione || !codiceRedazionale) return null;
  try {
    const indice = await client.indiceAtto(dataPubblicazione, codiceRedazionale);
    if (indice.stato !== 200) return null;
    const articoli = leggiIndiceArticoli(indice.corpo);
    const primo = articoli[0];
    if (!primo) return leggiTestoAtto(indice.corpo);
    const pagina = await client.pagina(primo);
    if (pagina.stato !== 200) return null;
    return leggiTestoAtto(pagina.corpo);
  } catch {
    return null;
  }
}
