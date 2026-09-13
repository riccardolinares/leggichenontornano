import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  citaIlMandato,
  citazioneAtto,
  citazioniDelComma,
  clausolaDelPreambolo,
  estremiDaUrn,
  famigliaAttesa,
  famigliaDalTipo,
  GazzettaClient,
  leggiIndiceArticoli,
  leggiPaginaRisultati,
  leggiTestoAtto,
  verificaMandato,
  type MandatoDaVerificare,
} from '../src/gazzetta/index.js';

/**
 * Le pagine su cui girano questi test sono **risposte vere** della Gazzetta
 * Ufficiale, registrate il 13 settembre 2026 e salvate su disco. Nessun test di
 * questo file tocca la rete: una verifica che dipende da un sito raggiungibile
 * fallisce il giorno in cui quel sito è lento, e allora si smette di guardarla.
 *
 * Tre di questi casi sono errori che il verificatore ha commesso prima di
 * essere corretto, e stanno qui perché non li ricommetta: la sessione consumata
 * che restituiva la pagina iniziale al posto dei risultati, il trattino di
 * «decreto-legge» che faceva degenerare la query, e la corrispondenza presa per
 * buona dal solo risultato di ricerca.
 */
const FIXTURES = join(import.meta.dirname, 'fixtures', 'gazzetta');
const pagina = (nome: string): string => readFileSync(join(FIXTURES, `${nome}.html`), 'utf8');

const LEGGE_145 = 'urn:nir:stato:legge:2018-12-30;145';
const DL_225 = 'urn:nir:stato:decreto.legge:2010-12-29;225';

const mandato = (parziale: Partial<MandatoDaVerificare> = {}): MandatoDaVerificare => ({
  actUrn: LEGGE_145,
  articleNumber: '1',
  provisionNumber: '1028',
  instrument: 'decreto del Presidente del Consiglio dei ministri',
  deadlineDays: 60,
  dueBy: '2019-03-01',
  quote:
    'Con decreto del Presidente del Consiglio dei ministri sono assegnate le risorse entro sessanta giorni.',
  ...parziale,
});

/**
 * Una Gazzetta finta che serve pagine salvate.
 *
 * `risposte` è una lista di coppie: il primo criterio che riconosce la
 * richiesta vince. Serve a riprodurre la sequenza vera — modulo, ricerca,
 * indice dell'atto, testo dell'articolo — senza fare una sola richiesta.
 */
function gazzettaFinta(
  risposte: Array<[criterio: (url: string, corpo: string) => boolean, stato: number, html: string]>,
): { client: GazzettaClient; richieste: string[] } {
  const richieste: string[] = [];
  const client = new GazzettaClient({
    intervalloMs: 1000,
    // I test non aspettano: l'intervallo vero lo impone il client in esercizio,
    // e verificarlo qui vorrebbe dire far durare la suite dei minuti.
    fetchImpl: (async (url: string, init?: RequestInit) => {
      const corpo = typeof init?.body === 'string' ? init.body : '';
      richieste.push(`${init?.method ?? 'GET'} ${url} ${corpo}`);
      const trovata = risposte.find(([criterio]) => criterio(String(url), corpo));
      if (!trovata) return new Response('', { status: 404 });
      return new Response(trovata[2], { status: trovata[1] });
    }) as unknown as typeof fetch,
  });
  // L'attesa fra due richieste è reale anche qui: la si azzera falsificando il
  // momento della prima, non togliendo il meccanismo che la impone.
  (client as unknown as { intervalloMs: number }).intervalloMs = 0;
  return { client, richieste };
}

/**
 * Una Gazzetta finta che tiene conto di quante volte è stata interrogata e che
 * distribuisce cookie come il portale vero.
 *
 * Serve ai due guasti che il client ha davvero avuto in faccia: la pagina
 * iniziale servita al posto dei risultati, e il cookie di tracciamento che
 * arriva da solo su una risposta qualunque.
 */
function gazzettaCapricciosa(opzioni: {
  ricercheDaSbagliare: number;
  cookieDelModulo: string[];
  cookieDellaRicerca: string[];
}): { client: GazzettaClient; cookieInviati: string[] } {
  let sbagliate = 0;
  const cookieInviati: string[] = [];
  const client = new GazzettaClient({
    intervalloMs: 1000,
    fetchImpl: (async (url: string, init?: RequestInit) => {
      const intestazioni = (init?.headers ?? {}) as Record<string, string>;
      cookieInviati.push(intestazioni['cookie'] ?? '');
      const intestazione = (biscotti: string[]): Headers => {
        const h = new Headers();
        for (const c of biscotti) h.append('set-cookie', c);
        return h;
      };
      if (eModulo(String(url))) {
        return new Response(pagina('modulo-ricerca'), {
          status: 200,
          headers: intestazione(opzioni.cookieDelModulo),
        });
      }
      const sbaglia = sbagliate < opzioni.ricercheDaSbagliare;
      if (sbaglia) sbagliate++;
      return new Response(
        pagina(sbaglia ? 'pagina-non-riconosciuta' : 'ricerca-nessun-risultato'),
        {
          status: 200,
          headers: intestazione(opzioni.cookieDellaRicerca),
        },
      );
    }) as unknown as typeof fetch,
  });
  (client as unknown as { intervalloMs: number }).intervalloMs = 0;
  return { client, cookieInviati };
}

const eModulo = (url: string): boolean => url.includes('/ricerca/atto/serie_generale/originario?');
const eRicerca = (url: string): boolean => url.includes('/do/ricerca/');
const eIndice = (url: string): boolean => url.includes('vediMenuHTML');
const eArticolo = (url: string): boolean => url.includes('caricaArticolo');

describe('estremi citabili di un atto', () => {
  it('scrive la data per esteso come la Gazzetta', () => {
    expect(citazioneAtto(estremiDaUrn(LEGGE_145)!)).toBe('30 dicembre 2018, n. 145');
  });

  it('toglie il trattino da «decreto-legge»', () => {
    // Con il trattino il motore della Gazzetta lo prende per un operatore e la
    // ricerca restituisce diciannovemila atti: è successo davvero.
    expect(estremiDaUrn(DL_225)!.tipo).toBe('decreto legge');
    expect(citazioniDelComma(estremiDaUrn(DL_225)!, '2', '5')[0]).toBe(
      'articolo 2, comma 5, del decreto legge 29 dicembre 2010, n. 225',
    );
  });

  it('propone «articolo» e «art.», nient’altro', () => {
    const forme = citazioniDelComma(estremiDaUrn(LEGGE_145)!, '1', '1028');
    expect(forme).toEqual([
      'articolo 1, comma 1028, della legge 30 dicembre 2018, n. 145',
      'art. 1, comma 1028, della legge 30 dicembre 2018, n. 145',
    ]);
  });

  it('rinuncia dove non sa citare, invece di inventare una forma', () => {
    expect(estremiDaUrn('urn:nir:regione.lombardia:legge:2019-01-01;1')).toBeNull();
    expect(estremiDaUrn('urn:nir:stato:legge:2018-12-30;145-bis')).toBeNull();
    expect(estremiDaUrn('non un urn')).toBeNull();
  });
});

describe('strumento previsto e tipo pubblicato', () => {
  it('riconosce chi adotta, quando il testo lo dice', () => {
    expect(famigliaAttesa('decreto del Presidente del Consiglio dei ministri')).toEqual(['dpcm']);
    expect(famigliaAttesa('d.p.c.m.')).toEqual(['dpcm']);
    expect(famigliaAttesa('decreto del Presidente della Repubblica')).toEqual(['dpr']);
    expect(famigliaAttesa('decreto del Ministro della giustizia')).toContain('ministeriale');
  });

  it('si arrende quando il testo dice solo «decreto»', () => {
    expect(famigliaAttesa('decreto')).toBeNull();
    expect(famigliaAttesa('provvedimento')).toBeNull();
  });

  it('legge la famiglia dal tipo che la Gazzetta stampa', () => {
    expect(famigliaDalTipo('DECRETO 3 marzo 2011')).toBe('ministeriale');
    expect(famigliaDalTipo('DECRETO DEL PRESIDENTE DELLA REPUBBLICA 24 maggio 2018, n. 85')).toBe(
      'dpr',
    );
    expect(famigliaDalTipo('LEGGE 4 dicembre 2017, n. 172')).toBeNull();
    expect(famigliaDalTipo('ERRATA-CORRIGE')).toBeNull();
  });
});

describe('la citazione nel testo', () => {
  const estremi = estremiDaUrn(DL_225)!;

  it('accetta il comma che precede l’articolo', () => {
    // Forma reale di un preambolo del 2012: l'ordine non è quello della query.
    const clausola =
      "Visto il comma 37, dell'articolo 2, del decreto-legge 29 dicembre 2010, n. 225, convertito";
    expect(citaIlMandato(clausola, estremi, '2', '37')).toBe(true);
  });

  it('non scambia il comma 2 per il comma 2-novies', () => {
    const clausola =
      "Visti i commi 2-novies, 2-decies e 2-undecies dell'articolo 2 del decreto-legge 29 dicembre 2010, n. 225";
    expect(citaIlMandato(clausola, estremi, '2', '2')).toBe(false);
    expect(citaIlMandato(clausola, estremi, '2', '2-novies')).toBe(true);
  });

  it('non scambia l’articolo 2 per l’articolo 21', () => {
    const clausola = "Visto l'articolo 21, comma 5, del decreto-legge 29 dicembre 2010, n. 225";
    expect(citaIlMandato(clausola, estremi, '2', '5')).toBe(false);
    expect(citaIlMandato(clausola, estremi, '21', '5')).toBe(true);
  });

  it('vuole i tre elementi nella stessa clausola, non nella stessa pagina', () => {
    const lontano =
      "Vista la legge 29 dicembre 2010, n. 225; Visto l'articolo 2, comma 5, di altra fonte;";
    expect(clausolaDelPreambolo(lontano, estremi, '2', '5')).toBeNull();
  });

  it('restituisce la clausola intera, non la sola citazione', () => {
    const preambolo = leggiTestoAtto(pagina('articolo-preambolo'));
    const clausola = clausolaDelPreambolo(preambolo, estremiDaUrn(LEGGE_145)!, '1', '1028');
    expect(clausola).toContain('comma 1028, della legge 30 dicembre 2018, n. 145');
    expect(clausola?.endsWith(';')).toBe(true);
  });
});

describe('lettura delle pagine della Gazzetta', () => {
  it('legge l’elenco dei risultati con i loro estremi', () => {
    const esito = leggiPaginaRisultati(pagina('ricerca-provvedimento-trovato'));
    expect(esito.stato).toBe('elenco');
    if (esito.stato !== 'elenco') return;
    expect(esito.totale).toBe(56);
    const dpcm = esito.risultati.find((r) => famigliaDalTipo(r.tipo) === 'dpcm')!;
    expect(dpcm.tipo).toContain('DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI');
    expect(dpcm.dataPubblicazione).toBe('2019-09-09');
    expect(dpcm.codiceRedazionale).toBe('19A05547');
    expect(dpcm.riferimento).toContain('GU n.211');
  });

  it('distingue «non ha trovato niente» da «ha trovato troppo»', () => {
    expect(leggiPaginaRisultati(pagina('ricerca-nessun-risultato')).stato).toBe('nessuno');
    const troppi = leggiPaginaRisultati(pagina('ricerca-troppi-risultati'));
    expect(troppi.stato).toBe('troppi');
    if (troppi.stato === 'troppi') expect(troppi.totale).toBe(18_979);
  });

  it('rifiuta una pagina che non è quella dei risultati', () => {
    // La sessione del portale vale per una ricerca sola: consumata, la
    // richiesta successiva riceve la pagina iniziale con un 200. Leggerla come
    // «nessun risultato» significa affermare il falso su una legge.
    expect(leggiPaginaRisultati(pagina('pagina-non-riconosciuta')).stato).toBe('non-riconosciuta');
  });

  it('trova nell’indice il link al testo dell’articolo', () => {
    const link = leggiIndiceArticoli(pagina('indice-atto'));
    expect(link.length).toBeGreaterThan(0);
    expect(link[0]).toContain('caricaArticolo');
    // L'indice è HTML: le entità vanno sciolte o il link non si può richiedere.
    expect(link[0]).not.toContain('&amp;');
  });
});

describe('verifica di un mandato', () => {
  it('trova il provvedimento e ne registra la citazione letterale', async () => {
    const { client, richieste } = gazzettaFinta([
      [(u) => eModulo(u), 200, pagina('modulo-ricerca')],
      [(u) => eRicerca(u), 200, pagina('ricerca-provvedimento-trovato')],
      [(u) => eIndice(u), 200, pagina('indice-atto')],
      [(u) => eArticolo(u), 200, pagina('articolo-preambolo')],
    ]);
    const esito = await verificaMandato(mandato(), { client, oggi: '2026-09-13' });

    expect(esito.esito).toBe('adottato');
    expect(esito.provvedimento?.tipo).toContain(
      'DECRETO DEL PRESIDENTE DEL CONSIGLIO DEI MINISTRI',
    );
    expect(esito.provvedimento?.gazzetta).toContain('GU n.211');
    expect(esito.provvedimento?.url).toContain('19A05547');
    expect(esito.citazione).toContain('comma 1028, della legge 30 dicembre 2018, n. 145');
    // La prova non è solo l'esito: query, URL e momento della verifica devono
    // esserci sempre, o la verifica non si può contestare.
    expect(esito.query).toContain('comma 1028');
    expect(esito.url).toContain('gazzettaufficiale.it');
    expect(esito.verificatoIl).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Il modulo si ricarica prima di ogni ricerca: è quello che rende la
    // risposta leggibile invece che la pagina iniziale.
    expect(richieste.filter((r) => eModulo(r.split(' ')[1]!)).length).toBeGreaterThan(0);
  });

  it('dichiara non adottato solo quando l’atto non è citato da nessuno', async () => {
    const { client } = gazzettaFinta([
      [(u) => eModulo(u), 200, pagina('modulo-ricerca')],
      [(u) => eRicerca(u), 200, pagina('ricerca-nessun-risultato')],
    ]);
    const esito = await verificaMandato(
      mandato({ actUrn: 'urn:nir:stato:legge:2019-05-10;44', provisionNumber: '3' }),
      { client, oggi: '2026-09-13' },
    );

    expect(esito.esito).toBe('non-adottato');
    expect(esito.query).toBe('10 maggio 2019, n. 44');
    expect(esito.motivo).toContain('nessun atto della Serie Generale cita');
    expect(esito.provvedimento).toBeNull();
  });

  it('non conclude quando alla citazione rispondono troppi provvedimenti', async () => {
    const { client } = gazzettaFinta([
      [(u) => eModulo(u), 200, pagina('modulo-ricerca')],
      [(u) => eRicerca(u), 200, pagina('ricerca-atto-molto-citato')],
    ]);
    const esito = await verificaMandato(
      mandato({ actUrn: DL_225, articleNumber: '2', provisionNumber: '5' }),
      { client, oggi: '2026-09-13' },
    );

    expect(esito.esito).toBe('non-verificabile');
    expect(esito.motivo).toContain('non è univoca');
    expect(esito.risultati).toBe(275);
  });

  it('non conclude quando la ricerca restituisce mezza Gazzetta', async () => {
    const { client } = gazzettaFinta([
      [(u) => eModulo(u), 200, pagina('modulo-ricerca')],
      [(u) => eRicerca(u), 200, pagina('ricerca-troppi-risultati')],
    ]);
    const esito = await verificaMandato(mandato(), { client, oggi: '2026-09-13' });

    expect(esito.esito).toBe('non-verificabile');
    expect(esito.motivo).toContain('troppi');
  });

  it('non conclude quando il portale risponde male', async () => {
    const { client } = gazzettaFinta([
      [(u) => eModulo(u), 200, pagina('modulo-ricerca')],
      [(u) => eRicerca(u), 500, '<html><body>Errore</body></html>'],
    ]);
    const esito = await verificaMandato(mandato(), { client, oggi: '2026-09-13' });

    expect(esito.esito).toBe('non-verificabile');
    expect(esito.motivo).toContain('500');
  });

  it('non conclude quando il portale risponde con una pagina che non è quella', async () => {
    const { client } = gazzettaFinta([
      [(u) => eModulo(u), 200, pagina('modulo-ricerca')],
      [(u) => eRicerca(u), 200, pagina('pagina-non-riconosciuta')],
    ]);
    const esito = await verificaMandato(mandato(), { client, oggi: '2026-09-13' });

    expect(esito.esito).toBe('non-verificabile');
    expect(esito.motivo).toContain('non ha la forma attesa');
  });

  it('non interroga la Gazzetta per un mandato che non si può verificare', async () => {
    const { client, richieste } = gazzettaFinta([
      [() => true, 200, pagina('ricerca-nessun-risultato')],
    ]);

    const senzaStrumento = await verificaMandato(mandato({ instrument: 'decreto' }), { client });
    expect(senzaStrumento.esito).toBe('non-verificabile');
    expect(senzaStrumento.motivo).toContain('senza nominare chi adotta');

    const senzaArticolo = await verificaMandato(mandato({ articleNumber: null }), { client });
    expect(senzaArticolo.esito).toBe('non-verificabile');
    expect(senzaArticolo.motivo).toContain('non è agganciato a un articolo');

    const attoNonCitabile = await verificaMandato(
      mandato({ actUrn: 'urn:nir:regione.sicilia:legge:2015-03-02;4' }),
      { client },
    );
    expect(attoNonCitabile.esito).toBe('non-verificabile');
    expect(attoNonCitabile.motivo).toContain('estremi citabili');

    expect(richieste).toEqual([]);
  });

  it('riprova quando il portale serve la pagina iniziale al posto dei risultati', async () => {
    // Succede davvero, e con uno stato 200: su dodici ricerche capitava tre
    // volte. Senza il nuovo tentativo un quarto delle verifiche finirebbe
    // `non-verificabile` per una ragione che non riguarda la legge verificata.
    const { client } = gazzettaCapricciosa({
      ricercheDaSbagliare: 2,
      cookieDelModulo: ['JSESSIONID=abc; Path=/'],
      cookieDellaRicerca: [],
    });
    const esito = await verificaMandato(mandato({ actUrn: 'urn:nir:stato:legge:2019-05-10;44' }), {
      client,
      oggi: '2026-09-13',
    });
    expect(esito.esito).toBe('non-adottato');
  });

  it('si arrende dopo tre tentativi invece di martellare il portale', async () => {
    const { client, cookieInviati } = gazzettaCapricciosa({
      ricercheDaSbagliare: 99,
      cookieDelModulo: ['JSESSIONID=abc; Path=/'],
      cookieDellaRicerca: [],
    });
    const esito = await verificaMandato(mandato(), { client, oggi: '2026-09-13' });
    expect(esito.esito).toBe('non-verificabile');
    // Due richieste per tentativo (modulo e ricerca), tre tentativi per query:
    // il conto deve restare piccolo e prevedibile.
    expect(cookieInviati.length).toBeLessThanOrEqual(6);
  });

  it('non perde il cookie di sessione quando ne arriva un altro', async () => {
    // Il guasto peggiore che questo client ha avuto: il portale imposta un
    // cookie di tracciamento su una risposta qualunque, e prendere quello per
    // l'intero barattolo buttava via `JSESSIONID`. Da lì ogni ricerca riceveva
    // la pagina iniziale, con uno stato 200: il modo silenzioso di sbagliare.
    const { client, cookieInviati } = gazzettaCapricciosa({
      ricercheDaSbagliare: 0,
      cookieDelModulo: ['JSESSIONID=abc; Path=/; HttpOnly'],
      cookieDellaRicerca: ['TS01aaaa=zzz; Path=/'],
    });
    await verificaMandato(mandato({ actUrn: 'urn:nir:stato:legge:2019-05-10;44' }), {
      client,
      oggi: '2026-09-13',
    });
    const ultimo = cookieInviati.at(-1)!;
    expect(ultimo).toContain('JSESSIONID=abc');
    expect(ultimo).toContain('TS01aaaa=zzz');
  });

  it('dà la stessa chiave allo stesso mandato, sempre', async () => {
    const { client } = gazzettaFinta([[() => true, 500, '']]);
    const uno = await verificaMandato(mandato(), { client });
    const due = await verificaMandato(mandato(), { client });
    expect(uno.chiave).toBe(due.chiave);
    expect(uno.chiave).not.toBe(
      (await verificaMandato(mandato({ provisionNumber: '1029' }), { client })).chiave,
    );
  });
});
