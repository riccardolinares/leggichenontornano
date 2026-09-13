import { describe, expect, it } from 'vitest';
import {
  citazioneVerificata,
  coppieCandidate,
  eseguiContrastoAssistito,
  somiglianza,
  CONTRASTO_ASSISTITO_DEFINITION,
} from '../src/checks/level4/contrasto-assistito.js';
import type { DeonticProposition } from '../src/deontic/types.js';
import type { ActView } from '../src/corpus-view.js';

function prop(patch: Partial<DeonticProposition> = {}): DeonticProposition {
  return {
    urn: 'urn:nir:stato:legge:2020-01-01;1~art1-com1',
    provisionId: 'p1',
    mode: 'OBBLIGO',
    subject: 'la stazione appaltante',
    subjectConcept: null,
    object: 'trasmette la documentazione di gara',
    deadlineDays: 30,
    deadlineText: 'trenta giorni',
    consequence: null,
    conditions: [],
    exceptions: [],
    scope: null,
    vertical: 'appalti',
    inForceFrom: '2020-01-01',
    inForceTo: null,
    extractor: 'prova',
    quote: 'La stazione appaltante trasmette la documentazione di gara entro trenta giorni.',
    ...patch,
  };
}

const atti = new Map<string, ActView>([
  [
    'urn:nir:stato:legge:2020-01-01;1',
    { urn: 'urn:nir:stato:legge:2020-01-01;1', title: 'Legge A', sourceRank: 20 } as ActView,
  ],
  [
    'urn:nir:stato:legge:2021-01-01;2',
    { urn: 'urn:nir:stato:legge:2021-01-01;2', title: 'Legge B', sourceRank: 20 } as ActView,
  ],
]);

const a = prop();
const b = prop({
  urn: 'urn:nir:stato:legge:2021-01-01;2~art3-com1',
  provisionId: 'p2',
  deadlineDays: 90,
  deadlineText: 'novanta giorni',
  quote:
    'La stazione appaltante trasmette la documentazione di gara previo parere reso entro novanta giorni.',
  inForceFrom: '2021-01-01',
});

function cliente(risposta: Record<string, unknown>) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'tool_use', name: 'registra_confronto', input: risposta }],
      }),
    },
  };
}

describe('selezione delle coppie', () => {
  it('è il codice a scegliere cosa guardare, e lo fa sempre allo stesso modo', () => {
    const uno = coppieCandidate([a, b]);
    const due = coppieCandidate([a, b]);
    expect(uno).toHaveLength(1);
    expect(uno.map((c) => `${c.a.urn}|${c.b.urn}`)).toEqual(
      due.map((c) => `${c.a.urn}|${c.b.urn}`),
    );
  });

  it('non confronta due commi dello stesso atto', () => {
    const stessoAtto = prop({
      urn: 'urn:nir:stato:legge:2020-01-01;1~art9-com1',
      provisionId: 'p9',
    });
    expect(coppieCandidate([a, stessoAtto])).toHaveLength(0);
  });

  it('non confronta norme che non sono mai state in vigore insieme', () => {
    const chiusa = prop({
      urn: 'urn:nir:stato:legge:2021-01-01;2~art3-com1',
      inForceFrom: '2010-01-01',
      inForceTo: '2012-01-01',
    });
    expect(coppieCandidate([a, chiusa])).toHaveLength(0);
  });

  it('due norme che non si somigliano non finiscono davanti al modello', () => {
    const altra = prop({
      urn: 'urn:nir:stato:legge:2021-01-01;2~art3-com1',
      subject: 'il concessionario autostradale',
      object: 'installa i dispositivi di pesatura dinamica',
      quote: 'Il concessionario autostradale installa i dispositivi di pesatura dinamica.',
    });
    expect(somiglianza(a, altra)).toBeLessThan(0.45);
    expect(coppieCandidate([a, altra])).toHaveLength(0);
  });
});

describe('verifica delle citazioni', () => {
  it('accetta una porzione che è davvero nel testo', () => {
    expect(citazioneVerificata('entro trenta giorni', a.quote)).toBe(true);
  });

  it('rifiuta una citazione inventata', () => {
    expect(citazioneVerificata('entro quindici giorni lavorativi', a.quote)).toBe(false);
  });

  it('rifiuta una citazione troppo corta per dire qualcosa', () => {
    expect(citazioneVerificata('gara', a.quote)).toBe(false);
  });
});

describe('esecuzione', () => {
  const ctx = { today: '2026-01-01' };

  it('produce una segnalazione quando il contrasto regge sulle citazioni', async () => {
    const trovate = await eseguiContrastoAssistito(
      coppieCandidate([a, b]),
      {
        cliente: cliente({
          contrasto: true,
          confidenza: 'alta',
          ragionamento:
            'Il termine di trenta giorni non può essere rispettato se il parere arriva in novanta.',
          citazione_a: 'entro trenta giorni',
          citazione_b: 'parere reso entro novanta giorni',
        }),
        acts: atti,
      },
      ctx,
    );

    expect(trovate).toHaveLength(1);
    expect(trovate[0]!.level).toBe(4);
    expect(trovate[0]!.assistita?.confidenza).toBe('alta');
    // La prosa del modello sta nel suo campo, non in `plainLanguage`.
    expect(trovate[0]!.plainLanguage).not.toContain('non può essere rispettato');
    expect(trovate[0]!.assistita?.ragionamento).toContain('non può essere rispettato');
  });

  it('scarta la segnalazione se una citazione non è nei testi', async () => {
    const trovate = await eseguiContrastoAssistito(
      coppieCandidate([a, b]),
      {
        cliente: cliente({
          contrasto: true,
          confidenza: 'alta',
          ragionamento: 'Sembrano incompatibili.',
          citazione_a: 'entro quindici giorni lavorativi',
          citazione_b: 'parere reso entro novanta giorni',
        }),
        acts: atti,
      },
      ctx,
    );
    expect(trovate).toHaveLength(0);
  });

  it('quando il modello dice che non c’è contrasto, non c’è segnalazione', async () => {
    const trovate = await eseguiContrastoAssistito(
      coppieCandidate([a, b]),
      {
        cliente: cliente({
          contrasto: false,
          confidenza: 'alta',
          ragionamento: 'Riguardano adempimenti diversi.',
          citazione_a: 'entro trenta giorni',
          citazione_b: 'parere reso entro novanta giorni',
        }),
        acts: atti,
      },
      ctx,
    );
    expect(trovate).toHaveLength(0);
  });

  it('l’identificatore è stabile fra due giri', async () => {
    const giro = async () =>
      (
        await eseguiContrastoAssistito(
          coppieCandidate([a, b]),
          {
            cliente: cliente({
              contrasto: true,
              confidenza: 'media',
              ragionamento: 'I due termini non stanno insieme.',
              citazione_a: 'entro trenta giorni',
              citazione_b: 'parere reso entro novanta giorni',
            }),
            acts: atti,
          },
          ctx,
        )
      )[0]!.id;
    expect(await giro()).toBe(await giro());
  });

  it('il controllo si dichiara assistito, non solo non deterministico', () => {
    expect(CONTRASTO_ASSISTITO_DEFINITION.deterministic).toBe(false);
    expect(CONTRASTO_ASSISTITO_DEFINITION.assistito).toBe(true);
  });
});
