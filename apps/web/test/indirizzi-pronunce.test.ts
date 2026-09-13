import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ecliNelPercorso,
  percorsoPronuncia,
  pronunciaDaEcli,
  pronunciaDaSlug,
  slugPronuncia,
  type PronunciaIndirizzabile,
} from '../lib/testo';

/**
 * L'indirizzo di una pronuncia, provato sul dataset vero.
 *
 * Non su un paio di casi inventati: il vincolo da difendere è che **ogni**
 * riga del dataset abbia uno slug, che quello slug sia univoco e che si torni
 * indietro fino alla stessa decisione. Se un giorno numero, anno e tipologia
 * smettessero di identificarne una sola, deve accorgersene questo file — non
 * la produzione, che servirebbe una pagina al posto di un'altra in silenzio.
 */

const DIR = process.env['LCNT_SNAPSHOT'] ?? join(process.cwd(), '..', '..', 'data', 'snapshot');
const FILE = join(DIR, 'pronunce.jsonl');

function pronunceDelDataset(): PronunciaIndirizzabile[] {
  if (!existsSync(FILE)) return [];
  return readFileSync(FILE, 'utf8')
    .split('\n')
    .filter((riga) => riga.trim().length > 0)
    .map((riga) => JSON.parse(riga) as PronunciaIndirizzabile);
}

const dataset = pronunceDelDataset();

describe('la forma dell’indirizzo', () => {
  it('dice a voce quello che scrive: «sentenza 251 del 2001»', () => {
    const sentenza: PronunciaIndirizzabile = {
      ecli: 'ECLI:IT:COST:2001:251',
      numero: '251',
      anno: '2001',
      tipologia: 'S',
    };
    expect(percorsoPronuncia(sentenza, [sentenza])).toBe('/corte/sentenza-251-2001');
  });

  it('distingue l’ordinanza dalla sentenza, che sono due cose diverse', () => {
    const ordinanza: PronunciaIndirizzabile = {
      ecli: 'ECLI:IT:COST:2019:45',
      numero: '45',
      anno: '2019',
      tipologia: 'O',
    };
    expect(percorsoPronuncia(ordinanza, [ordinanza])).toBe('/corte/ordinanza-45-2019');
  });

  it('riduce l’ECLI a un segmento che non ha bisogno di essere codificato', () => {
    expect(ecliNelPercorso('ECLI:IT:COST:2026:121')).toBe('ecli-it-cost-2026-121');
  });
});

describe('gli indirizzi del dataset', () => {
  it('il dataset c’è: senza, questi test non provano niente', () => {
    expect(dataset.length).toBeGreaterThan(0);
  });

  it('ogni pronuncia ha uno slug senza caratteri da codificare', () => {
    for (const pronuncia of dataset) {
      const slug = slugPronuncia(pronuncia, dataset);
      expect(slug, `slug vuoto per ${pronuncia.ecli}`).not.toBe('');
      // La proprietà da cui dipende tutto: codificarlo non lo cambia.
      expect(encodeURIComponent(slug), `slug da codificare: ${slug}`).toBe(slug);
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('andata e ritorno su tutte le pronunce del dataset', () => {
    for (const pronuncia of dataset) {
      const slug = slugPronuncia(pronuncia, dataset);
      expect(pronunciaDaSlug(slug, dataset)?.ecli, `ritorno fallito per ${slug}`).toBe(
        pronuncia.ecli,
      );
    }
  });

  it('numero, anno e tipologia identificano una pronuncia sola', () => {
    /* Se questo test cade, il dataset ha due decisioni che si chiamano allo
       stesso modo: gli slug restano univoci — ci pensa `slugPronuncia` — ma
       due indirizzi diventano illeggibili, e va deciso a mano cosa farne. */
    const forme = dataset.map((p) => `${p.tipologia}-${p.numero}-${p.anno}`);
    expect(new Set(forme).size).toBe(dataset.length);
  });

  it('nessuna pronuncia divide l’indirizzo con un’altra', () => {
    const slug = dataset.map((p) => slugPronuncia(p, dataset));
    expect(new Set(slug).size).toBe(dataset.length);
  });

  it('uno slug che non esiste non restituisce una pronuncia a caso', () => {
    expect(pronunciaDaSlug('sentenza-999999-1815', dataset)).toBeNull();
    expect(pronunciaDaSlug('', dataset)).toBeNull();
  });
});

describe('i vecchi indirizzi con l’ECLI', () => {
  it('si risolvono comunque siano scritti', () => {
    const pronuncia = dataset[0]!;
    for (const forma of [
      pronuncia.ecli,
      encodeURIComponent(pronuncia.ecli),
      ecliNelPercorso(pronuncia.ecli),
      pronuncia.ecli.toLowerCase(),
    ]) {
      expect(pronunciaDaEcli(forma, dataset)?.ecli, `forma non risolta: ${forma}`).toBe(
        pronuncia.ecli,
      );
    }
  });

  it('un ECLI che non è nel dataset non porta da nessuna parte', () => {
    expect(pronunciaDaEcli('ECLI:IT:COST:1815:1', dataset)).toBeNull();
    // Un segmento che non si decodifica non deve far saltare la richiesta.
    expect(pronunciaDaEcli('%E0%A4%A', dataset)).toBeNull();
  });
});

describe('due pronunce che si chiamassero allo stesso modo', () => {
  /* Non succede nel dataset di oggi, e il test qui sopra lo verifica. Ma la
     regola di disambiguazione deve esistere ed essere deterministica prima che
     serva, non dopo: quando serve, servirà in produzione. */
  const gemelle: PronunciaIndirizzabile[] = [
    { ecli: 'ECLI:IT:COST:2026:121', numero: '121', anno: '2026', tipologia: 'S' },
    { ecli: 'ECLI:IT:COST:2026:121-BIS', numero: '121', anno: '2026', tipologia: 'S' },
  ];

  it('prendono due indirizzi diversi, e nessuna scompare', () => {
    const slug = gemelle.map((p) => slugPronuncia(p, gemelle));
    expect(new Set(slug).size).toBe(2);
    for (const p of gemelle) {
      expect(pronunciaDaSlug(slugPronuncia(p, gemelle), gemelle)?.ecli).toBe(p.ecli);
    }
  });

  it('l’indirizzo di una non dipende dall’ordine in cui arrivano', () => {
    const diretto = gemelle.map((p) => slugPronuncia(p, gemelle));
    const rovesciato = gemelle.map((p) => slugPronuncia(p, [...gemelle].reverse()));
    expect(rovesciato).toEqual(diretto);
  });

  it('restano senza caratteri da codificare', () => {
    for (const p of gemelle) {
      const slug = slugPronuncia(p, gemelle);
      expect(encodeURIComponent(slug)).toBe(slug);
    }
  });
});
