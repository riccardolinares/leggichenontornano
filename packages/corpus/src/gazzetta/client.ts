/**
 * Il client della Gazzetta Ufficiale.
 *
 * Il portale non ha un'API e non pubblica open data: c'è un modulo di ricerca
 * che risponde in HTML, e lo si interroga come lo interrogherebbe una persona.
 * Tre regole, e nessuna è negoziabile.
 *
 * **Ci si presenta.** Lo `user-agent` dice il nome del progetto e l'indirizzo
 * del repository. Chi amministra quel sito deve poter capire in due secondi chi
 * sta bussando e scriverci se qualcosa non va.
 *
 * **Una richiesta alla volta, con una pausa in mezzo.** Le chiamate sono
 * serializzate e separate da almeno `intervalloMs` (1,5 secondi di default,
 * cioè più lento del minimo che ci eravamo dati). Un servizio pubblico lo
 * pagano tutti: la verifica di diecimila mandati può durare una settimana di
 * notti, non è un problema.
 *
 * **Quando non risponde, non si indovina.** Ogni errore risale al chiamante
 * come tale, e chi verifica lo traduce in `non-verificabile`. Non esiste in
 * questo file un percorso che restituisca «nessun risultato» per una richiesta
 * fallita: è la differenza fra «il decreto non c'è» e «non ho potuto guardare».
 */

export const GAZZETTA_BASE = process.env['GAZZETTA_BASE'] ?? 'https://www.gazzettaufficiale.it';

export const GAZZETTA_FONTE =
  'Gazzetta Ufficiale della Repubblica Italiana — www.gazzettaufficiale.it, Serie Generale';

const UA_PREDEFINITO =
  'leggichenontornano/0.1 (+https://github.com/riccardolinares/leggichenontornano) progetto civico open source';

/** La pagina del modulo di ricerca: serve ad aprire la sessione. */
const MODULO = '/ricerca/atto/serie_generale/originario?reset=true&normativi=false';
/** L'azione che esegue la ricerca. Lo zero finale è la pagina dei risultati. */
const AZIONE = '/do/ricerca/atto/serie_generale/originario/0';

export interface OpzioniGazzetta {
  baseUrl?: string;
  userAgent?: string;
  /** Millisecondi minimi fra due richieste. Non scende sotto 1000. */
  intervalloMs?: number;
  fetchImpl?: typeof fetch;
  onProgress?: (messaggio: string) => void;
}

export interface RispostaGazzetta {
  stato: number;
  corpo: string;
  url: string;
}

/** La finestra di pubblicazione su cui restringere la ricerca, per anno. */
export interface FinestraAnni {
  da: number;
  a: number;
}

export class GazzettaClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly intervalloMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (m: string) => void;
  /** Il barattolo dei cookie, per nome: vedi `raccogliCookie`. */
  private readonly cookie = new Map<string, string>();
  /**
   * Se il modulo di ricerca è caricato e non ancora consumato.
   *
   * Il portale tiene i criteri in sessione, e quella sessione vale per **una
   * ricerca sola**: dopo una ricerca — o dopo essere passati per la scheda di
   * un atto — la richiesta successiva viene rimandata alla pagina iniziale.
   * Risponde 200, ha la forma di una pagina normale e non contiene risultati.
   *
   * Senza questo interruttore quella pagina si legge come «non trovato», ed è
   * il modo più facile che esista di affermare il falso su una legge. Per
   * questo il modulo si ricarica prima di ogni ricerca: una richiesta in più
   * per non correre quel rischio è il cambio migliore del repository.
   */
  private moduloPronto = false;
  /** Ultima richiesta partita: serve a tenere la distanza fra una e l'altra. */
  private ultimaRichiesta = 0;
  /** Catena delle richieste: le serializza senza bisogno di un semaforo. */
  private coda: Promise<unknown> = Promise.resolve();

  constructor(opzioni: OpzioniGazzetta = {}) {
    this.baseUrl = (opzioni.baseUrl ?? GAZZETTA_BASE).replace(/\/+$/, '');
    this.userAgent = opzioni.userAgent ?? UA_PREDEFINITO;
    this.intervalloMs = Math.max(1000, opzioni.intervalloMs ?? 1500);
    this.fetchImpl = opzioni.fetchImpl ?? fetch;
    this.log = opzioni.onProgress ?? (() => undefined);
  }

  /** L'URL assoluto di un percorso del portale: finisce nelle prove. */
  url(percorso: string): string {
    return percorso.startsWith('http') ? percorso : `${this.baseUrl}${percorso}`;
  }

  /**
   * Cerca la frase esatta nel testo degli atti della Serie Generale.
   *
   * `ENTIRE_STRING` è la modalità del portale che cerca la stringa intera: è
   * quella che rende la domanda precisa. Con `ALL_WORDS` «articolo 1 comma 5
   * legge 81» tornerebbe mezza Gazzetta, e su mezza Gazzetta non si conclude
   * niente.
   */
  async cerca(frase: string, finestra: FinestraAnni): Promise<RispostaGazzetta> {
    await this.apriModulo();
    const campi = new URLSearchParams({
      tipoRicercaTitolo: 'ENTIRE_STRING',
      titolo: '',
      tipoRicercaTesto: 'ENTIRE_STRING',
      testo: frase,
      annoPubblicazioneDa: String(finestra.da),
      annoPubblicazioneA: String(finestra.a),
      attiNumerati: 'false',
      cerca: 'Cerca',
    });
    this.log(`cerco «${frase}» fra il ${finestra.da} e il ${finestra.a}`);
    this.moduloPronto = false;
    return this.richiesta(AZIONE, campi);
  }

  /** L'indice dell'«atto completo»: da qui si risale al testo degli articoli. */
  async indiceAtto(
    dataPubblicazione: string,
    codiceRedazionale: string,
  ): Promise<RispostaGazzetta> {
    const percorso =
      `/atto/vediMenuHTML?atto.dataPubblicazioneGazzetta=${dataPubblicazione}` +
      `&atto.codiceRedazionale=${codiceRedazionale}&tipoSerie=serie_generale&tipoVigenza=originario`;
    this.moduloPronto = false;
    return this.richiesta(percorso);
  }

  /** Una pagina qualunque del portale, per percorso relativo. */
  async pagina(percorso: string): Promise<RispostaGazzetta> {
    this.moduloPronto = false;
    return this.richiesta(percorso);
  }

  /**
   * La scheda pubblica di un atto: è l'URL che finisce nella prova.
   *
   * Non si chiama, si costruisce. Deve poter comparire in una segnalazione
   * anche quando la verifica è stata fatta mesi prima.
   */
  schedaAtto(dataPubblicazione: string, codiceRedazionale: string): string {
    return (
      `${this.baseUrl}/atto/serie_generale/caricaDettaglioAtto/originario` +
      `?atto.dataPubblicazioneGazzetta=${dataPubblicazione}&atto.codiceRedazionale=${codiceRedazionale}`
    );
  }

  /** Carica il modulo di ricerca, se non è già caricato e intatto. */
  private async apriModulo(): Promise<void> {
    if (this.moduloPronto) return;
    await this.richiesta(MODULO);
    this.moduloPronto = true;
  }

  private richiesta(percorso: string, campi?: URLSearchParams): Promise<RispostaGazzetta> {
    const esito = this.coda.then(() => this.esegui(percorso, campi));
    // La coda non deve morire su un errore: chi ha chiesto riceve il rifiuto,
    // le richieste successive restano in fila.
    this.coda = esito.catch(() => undefined);
    return esito;
  }

  private async esegui(percorso: string, campi?: URLSearchParams): Promise<RispostaGazzetta> {
    const attesa = this.ultimaRichiesta + this.intervalloMs - Date.now();
    if (attesa > 0) await new Promise((r) => setTimeout(r, attesa));
    this.ultimaRichiesta = Date.now();

    const url = this.url(percorso);
    const intestazioni: Record<string, string> = { 'user-agent': this.userAgent };
    const cookie = this.intestazioneCookie();
    if (cookie) intestazioni['cookie'] = cookie;
    if (campi) intestazioni['content-type'] = 'application/x-www-form-urlencoded';

    const risposta = await this.fetchImpl(url, {
      ...(campi ? { method: 'POST', body: campi.toString() } : { method: 'GET' }),
      headers: intestazioni,
    });
    this.raccogliCookie(risposta.headers.getSetCookie?.() ?? []);
    return { stato: risposta.status, corpo: await risposta.text(), url };
  }

  /**
   * Aggiunge i cookie della risposta a quelli che già abbiamo, **per nome**.
   *
   * Sostituirli in blocco era un errore che costava metà delle verifiche: il
   * portale risponde a una pagina qualunque impostando un solo cookie di
   * tracciamento, e prendere quello come l'intero barattolo buttava via
   * `JSESSIONID`. Da lì in poi ogni ricerca riceveva la pagina iniziale al
   * posto dei risultati — con uno stato 200, che è il modo silenzioso di
   * sbagliare.
   */
  private raccogliCookie(intestazioni: readonly string[]): void {
    for (const riga of intestazioni) {
      const coppia = riga.split(';')[0]?.trim();
      if (!coppia) continue;
      const taglio = coppia.indexOf('=');
      if (taglio <= 0) continue;
      this.cookie.set(coppia.slice(0, taglio), coppia.slice(taglio + 1));
    }
  }

  private intestazioneCookie(): string {
    return [...this.cookie].map(([nome, valore]) => `${nome}=${valore}`).join('; ');
  }
}
