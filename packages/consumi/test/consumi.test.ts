import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clienteModello } from '../src/cliente.js';
import {
  componiRiga,
  etichettaUso,
  fileDelMese,
  leggiRegistro,
  registra,
  riepiloga,
  tokenTotali,
} from '../src/registro.js';
import { costoChiamata, LISTINO, normalizzaModello, prezzoDi } from '../src/prezzi.js';
import { tokenDaSessione } from '../src/sessione.js';

let cartella: string;

beforeEach(() => {
  cartella = mkdtempSync(join(tmpdir(), 'lcnt-consumi-'));
});

afterEach(() => {
  rmSync(cartella, { recursive: true, force: true });
});

describe('il listino', () => {
  it('dà il prezzo in vigore a quella data, non l’ultimo scritto', () => {
    const quando = '2026-09-13T10:00:00.000Z';
    expect(prezzoDi('claude-opus-5', quando)?.ingresso).toBe(5);
    // Prima della data da cui vale, quel prezzo non esiste: è il punto per cui
    // il listino porta una data invece di essere una tabella e basta.
    expect(prezzoDi('claude-opus-5', '2025-01-01')).toBeNull();
  });

  it('riconosce lo stesso modello sotto un suffisso di data o di versione', () => {
    expect(normalizzaModello('claude-opus-5-20260401')).toBe('claude-opus-5');
    expect(normalizzaModello('claude-opus-5/2026-09-12.1')).toBe('claude-opus-5');
    expect(prezzoDi('claude-opus-5-20260401', '2026-09-13')?.uscita).toBe(25);
  });

  it('calcola il costo per milione di token, cache compresa', () => {
    const { costo, listino } = costoChiamata('claude-opus-5', '2026-09-13', {
      ingresso: 1_000_000,
      uscita: 1_000_000,
      cacheScrittura: 0,
      cacheLettura: 1_000_000,
    });
    expect(costo).toBeCloseTo(5 + 25 + 0.5, 6);
    expect(listino).toBe('2026-01-01');
  });

  it('non inventa un costo per un modello che non è a listino', () => {
    const { costo, listino } = costoChiamata('un-modello-mai-visto', '2026-09-13', {
      ingresso: 1000,
      uscita: 1000,
      cacheScrittura: 0,
      cacheLettura: 0,
    });
    expect(costo).toBeNull();
    expect(listino).toBeNull();
  });

  it('non ha due righe uguali per lo stesso modello e la stessa data', () => {
    const chiavi = LISTINO.map((p) => `${p.modello}@${p.daQuando}`);
    expect(new Set(chiavi).size).toBe(chiavi.length);
  });
});

describe('il registro', () => {
  it('appende una riga per chiamata, nel file del mese giusto', () => {
    registra(
      {
        modello: 'claude-opus-5',
        uso: 'blog',
        tokenIngresso: 4000,
        tokenUscita: 900,
        quando: '2026-09-13T05:31:12.482Z',
      },
      cartella,
    );
    registra(
      {
        modello: 'claude-opus-5',
        uso: 'blog',
        tokenIngresso: 3000,
        tokenUscita: 700,
        quando: '2026-10-01T05:31:12.482Z',
      },
      cartella,
    );

    expect(fileDelMese('2026-09-13T05:31:12.482Z', cartella)).toBe(join(cartella, '2026-09.jsonl'));
    expect(readFileSync(join(cartella, '2026-09.jsonl'), 'utf8').trim().split('\n')).toHaveLength(
      1,
    );
    expect(leggiRegistro(cartella)).toHaveLength(2);
  });

  it('salta una riga troncata invece di portarsi via il registro intero', () => {
    registra(
      {
        modello: 'claude-opus-5',
        uso: 'blog',
        tokenIngresso: 10,
        tokenUscita: 10,
        quando: '2026-09-13T05:00:00.000Z',
      },
      cartella,
    );
    writeFileSync(join(cartella, '2026-08.jsonl'), '{"quando":"2026-08-01T00:00:00.00\n', 'utf8');
    expect(leggiRegistro(cartella)).toHaveLength(1);
  });

  it('registra il costo con il listino, e dice quale listino ha applicato', () => {
    const riga = componiRiga({
      modello: 'claude-opus-5',
      uso: 'blog',
      tokenIngresso: 2_000_000,
      tokenUscita: 0,
      quando: '2026-09-13T05:00:00.000Z',
    });
    expect(riga.costo).toBeCloseTo(10, 6);
    expect(riga.listino).toBe('2026-01-01');
    expect(riga.valuta).toBe('USD');
    expect(riga.chi).toBe('progetto');
    expect(riga.origine).toBe('automatico');
  });
});

describe('il riepilogo', () => {
  const righe = [
    componiRiga({
      modello: 'claude-opus-5',
      uso: 'blog',
      tokenIngresso: 1_000_000,
      tokenUscita: 0,
      quando: '2026-07-05T05:00:00.000Z',
    }),
    componiRiga({
      modello: 'claude-opus-5',
      uso: 'analisi-assistita',
      tokenIngresso: 1_000_000,
      tokenUscita: 0,
      quando: '2026-08-05T05:00:00.000Z',
    }),
    componiRiga({
      modello: 'claude-sonnet-5',
      uso: 'contributo',
      tokenIngresso: 1_000_000,
      tokenUscita: 0,
      quando: '2026-09-05T05:00:00.000Z',
      chi: 'unatale',
      origine: 'dichiarato',
    }),
  ];

  it('separa quello che ha speso il progetto da quello che hanno dichiarato le persone', () => {
    const r = riepiloga(righe, '2026-09');
    expect(r.progetto.chiamate).toBe(2);
    expect(r.dichiarato.chiamate).toBe(1);
    expect(r.perContributore).toHaveLength(1);
    expect(r.perContributore[0]?.chiave).toBe('unatale');
    expect(tokenTotali(r.totali)).toBe(3_000_000);
  });

  it('media sui mesi conclusi, e non sul mese in corso', () => {
    // Luglio e agosto sono conclusi (5 dollari l'uno); settembre è in corso e
    // resta fuori, altrimenti la media dipenderebbe da che giorno è oggi.
    const r = riepiloga(righe, '2026-09');
    expect(r.mesiCompleti).toBe(2);
    expect(r.costoMensile).toBeCloseTo(5, 6);
  });

  it('non calcola una media quando non c’è ancora un mese concluso', () => {
    const r = riepiloga(righe.slice(0, 1), '2026-07');
    expect(r.costoMensile).toBeNull();
    expect(r.mesiCompleti).toBe(0);
  });

  it('su un registro vuoto non restituisce zeri travestiti da misura', () => {
    const r = riepiloga([], '2026-09');
    expect(r.righe).toBe(0);
    expect(r.dal).toBeNull();
    expect(r.costoMensile).toBeNull();
  });

  it('dice a cosa serviva la chiamata in lingua comune', () => {
    expect(etichettaUso('analisi-assistita')).toMatch(/livello 4/i);
    // Una riga vecchia con un uso che oggi non esiste più resta leggibile.
    expect(etichettaUso('un-uso-ritirato')).toBe('un-uso-ritirato');
  });
});

describe('il client avvolto', () => {
  it('registra la chiamata da sé, senza che il chiamante faccia niente', async () => {
    const finto = {
      messages: {
        create: async () => ({
          content: [{ type: 'text' }],
          model: 'claude-opus-5',
          usage: {
            input_tokens: 1200,
            output_tokens: 340,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 900,
          },
        }),
      },
    };

    const cliente = clienteModello({
      uso: 'blog',
      sottostante: finto,
      cartella,
      registra: true,
    });
    await cliente.messages.create({ model: 'claude-opus-5', max_tokens: 16 });

    const righe = leggiRegistro(cartella);
    expect(righe).toHaveLength(1);
    expect(righe[0]?.uso).toBe('blog');
    expect(righe[0]?.tokenIngresso).toBe(1200);
    expect(righe[0]?.tokenCacheLettura).toBe(900);
    expect(righe[0]?.costo).toBeGreaterThan(0);
  });

  it('scrive il modello che ha risposto, non quello che è stato chiesto', async () => {
    const finto = {
      messages: {
        create: async () => ({
          content: [],
          model: 'claude-opus-4-8',
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      },
    };
    const cliente = clienteModello({
      uso: 'analisi-assistita',
      sottostante: finto,
      cartella,
      registra: true,
    });
    await cliente.messages.create({ model: 'claude-opus-5' });
    expect(leggiRegistro(cartella)[0]?.modello).toBe('claude-opus-4-8');
  });

  it('non sporca il registro quando il client è un doppio di prova', async () => {
    const finto = {
      messages: {
        create: async () => ({ content: [], usage: { input_tokens: 1, output_tokens: 1 } }),
      },
    };
    const cliente = clienteModello({ uso: 'blog', sottostante: finto, cartella });
    await cliente.messages.create({ model: 'claude-opus-5' });
    expect(leggiRegistro(cartella)).toHaveLength(0);
  });

  it('non fa fallire la chiamata se il registro non si può scrivere', async () => {
    const finto = {
      messages: {
        create: async () => ({
          content: [{ type: 'text' }],
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      },
    };
    // Una cartella che è in realtà un file: la scrittura non può riuscire.
    const ostacolo = join(cartella, 'non-una-cartella');
    writeFileSync(ostacolo, 'niente', 'utf8');
    const cliente = clienteModello({
      uso: 'blog',
      sottostante: finto,
      cartella: ostacolo,
      registra: true,
    });
    await expect(cliente.messages.create({ model: 'claude-opus-5' })).resolves.toBeTruthy();
  });
});

describe('la dichiarazione di un contributore', () => {
  it('somma i token di un file di sessione per modello', () => {
    const sessione = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'ciao' } }),
      JSON.stringify({
        type: 'assistant',
        message: {
          model: 'claude-opus-5',
          usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000 },
        },
      }),
      JSON.stringify({
        type: 'assistant',
        message: { model: 'claude-opus-5', usage: { input_tokens: 300, output_tokens: 80 } },
      }),
      'riga non valida che non deve fermare la lettura',
      JSON.stringify({
        type: 'assistant',
        message: { model: 'claude-haiku-4-5', usage: { input_tokens: 50, output_tokens: 10 } },
      }),
    ].join('\n');

    const per = tokenDaSessione(sessione);
    expect(per.size).toBe(2);
    expect(per.get('claude-opus-5')).toEqual({
      ingresso: 1300,
      uscita: 280,
      cacheScrittura: 0,
      cacheLettura: 5000,
    });
    expect(per.get('claude-haiku-4-5')?.uscita).toBe(10);
  });

  it('non trova niente dove non c’è niente, invece di inventare uno zero', () => {
    expect(tokenDaSessione('{"type":"user","message":{"content":"ciao"}}').size).toBe(0);
  });
});
