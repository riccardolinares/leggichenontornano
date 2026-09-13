import { describe, expect, it } from 'vitest';
import {
  normalizeText,
  parseDispositivo,
  parsePronunceJson,
  relazioniDaPronunce,
  toIsoDate,
  citaLaPronuncia,
  type Pronuncia,
} from '../src/consulta/index.js';

/**
 * I casi qui sotto sono **testi reali** presi dall'archivio della Corte
 * costituzionale. Tre di essi sono errori che questo parser ha commesso prima
 * di essere corretto, e stanno qui perché non li ricommetta.
 */

const pronuncia = (ecli: string, dispositivo: string): Pronuncia => ({
  ecli,
  numero: ecli.split(':').at(-1) ?? '',
  anno: ecli.split(':').at(-2) ?? '',
  tipologia: 'S',
  dataDecisione: '2020-01-01',
  dataDeposito: '2020-01-15',
  presidente: null,
  redattore: null,
  dispositivo,
  epigrafe: '',
});

describe('lettura del dispositivo', () => {
  it('estrae atto, articolo e comma dalla formula corrente', () => {
    const [d] = parseDispositivo(
      'ECLI:IT:COST:2018:132',
      "per questi motivi LA CORTE COSTITUZIONALE dichiara l'illegittimità costituzionale dell'art. 44, comma 3, del decreto legislativo 2 luglio 2010, n. 104 (Attuazione dell'articolo 44 della legge 18 giugno 2009, n. 69). Così deciso in Roma…",
    );
    expect(d?.actUrn).toBe('urn:nir:stato:decreto.legislativo:2010-07-02;104');
    expect(d?.articles).toEqual(['44']);
    expect(d?.paragraphs).toEqual(['3']);
    expect(d?.confidence).toBe('alta');
  });

  it('non prende la norma citata dentro il titolo di un altro atto', () => {
    // Caso reale, e il peggiore trovato: l'unica citazione datata sta dentro il
    // titolo virgolettato di una deliberazione regionale. Presa per buona, il
    // grafo diceva che l'art. 3 di una legge costituzionale vigente era caduto.
    const trovate = parseDispositivo(
      'ECLI:IT:COST:2002:304',
      'per questi motivi LA CORTE COSTITUZIONALE Dichiara l\'illegittimità costituzionale della deliberazione legislativa statutaria adottata, in seconda votazione, il 24 luglio 2001 dal Consiglio regionale della Regione Marche e recante "Disciplina transitoria in attuazione dell\'articolo 3 della legge costituzionale 22 novembre 1999, n. 1". Così deciso…',
    );
    expect(trovate).toHaveLength(1);
    expect(trovate[0]?.actUrn).toBeNull();
    expect(trovate[0]?.skipped).toBe('legge regionale o provinciale');
  });

  it('non scambia la legge di conversione con il decreto dichiarato illegittimo', () => {
    // Caso reale: senza il marcatore ordinale «1°» nella data, la prima
    // citazione spariva e la declaratoria finiva sulla legge di conversione.
    const [d] = parseDispositivo(
      'ECLI:IT:COST:2024:80',
      "per questi motivi LA CORTE COSTITUZIONALE dichiara l'illegittimità costituzionale dell'art. 39-bis del decreto-legge 1° ottobre 2007, n. 159 (Interventi urgenti), convertito, con modificazioni, nella legge 29 novembre 2007, n. 222. Così deciso…",
    );
    expect(d?.actUrn).toBe('urn:nir:stato:decreto.legge:2007-10-01;159');
    expect(d?.articles).toEqual(['39-bis']);
  });

  it('non produce nulla per le leggi regionali', () => {
    const [d] = parseDispositivo(
      'ECLI:IT:COST:2006:422',
      "dichiara l'illegittimità costituzionale degli artt. 8, comma 3, e 14, comma 3, della legge della Regione Lazio 23 gennaio 2006, n. 2 (Disciplina transitoria). Così deciso…",
    );
    expect(d?.actUrn).toBeNull();
    expect(d?.skipped).toBe('legge regionale o provinciale');
  });

  it('non produce nulla per le declaratorie di infondatezza o inammissibilità', () => {
    expect(
      parseDispositivo(
        'ECLI:IT:COST:2001:74',
        "LA CORTE COSTITUZIONALE dichiara non fondate le questioni di legittimità costituzionale degli articoli 4, comma 1, del d.lgs. 23 dicembre 1997, n. 469; dichiara inammissibile la questione relativa all'art. 7 della legge 15 marzo 1997, n. 59. Così deciso…",
      ),
    ).toEqual([]);
  });

  it('distingue la declaratoria parziale da quella totale', () => {
    const [parziale] = parseDispositivo(
      'ECLI:IT:COST:2009:250',
      "dichiara l'illegittimità costituzionale dell'art. 287, comma 1, del decreto legislativo 3 aprile 2006, n. 152 (Norme ambientali), limitatamente alle parole «rilasciato dall'ispettorato». Così deciso…",
    );
    expect(parziale?.scope).toBe('parziale');
    // `confidence` sulla dichiarazione misura una cosa sola: quanto è
    // inequivoca l'identificazione dell'atto. Qui il dispositivo ne nomina uno
    // solo, quindi è alta.
    expect(parziale?.confidence).toBe('alta');

    // È l'**arco** a portare le due cose insieme, e a nascere basso: una
    // declaratoria parziale non fa cadere la norma, ne cambia il contenuto, e
    // non deve fondare da sola la conclusione «questa norma non c'è più».
    const { relazioni } = relazioniDaPronunce(
      [pronuncia('ECLI:IT:COST:2009:250', '')],
      [parziale!],
      new Set(['urn:nir:stato:decreto.legislativo:2006-04-03;152']),
    );
    expect(relazioni[0]?.confidence).toBe('bassa');
  });

  it('legge i commi elencati e quelli scritti come ordinali', () => {
    const [elenco] = parseDispositivo(
      'ECLI:IT:COST:2010:215',
      "dichiara l'illegittimità costituzionale dell'art. 4, commi 1, 2 e 4, del decreto-legge 1 luglio 2009, n. 78 (Provvedimenti anticrisi). Così deciso…",
    );
    expect(elenco?.paragraphs).toEqual(['1', '2', '4']);

    const [ordinale] = parseDispositivo(
      'ECLI:IT:COST:2001:158',
      "dichiara l'illegittimità costituzionale dell'art. 20, sedicesimo comma, della legge 26 luglio 1975, n. 354 (Ordinamento penitenziario). Così deciso…",
    );
    expect(ordinale?.paragraphs).toEqual(['16']);
  });

  it('legge le lettere colpite', () => {
    const [d] = parseDispositivo(
      'ECLI:IT:COST:2001:74',
      "dichiara l'illegittimità costituzionale dell'articolo 4, comma 1, lettere b), c) e d), del d.lgs. 23 dicembre 1997, n. 469 (Conferimento alle regioni). Così deciso…",
    );
    expect(d?.letters).toEqual(['b', 'c', 'd']);
  });

  it('separa più declaratorie nello stesso dispositivo', () => {
    const trovate = parseDispositivo(
      'ECLI:IT:COST:2020:1',
      "1) dichiara l'illegittimità costituzionale dell'art. 3 della legge 12 marzo 1999, n. 68 (Disabili); 2) dichiara l'illegittimità costituzionale dell'art. 9 del decreto legislativo 3 aprile 2006, n. 152 (Ambiente); 3) dichiara non fondata la restante questione. Così deciso…",
    );
    expect(trovate).toHaveLength(2);
    expect(trovate.map((d) => d.actUrn)).toEqual([
      'urn:nir:stato:legge:1999-03-12;68',
      'urn:nir:stato:decreto.legislativo:2006-04-03;152',
    ]);
  });
});

describe('archi DICHIARA_ILLEGITTIMO', () => {
  const p = pronuncia(
    'ECLI:IT:COST:2018:132',
    "dichiara l'illegittimità costituzionale dell'art. 44, comma 3, del decreto legislativo 2 luglio 2010, n. 104 (Attuazione). Così deciso…",
  );
  const dichiarazioni = parseDispositivo(p.ecli, p.dispositivo);

  it('parte dall’ECLI e arriva all’articolo, con la data di deposito', () => {
    const { relazioni } = relazioniDaPronunce(
      [p],
      dichiarazioni,
      new Set(['urn:nir:stato:decreto.legislativo:2010-07-02;104']),
    );
    expect(relazioni).toHaveLength(1);
    expect(relazioni[0]?.sourceUrn).toBe('ECLI:IT:COST:2018:132');
    expect(relazioni[0]?.targetArticle).toBe('44');
    // La pronuncia produce effetti dal deposito, non dalla camera di consiglio.
    expect(relazioni[0]?.effectiveFrom).toBe('2020-01-15');
    expect(relazioni[0]?.origin).toBe('consulta');
  });

  it('non crea archi verso atti che non abbiamo', () => {
    const { relazioni, scartate } = relazioniDaPronunce([p], dichiarazioni, new Set());
    expect(relazioni).toEqual([]);
    expect(scartate[0]?.motivo).toBe('atto non presente nel corpus ingerito');
  });
});

describe('formati della fonte', () => {
  it('converte le date gg/mm/aaaa', () => {
    expect(toIsoDate('03/07/2002')).toBe('2002-07-03');
    expect(toIsoDate('3/7/2002')).toBe('2002-07-03');
    expect(toIsoDate('')).toBeNull();
  });

  it('toglie il ritorno a capo letterale che la fonte lascia nel JSON', () => {
    // `&#13;` compare come testo, non come entità: è un residuo della
    // conversione da XML e sta a fine riga in quasi ogni campo.
    expect(normalizeText('primo&#13;secondo')).toBe('primo secondo');
  });

  it('legge l’involucro elenco_pronunce', () => {
    const righe = parsePronunceJson(
      JSON.stringify({
        elenco_pronunce: [
          { ecli: 'ECLI:IT:COST:2020:1', dispositivo: 'x', data_deposito: '15/01/2020' },
          { dispositivo: 'senza ecli' },
        ],
      }),
    );
    expect(righe).toHaveLength(1);
    expect(righe[0]?.dataDeposito).toBe('2020-01-15');
  });
});

describe('accordo con le note di Normattiva', () => {
  // Il testo è quello reale, dall'art. 2 del d.l. 225/2010.
  const nota =
    "------------- AGGIORNAMENTO (10) La Corte Costituzionale, con sentenza 13 - 16 febbraio 2012, n. 22 (in G.U. 1a s.s. 22/2/2012, n. 8) ha dichiarato \"l'illegittimita' costituzionale dell'articolo 2, comma 2-quater, del decreto-legge 29 dicembre 2010, n. 225\".";

  it('riconosce la pronuncia annotata da Normattiva', () => {
    expect(citaLaPronuncia(nota, '2012', '22')).toBe(true);
  });

  it('non si accontenta del numero: «n. 22» compare ovunque in una legge', () => {
    expect(
      citaLaPronuncia(
        'Per i provvedimenti di cui alla legge 22 maggio 2010, n. 22, si applica il termine di trenta giorni.',
        '2012',
        '22',
      ),
    ).toBe(false);
  });

  it('non conferma una pronuncia diversa dello stesso anno', () => {
    expect(citaLaPronuncia(nota, '2012', '78')).toBe(false);
  });

  it('non conferma una nota che non parla di illegittimità', () => {
    expect(
      citaLaPronuncia('La Corte, con sentenza 16 febbraio 2012, n. 22, ha respinto.', '2012', '22'),
    ).toBe(false);
  });
});
