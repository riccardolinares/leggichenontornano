import {
  SnapshotReader,
  type SnapshotAnomaly,
  type SnapshotData,
} from '@leggichenontornano/corpus';
import { describe, expect, it, vi } from 'vitest';
import { componiContatore, componiMessaggio } from '../src/messaggio.js';
import { Facebook, LinkedIn } from '../src/piattaforme.js';
import { selezionaDelGiorno } from '../src/selezione.js';

function anomalia(partial: Partial<SnapshotAnomaly> & { id: string }): SnapshotAnomaly {
  return {
    checkId: 'rinvio-ad-atto-abrogato',
    level: 1,
    title: 'Un titolo leggibile ad alta voce che dice cosa non torna',
    plainLanguage:
      'Chi applica la norma trova un richiamo a un testo che non è più in vigore e deve ricostruire da sé quale disciplina si applichi.',
    urns: ['urn:nir:stato:legge:1990-08-07;241'],
    windowFrom: '2016-04-19',
    windowTo: null,
    rule: 'SELECT ...',
    evidence: [],
    resolutions: [],
    severity: 'media',
    published: true,
    computedAt: '2026-09-13T00:00:00.000Z',
    ...partial,
  };
}

function reader(anomalie: SnapshotAnomaly[]): SnapshotReader {
  const data: SnapshotData = {
    acts: [],
    versions: [],
    articles: [],
    relations: [],
    anomalies: anomalie,
    metrics: [],
    manifest: null,
  };
  return new SnapshotReader(data);
}

describe('selezione del giorno', () => {
  const tre = [
    anomalia({ id: 'a', severity: 'media' }),
    anomalia({ id: 'b', severity: 'alta' }),
    anomalia({ id: 'c', severity: 'bassa' }),
  ];

  it('preferisce la gravità alta', () => {
    expect(selezionaDelGiorno(reader(tre), { giorno: '2026-09-13' })?.anomalia.id).toBe('b');
  });

  it('è deterministica a parità di giorno', () => {
    const a = selezionaDelGiorno(reader(tre), { giorno: '2026-09-13' })?.anomalia.id;
    const b = selezionaDelGiorno(reader(tre), { giorno: '2026-09-13' })?.anomalia.id;
    expect(a).toBe(b);
  });

  it('non ripropone una segnalazione già uscita', () => {
    const scelta = selezionaDelGiorno(reader(tre), {
      giorno: '2026-09-13',
      giaPubblicate: new Set(['b']),
    });
    expect(scelta?.anomalia.id).not.toBe('b');
  });

  it('non pubblica le segnalazioni sotto soglia', () => {
    const solaInCoda = [anomalia({ id: 'x', published: false })];
    expect(selezionaDelGiorno(reader(solaInCoda), { giorno: '2026-09-13' })).toBeNull();
  });

  it('restituisce null quando non c’è più niente da dire', () => {
    expect(
      selezionaDelGiorno(reader(tre), {
        giorno: '2026-09-13',
        giaPubblicate: new Set(['a', 'b', 'c']),
      }),
    ).toBeNull();
  });
});

describe('messaggio', () => {
  const a = anomalia({ id: 'x' });

  it('rispetta il limite di X', () => {
    const m = componiMessaggio(a, 'x', 'https://esempio.it');
    expect(m.testo.length).toBeLessThanOrEqual(280);
  });

  it('rispetta il limite di LinkedIn', () => {
    const m = componiMessaggio(a, 'linkedin', 'https://esempio.it');
    expect(m.testo.length).toBeLessThanOrEqual(3000);
  });

  it('l’URL non viene mai accorciato: è la parte verificabile', () => {
    const lunga = anomalia({ id: 'y', title: 'x'.repeat(900) });
    for (const p of ['x', 'linkedin', 'telegram', 'facebook'] as const) {
      const m = componiMessaggio(lunga, p, 'https://esempio.it');
      expect(m.testo).toContain('https://esempio.it/anomalia/y');
    }
  });

  it('non inventa testo: tutto viene dai campi della segnalazione', () => {
    const m = componiMessaggio(a, 'telegram', 'https://esempio.it');
    const senzaUrl = m.testo.replace(m.url, '').trim();
    expect(a.title.startsWith(senzaUrl.split('\n')[0]!)).toBe(true);
  });

  it('il contatore dichiara sempre di essere una sottostima', () => {
    const testo = componiContatore(
      { totalDaysLate: 12345, mandates: 20, acts: 8, caveat: '' },
      'https://esempio.it',
    );
    expect(testo).toContain('sottostima');
    expect(testo).toContain('12.345');
    // Il bot pubblica su piattaforme dove una frase circola senza il suo
    // contesto. Deve dire quello che il contatore misura — termini scaduti —
    // e non quello che farebbe più effetto: che i provvedimenti non siano mai
    // arrivati non lo sappiamo, finché la verifica in Gazzetta non c'è.
    expect(testo).not.toMatch(/non ancora adottati/i);
    expect(testo).toMatch(/termini scaduti e non attuazioni mancate/i);
  });
});

describe('pubblicatori', () => {
  it('nessuna piattaforma è configurata senza credenziali', () => {
    expect(new Facebook('', '').configurato()).toBe(false);
    expect(new LinkedIn('', '').configurato()).toBe(false);
  });

  it('Facebook manda il link separato dal testo, così l’anteprima è quella della pagina', async () => {
    const fetchFinto = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '123_456' }),
    });
    const f = new Facebook('123', 'token', fetchFinto as unknown as typeof fetch);
    const esito = await f.pubblica(
      componiMessaggio(anomalia({ id: 'z' }), 'facebook', 'https://esempio.it'),
    );
    expect(esito.pubblicato).toBe(true);
    const [, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(String(init.body)) as { link: string; message: string };
    expect(corpo.link).toBe('https://esempio.it/anomalia/z');
    expect(corpo.message).toContain('https://esempio.it/anomalia/z');
  });

  it('LinkedIn pubblica come organizzazione, non come persona', async () => {
    const fetchFinto = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'urn:li:share:1' },
      json: async () => ({}),
    });
    const l = new LinkedIn(
      'urn:li:organization:42',
      'token',
      fetchFinto as unknown as typeof fetch,
    );
    const esito = await l.pubblica(
      componiMessaggio(anomalia({ id: 'z' }), 'linkedin', 'https://esempio.it'),
    );
    expect(esito.pubblicato).toBe(true);
    const [, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(String(init.body)) as { author: string; visibility: string };
    expect(corpo.author).toBe('urn:li:organization:42');
    expect(corpo.visibility).toBe('PUBLIC');
  });

  it('un errore della piattaforma non viene nascosto', async () => {
    const fetchFinto = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const f = new Facebook('123', 'token', fetchFinto as unknown as typeof fetch);
    const esito = await f.pubblica(
      componiMessaggio(anomalia({ id: 'z' }), 'facebook', 'https://esempio.it'),
    );
    expect(esito.pubblicato).toBe(false);
    expect(esito.motivo).toContain('503');
  });
});
