import { describe, expect, it } from 'vitest';
import type { Articolo } from '../src/articolo.js';
import { slugDa } from '../src/articolo.js';
import type { Fatti } from '../src/fatti.js';
import { verifica } from '../src/verifica.js';
import { Scrittore } from '../src/scrittore.js';

const fatti: Fatti = {
  anomaliaId: 'rinvio-ad-atto-abrogato.abc',
  controllo: 'Rinvio a una norma abrogata',
  controlloDescrizione: 'Una norma ancora in vigore rinvia a un atto abrogato.',
  livello: 1,
  gravita: 'media',
  titolo: 'Decreto del presidente della repubblica 5 ottobre 2010, n. 207 rinvia ancora al 163',
  linguaComune: 'Chi applica il regolamento trova un richiamo a un testo che non c’è più.',
  atti: [
    {
      urn: 'urn:nir:stato:decreto.del.presidente.della.repubblica:2010-10-05;207',
      nome: 'Decreto del presidente della repubblica 5 ottobre 2010, n. 207',
      titolo: 'Regolamento di esecuzione',
      stato: 'in vigore',
    },
  ],
  finestraDa: '2016-04-19',
  finestraA: null,
  anniAperta: 10,
  prove: [{ etichetta: 'Testo che contiene il rinvio', citazione: 'ai sensi del codice' }],
  criteri: [
    { criterio: 'posteriorita', stato: 'si-applica', spiegazione: 'Il criterio cronologico.' },
  ],
  regola: 'SELECT ...',
  conosciutoAl: '2026-09-13',
};

function articolo(patch: Partial<Articolo> = {}): Articolo {
  return {
    slug: '2026-09-13-prova',
    data: '2026-09-13',
    anomaliaId: fatti.anomaliaId,
    titolo: 'Un regolamento del 2010 rimanda a una legge che non esiste più',
    sommario:
      'Il regolamento è ancora in vigore e continua a richiamare un testo cancellato nel 2016. Chi lo applica deve ricostruire da sé quale disciplina si sia messa al suo posto, e il dataset segnala il caso da 10 anni.',
    sezioni: [
      {
        titolo: 'cosa succede in pratica',
        paragrafi: [
          'Il regolamento rinvia a un atto che dal 2016 non è più in vigore, e nessuno ha aggiornato il rinvio.',
        ],
      },
      {
        titolo: 'perché conta',
        paragrafi: [
          'Chi deve applicare quella disposizione non trova il testo richiamato e deve ricostruirlo.',
        ],
      },
    ],
    modello: 'claude-opus-5',
    promptVersione: 'prova',
    generatoIl: '2026-09-13T00:00:00.000Z',
    ...patch,
  };
}

describe('verifica dell’articolo', () => {
  it('accetta un articolo che sta dentro i fatti', () => {
    expect(verifica(articolo(), fatti)).toEqual({ ok: true, motivi: [] });
  });

  it('rifiuta una cifra che nella scheda non c’è', () => {
    const esito = verifica(
      articolo({
        sezioni: [
          {
            titolo: 'cosa succede',
            paragrafi: [
              'Il rinvio riguarda 47 amministrazioni diverse, secondo quanto risulta dai testi.',
            ],
          },
          { titolo: 'perché conta', paragrafi: ['Chi applica la norma non trova il testo.'] },
        ],
      }),
      fatti,
    );
    expect(esito.ok).toBe(false);
    expect(esito.motivi.join(' ')).toContain('47');
  });

  it('rifiuta una citazione che non corrisponde a nessun testo originale', () => {
    const esito = verifica(
      articolo({
        sezioni: [
          {
            titolo: 'cosa succede',
            paragrafi: ['Il testo dice «si applica la disciplina previgente», e non è vero.'],
          },
          { titolo: 'perché conta', paragrafi: ['Chi applica la norma non trova il testo.'] },
        ],
      }),
      fatti,
    );
    expect(esito.ok).toBe(false);
    expect(esito.motivi.join(' ')).toContain('non corrisponde');
  });

  it('accetta una citazione che è davvero nella scheda', () => {
    const esito = verifica(
      articolo({
        sezioni: [
          {
            titolo: 'cosa succede',
            paragrafi: [
              'Il testo del regolamento rimanda «ai sensi del codice», e quel codice non c’è più.',
            ],
          },
          { titolo: 'perché conta', paragrafi: ['Chi applica la norma non trova il testo.'] },
        ],
      }),
      fatti,
    );
    expect(esito.ok).toBe(true);
  });

  it('rifiuta un verdetto', () => {
    for (const frase of [
      'La disposizione è illegittima e va abrogata al più presto davvero.',
      'Si tratta senza dubbio di una norma che viola la Costituzione italiana.',
    ]) {
      const esito = verifica(
        articolo({
          sezioni: [
            { titolo: 'cosa succede', paragrafi: [frase] },
            { titolo: 'perché conta', paragrafi: ['Chi applica la norma non trova il testo.'] },
          ],
        }),
        fatti,
      );
      expect(esito.ok, frase).toBe(false);
    }
  });

  it('rifiuta un articolo staccato dalla segnalazione', () => {
    const esito = verifica(articolo({ anomaliaId: 'altro' }), fatti);
    expect(esito.ok).toBe(false);
  });

  it('rifiuta un sommario che non reggerebbe da solo in un’anteprima', () => {
    const esito = verifica(articolo({ sommario: 'Troppo corto.' }), fatti);
    expect(esito.ok).toBe(false);
  });
});

describe('lo scrittore', () => {
  it('non manda mai al modello altro che la scheda dei fatti', async () => {
    let inviato: Record<string, unknown> | null = null;
    const cliente = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          inviato = params;
          return {
            content: [
              {
                type: 'tool_use',
                name: 'registra_articolo',
                input: {
                  titolo: 'Un titolo abbastanza lungo da passare',
                  sommario: 'x'.repeat(200),
                  sezioni: [{ titolo: 'a', paragrafi: ['y'.repeat(80)] }],
                },
              },
            ],
          };
        },
      },
    };

    const s = new Scrittore({ cliente, apiKey: 'prova' });
    await s.scrivi(fatti, '2026-09-13');

    const messaggi = (inviato!['messages'] as Array<{ content: string }>)[0]!.content;
    // Il corpus non ci finisce mai: il modello vede la scheda e basta.
    expect(messaggi).toContain('Rinvio a una norma abrogata');
    expect(messaggi).not.toContain('SELECT');
    expect(inviato!['model']).toBe('claude-opus-5');
  });

  it('senza chiamata allo strumento non produce un articolo vuoto: fallisce', async () => {
    const cliente = {
      messages: { create: async () => ({ content: [{ type: 'text' }] }) },
    };
    const s = new Scrittore({ cliente, apiKey: 'prova' });
    await expect(s.scrivi(fatti, '2026-09-13')).rejects.toThrow(/non ha usato lo strumento/);
  });
});

describe('slug', () => {
  it('è leggibile, stabile e senza accenti', () => {
    expect(slugDa('2026-09-13', 'Perché la norma non è più in vigore')).toBe(
      '2026-09-13-perche-la-norma-non-e-piu-in-vigore',
    );
  });
});
