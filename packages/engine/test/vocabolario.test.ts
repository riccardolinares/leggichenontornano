import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { espandiCorpus, loadVocabulary, validaVocabolario } from '../src/deontic/vocabulary.js';

const CARTELLA = join(import.meta.dirname, '../../../data/vocabolari');

const CORPUS_PROVA = { radici: ['urn:nir:stato:legge:2020-01-01;1'], espansione: ['ATTUA'] };

describe('i vocabolari controllati del repository', () => {
  const file = readdirSync(CARTELLA).filter((f) => f.endsWith('.json'));

  it('ce n’è almeno uno', () => {
    expect(file.length).toBeGreaterThan(0);
  });

  for (const nome of file) {
    it(`${nome} non contiene forme generiche, corte o ambigue`, () => {
      const vocabolario = loadVocabulary(join(CARTELLA, nome));
      const problemi = validaVocabolario(vocabolario);
      const dettaglio = problemi
        .map((p) => `  ${p.concetto} → «${p.forma}»: ${p.motivo}`)
        .join('\n');
      expect(dettaglio, `Problemi in ${nome}:\n${dettaglio}`).toBe('');
    });

    it(`${nome} dichiara il proprio confine per atti`, () => {
      // Il verticale è un elenco di atti, non di parole (ADR 0009). Senza
      // radici il confronto di livello 3 esce dal dominio e non se ne accorge
      // nessuno.
      const vocabolario = loadVocabulary(join(CARTELLA, nome));
      expect(vocabolario.corpus.radici.length).toBeGreaterThan(0);
      for (const radice of vocabolario.corpus.radici) {
        expect(radice).toMatch(/^urn:nir:/);
      }
    });

    it(`${nome} ha abbastanza concetti per essere utile`, () => {
      // «Poche centinaia di concetti» è l'ordine di grandezza indicato dal
      // metodo; sotto la ventina il verticale non copre il dominio.
      const vocabolario = loadVocabulary(join(CARTELLA, nome));
      expect(vocabolario.concepts.length).toBeGreaterThanOrEqual(20);
    });
  }
});

describe('validaVocabolario', () => {
  it('rifiuta una forma generica', () => {
    const problemi = validaVocabolario({
      vertical: 'prova',
      label: 'Prova',
      corpus: CORPUS_PROVA,
      concepts: [{ id: 'a', label: 'autorità di prova', synonyms: ['Autorità'] }],
    });
    expect(problemi.map((p) => p.forma)).toContain('Autorità');
  });

  it('rifiuta lo stesso sinonimo su due concetti', () => {
    const problemi = validaVocabolario({
      vertical: 'prova',
      label: 'Prova',
      corpus: CORPUS_PROVA,
      concepts: [
        { id: 'a', label: 'concetto alfa', synonyms: ['forma condivisa'] },
        { id: 'b', label: 'concetto beta', synonyms: ['forma condivisa'] },
      ],
    });
    expect(problemi.some((p) => p.motivo.includes('denota anche'))).toBe(true);
  });

  it('rifiuta un sovraordinato inesistente', () => {
    const problemi = validaVocabolario({
      vertical: 'prova',
      label: 'Prova',
      corpus: CORPUS_PROVA,
      concepts: [{ id: 'a', label: 'concetto alfa', synonyms: [], broader: 'inesistente' }],
    });
    expect(problemi.some((p) => p.motivo.includes('sovraordinato'))).toBe(true);
  });

  it('accetta un vocabolario sano', () => {
    expect(
      validaVocabolario({
        vertical: 'prova',
        label: 'Prova',
        corpus: CORPUS_PROVA,
        concepts: [
          { id: 'a', label: 'stazione appaltante', synonyms: ['amministrazione aggiudicatrice'] },
          { id: 'b', label: 'operatore economico', synonyms: [], broader: 'a' },
        ],
      }),
    ).toEqual([]);
  });
});

describe('il confine del verticale', () => {
  const vocabolario = {
    vertical: 'prova',
    label: 'Prova',
    corpus: { radici: ['urn:a', 'urn:mancante'], espansione: ['ATTUA'] },
    concepts: [],
  };
  const relazioni = [
    { type: 'ATTUA', sourceUrn: 'urn:b', targetUrn: 'urn:a' },
    { type: 'MODIFICA', sourceUrn: 'urn:omnibus', targetUrn: 'urn:a' },
    { type: 'ATTUA', sourceUrn: 'urn:c', targetUrn: 'urn:b' },
  ];
  const noti = new Set(['urn:a', 'urn:b', 'urn:c', 'urn:omnibus']);

  it('parte dalle radici e aggiunge chi le attua', () => {
    const corpus = espandiCorpus(vocabolario, relazioni, noti);
    expect([...corpus.atti].sort()).toEqual(['urn:a', 'urn:b']);
    expect(corpus.aggiuntiDalGrafo).toBe(1);
  });

  it('non è transitivo: chi attua un attuatore resta fuori', () => {
    // La chiusura transitiva su questi dati portava il verticale da 9 atti a
    // 131, trascinandoci dentro il codice della navigazione del 1952.
    expect([...espandiCorpus(vocabolario, relazioni, noti).atti]).not.toContain('urn:c');
  });

  it('ignora le relazioni non dichiarate', () => {
    expect([...espandiCorpus(vocabolario, relazioni, noti).atti]).not.toContain('urn:omnibus');
  });

  it('dichiara le radici assenti invece di tacerle', () => {
    expect(espandiCorpus(vocabolario, relazioni, noti).radiciAssenti).toEqual(['urn:mancante']);
  });

  it('rifiuta MODIFICA come criterio di espansione', () => {
    const problemi = validaVocabolario({
      ...vocabolario,
      corpus: { radici: ['urn:nir:stato:legge:2020-01-01;1'], espansione: ['MODIFICA'] },
    });
    expect(problemi.some((p) => p.forma === 'MODIFICA')).toBe(true);
  });

  it('rifiuta una radice che non è un URN', () => {
    const problemi = validaVocabolario({
      ...vocabolario,
      corpus: { radici: ['Codice dei contratti pubblici'], espansione: ['ATTUA'] },
    });
    expect(problemi.some((p) => p.motivo.includes('URN NIR'))).toBe(true);
  });
});
