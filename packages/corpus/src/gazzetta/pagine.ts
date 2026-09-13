/**
 * Lettura delle pagine della Gazzetta Ufficiale.
 *
 * Il portale non pubblica un'API e non pubblica i suoi indici come dati aperti:
 * quello che c'è è un modulo di ricerca che risponde in HTML. Queste funzioni
 * traducono quell'HTML in strutture, e sono volutamente pure — prendono una
 * stringa, restituiscono un oggetto — così i test girano su pagine salvate su
 * disco e nessuna prova ha bisogno della rete.
 *
 * Ogni volta che la Gazzetta cambia il suo markup questo file smette di
 * funzionare. È il costo dello scraping, e si preferisce che si veda: un
 * parser che non riconosce più la pagina restituisce `non-riconosciuta`, e chi
 * verifica ottiene `non-verificabile` invece di uno zero risultati preso per
 * buono.
 */

/** Una riga dell'elenco dei risultati. */
export interface RisultatoRicerca {
  /** Tipo e data come li stampa la Gazzetta, es. `DECRETO 3 marzo 2011`. */
  tipo: string;
  titolo: string;
  /** Il riferimento al fascicolo, es. `GU n.284 del 5-12-2017`. */
  riferimento: string | null;
  /** Percorso della scheda dell'atto, relativo alla base del sito. */
  percorso: string | null;
  /** Data di pubblicazione in Gazzetta, ISO, letta dal percorso. */
  dataPubblicazione: string | null;
  /** Codice redazionale, la chiave con cui la Gazzetta identifica l'atto. */
  codiceRedazionale: string | null;
}

/**
 * L'esito della lettura di una pagina di risultati.
 *
 *  - `elenco`      la ricerca ha risposto, e questi sono i risultati;
 *  - `nessuno`     la ricerca ha risposto che non ha trovato niente;
 *  - `troppi`      la ricerca ha trovato più di quanto il portale mostri;
 *  - `non-riconosciuta` la pagina non è quella che ci aspettiamo.
 */
export type EsitoPagina =
  | { stato: 'elenco'; totale: number; risultati: RisultatoRicerca[] }
  | { stato: 'nessuno' }
  | { stato: 'troppi'; totale: number }
  | { stato: 'non-riconosciuta' };

const TOTALE_ESATTO = /Risultati della ricerca:\s*([\d.]+)\s*atti/i;
// Sopra il tetto del portale la pagina cambia frase e aggiunge l'avviso che si
// possono vedere solo i primi N: è il segnale che la nostra query è troppo
// larga per concludere qualcosa.
const TOTALE_TRONCATO = /Sono stati trovati\s*([\d.]+)\s*atti/i;
const NESSUN_RISULTATO = /non ha prodotto risultati|non sono stati trovati|Nessun atto/i;

export function leggiPaginaRisultati(html: string): EsitoPagina {
  const troncato = TOTALE_TRONCATO.exec(html);
  if (troncato) return { stato: 'troppi', totale: numero(troncato[1]!) };
  if (NESSUN_RISULTATO.test(html)) return { stato: 'nessuno' };

  const esatto = TOTALE_ESATTO.exec(html);
  const blocchi = html.split('<span class="risultato">').slice(1);
  if (!esatto && blocchi.length === 0) return { stato: 'non-riconosciuta' };

  const risultati = blocchi.map(leggiRiga);
  return { stato: 'elenco', totale: esatto ? numero(esatto[1]!) : risultati.length, risultati };
}

function leggiRiga(blocco: string): RisultatoRicerca {
  const percorso = decodeHtml(/href="(\/atto\/[^"]+)"/.exec(blocco)?.[1] ?? '') || null;
  const tipo = testo(/<span class="data">([\s\S]*?)<\/span>/.exec(blocco)?.[1] ?? '');
  const riferimento = testo(
    /<span class="riferimento">\(([^)]*)\)<\/span>/.exec(blocco)?.[1] ?? '',
  );
  const titolo = testo(
    blocco
      .replace(/<span class="data">[\s\S]*?<\/span>/, ' ')
      .replace(/<span class="riferimento">[\s\S]*?<\/span>/, ' '),
  );
  return {
    tipo,
    titolo,
    riferimento: riferimento || null,
    percorso,
    dataPubblicazione:
      /dataPubblicazioneGazzetta=(\d{4}-\d{2}-\d{2})/.exec(percorso ?? '')?.[1] ?? null,
    codiceRedazionale: /codiceRedazionale=([A-Za-z0-9]+)/.exec(percorso ?? '')?.[1] ?? null,
  };
}

/**
 * I link agli articoli, dall'indice dell'«atto completo».
 *
 * Il testo di un provvedimento non sta in una pagina sola: l'indice elenca gli
 * articoli e ciascuno si carica a parte. A noi serve il primo, perché il
 * preambolo — la sequenza dei «Visto» — sta lì.
 */
export function leggiIndiceArticoli(html: string): string[] {
  const trovati = [...html.matchAll(/href="(\/atto\/serie_generale\/caricaArticolo\?[^"]+)"/g)].map(
    (m) => decodeHtml(m[1]!),
  );
  return [...new Set(trovati)];
}

/**
 * Il testo di una pagina di atto, ripulito dal markup.
 *
 * Non è una conversione fedele e non deve esserlo: serve a cercarci dentro una
 * citazione e a ritagliarne la frase. La punteggiatura e le entità che contano
 * per quello — apostrofi, virgolette, accenti — sono tradotte; il resto
 * diventa spazio.
 */
export function leggiTestoAtto(html: string): string {
  return testo(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|tr)>/gi, ' '),
  );
}

const ENTITA: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&laquo;': '«',
  '&raquo;': '»',
  '&agrave;': 'à',
  '&egrave;': 'è',
  '&eacute;': 'é',
  '&igrave;': 'ì',
  '&ograve;': 'ò',
  '&ugrave;': 'ù',
  '&Egrave;': 'È',
  '&Eacute;': 'É',
};

export function decodeHtml(valore: string): string {
  return valore
    .replace(/&[A-Za-z#0-9]+;/g, (e) => ENTITA[e] ?? e)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

function testo(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function numero(valore: string): number {
  return Number(valore.replace(/\./g, ''));
}
