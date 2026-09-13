import { describe, expect, it, vi } from 'vitest';
import { RuleBasedExtractor, detectMode, splitSentences, toDays } from '../src/deontic/rule-based.js';
import { VocabularyIndex } from '../src/deontic/vocabulary.js';
import { LlmExtractor, LLM_EXTRACTION_TOOL, LLM_SYSTEM_PROMPT } from '../src/deontic/llm.js';
import { extractMandates, daysLate } from '../src/checks/level1/attuazione-mancante.js';
import type { Vocabulary } from '../src/deontic/types.js';

const VOCABOLARIO: Vocabulary = {
  vertical: 'appalti',
  label: 'Appalti e contratti pubblici',
  concepts: [
    {
      id: 'stazione-appaltante',
      label: 'stazione appaltante',
      synonyms: ['amministrazione aggiudicatrice'],
    },
    { id: 'operatore-economico', label: 'operatore economico', synonyms: [] },
    { id: 'appalto', label: 'appalto', synonyms: [] },
    { id: 'appalto-lavori', label: 'appalto di lavori', synonyms: [], broader: 'appalto' },
  ],
};

describe('VocabularyIndex', () => {
  const index = new VocabularyIndex(VOCABOLARIO);

  it('preferisce la forma più lunga', () => {
    // «stazione» da sola non deve vincere su «stazione appaltante».
    expect(index.resolve('la stazione appaltante procede')?.id).toBe('stazione-appaltante');
  });

  it('riconosce i sinonimi di dominio', () => {
    expect(index.resolve("l'amministrazione aggiudicatrice")?.id).toBe('stazione-appaltante');
  });

  it('ignora accenti e punteggiatura', () => {
    expect(index.resolve('LA STAZIONE APPALTANTE,')?.id).toBe('stazione-appaltante');
  });

  it('restituisce null quando nessun concetto corrisponde', () => {
    expect(index.resolve('il contribuente')).toBeNull();
  });

  it('considera sovrapposte una fattispecie e la sua sovraordinata', () => {
    expect(index.overlaps('appalto-lavori', 'appalto')).toBe(true);
    expect(index.overlaps('appalto', 'appalto')).toBe(true);
  });

  it('non considera sovrapposte due fattispecie non legate', () => {
    expect(index.overlaps('appalto-lavori', 'operatore-economico')).toBe(false);
  });
});

describe('RuleBasedExtractor', () => {
  const extractor = new RuleBasedExtractor();
  const extract = (text: string) =>
    extractor.extract({
      urn: 'urn:nir:stato:legge:2016-01-01;1~art3-com1',
      provisionId: 'p1',
      text,
      vertical: 'appalti',
      inForceFrom: '2016-01-01',
      inForceTo: null,
      vocabulary: VOCABOLARIO,
    });

  it('riconosce un obbligo con termine', () => {
    const [p] = extract(
      'La stazione appaltante deve pubblicare l’avviso di aggiudicazione entro trenta giorni dalla conclusione del contratto.',
    );
    expect(p?.mode).toBe('OBBLIGO');
    expect(p?.subjectConcept).toBe('stazione-appaltante');
    expect(p?.deadlineDays).toBe(30);
  });

  it('riconosce un divieto e non lo scambia per un potere', () => {
    const [p] = extract(
      'L’operatore economico non può partecipare alla gara in più di un raggruppamento temporaneo.',
    );
    expect(p?.mode).toBe('DIVIETO');
  });

  it('riconosce le eccezioni e le condizioni', () => {
    const [p] = extract(
      'La stazione appaltante deve motivare la scelta qualora ricorrano ragioni di urgenza, salvo i casi di somma urgenza.',
    );
    expect(p?.conditions.length).toBeGreaterThan(0);
    expect(p?.exceptions.length).toBeGreaterThan(0);
  });

  it('registra sempre chi ha estratto e da quale frase', () => {
    const [p] = extract('La stazione appaltante deve pubblicare entro trenta giorni.');
    expect(p?.extractor).toBe('regole/1.0');
    expect(p?.quote).toContain('deve pubblicare');
  });

  it('porta la finestra di vigenza su ogni proposizione', () => {
    const [p] = extract('La stazione appaltante deve pubblicare entro trenta giorni.');
    expect(p?.inForceFrom).toBe('2016-01-01');
    expect(p?.inForceTo).toBeNull();
  });

  it('non estrae nulla da una frase senza modalità deontica', () => {
    expect(extract('Il presente codice disciplina i contratti di appalto e di concessione.')).toEqual(
      [],
    );
  });

  it('lascia null il concetto quando il vocabolario non copre il soggetto', () => {
    const [p] = extract('Il contribuente deve presentare la dichiarazione entro novanta giorni.');
    expect(p?.subjectConcept).toBeNull();
  });
});

describe('helper dell’estrazione', () => {
  it('converte i termini in giorni', () => {
    expect(toDays('trenta', 'giorni')).toBe(30);
    expect(toDays('90', 'giorni')).toBe(90);
    expect(toDays('sei', 'mesi')).toBe(183);
    expect(toDays('un', 'anno')).toBe(365);
    expect(toDays('molti', 'giorni')).toBeNull();
  });

  it('separa le frasi del testo normativo', () => {
    expect(splitSentences('Primo periodo. Secondo periodo; terzo.')).toHaveLength(3);
  });

  it('detectMode dà la precedenza al divieto', () => {
    expect(detectMode('non può procedere')).toBe('DIVIETO');
    expect(detectMode('può procedere')).toBe('POTERE');
  });
});

describe('estrazione dei mandati attuativi', () => {
  const provision = (text: string) => ({
    id: 'p1',
    actUrn: 'urn:nir:stato:legge:2016-01-01;1',
    articleNumber: '3',
    number: '1',
    kind: 'paragraph',
    text,
    inForceFrom: '2016-01-16',
    inForceTo: null,
  });

  it('legge strumento, termine e scadenza', () => {
    const [m] = extractMandates(
      provision(
        'Con decreto del Ministro dell’economia, da adottare entro sessanta giorni dalla data di entrata in vigore della presente legge, sono stabilite le modalità attuative.',
      ),
      '2016-01-16',
    );
    expect(m?.deadlineDays).toBe(60);
    expect(m?.dueBy).toBe('2016-03-16');
    expect(m?.instrument).toContain('decreto del ministro');
  });

  it('non conta una frase che nomina un decreto senza imporre un termine', () => {
    expect(
      extractMandates(
        provision('Con decreto del Ministro sono individuate le amministrazioni interessate.'),
        '2016-01-16',
      ),
    ).toEqual([]);
  });

  it('non conta un termine che non riguarda l’adozione di un provvedimento', () => {
    expect(
      extractMandates(
        provision('Il ricorso è presentato entro trenta giorni dalla notifica.'),
        '2016-01-16',
      ),
    ).toEqual([]);
  });

  it('calcola i giorni di ritardo', () => {
    expect(daysLate('2016-03-16', '2016-03-26')).toBe(10);
  });
});

describe('LlmExtractor', () => {
  it('il prompt vieta esplicitamente il confronto fra norme', () => {
    expect(LLM_SYSTEM_PROMPT).toContain('non ne vedrai mai due insieme');
    expect(LLM_SYSTEM_PROMPT).toContain('Non devi');
  });

  it('lo schema non ha un campo libero per un verdetto', () => {
    const props = LLM_EXTRACTION_TOOL.input_schema.properties.proposizioni.items.properties;
    const campi = Object.keys(props);
    expect(campi).toContain('modalita');
    expect(campi).toContain('citazione');
    for (const vietato of ['verdetto', 'conflitto', 'valutazione', 'giudizio', 'spiegazione']) {
      expect(campi).not.toContain(vietato);
    }
  });

  it('estrae i campi restituiti dallo strumento, senza aggiungere nulla', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'registra_proposizioni',
              input: {
                proposizioni: [
                  {
                    modalita: 'OBBLIGO',
                    soggetto: 'la stazione appaltante',
                    oggetto: 'pubblicare l’avviso',
                    termine_giorni: 30,
                    termine_testo: 'entro trenta giorni',
                    citazione: 'La stazione appaltante deve pubblicare entro trenta giorni.',
                  },
                ],
              },
            },
          ],
        }),
      },
    };
    const extractor = new LlmExtractor({ client, apiKey: 'finta' });
    const out = await extractor.extract({
      urn: 'urn:nir:stato:legge:2016-01-01;1~art3-com1',
      provisionId: 'p1',
      text: 'La stazione appaltante deve pubblicare entro trenta giorni.',
      vertical: 'appalti',
      inForceFrom: '2016-01-01',
      inForceTo: null,
      vocabulary: VOCABOLARIO,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.mode).toBe('OBBLIGO');
    expect(out[0]?.subjectConcept).toBe('stazione-appaltante');
    expect(out[0]?.extractor).toContain('claude-opus-5');
    expect(client.messages.create).toHaveBeenCalledOnce();
  });

  it('una risposta senza chiamata allo strumento non produce proposizioni inventate', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Non saprei.' }],
        }),
      },
    };
    const extractor = new LlmExtractor({ client, apiKey: 'finta' });
    const out = await extractor.extract({
      urn: 'urn:nir:stato:legge:2016-01-01;1',
      provisionId: 'p1',
      text: 'qualcosa',
      vertical: 'appalti',
      inForceFrom: '2016-01-01',
      inForceTo: null,
      vocabulary: VOCABOLARIO,
    });
    expect(out).toEqual([]);
  });
});
