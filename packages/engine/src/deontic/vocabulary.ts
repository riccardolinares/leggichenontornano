/**
 * Caricamento e uso del vocabolario controllato.
 *
 * Il vocabolario è la ragione per cui il layer semantico si attiva un verticale
 * alla volta (ADR 0005). Senza di esso la similarità testuale produce falsi
 * positivi in massa: «impresa» negli appalti e «impresa» nel fisco sono lo
 * stesso token e due fattispecie diverse.
 *
 * I vocabolari stanno in `data/vocabolari/<verticale>.json`, sono file leggibili
 * e revisionabili, e ogni concetto porta le forme testuali che lo denotano **in
 * quel dominio**.
 */
import { readFileSync } from 'node:fs';
import type { Vocabulary, VocabularyConcept } from './types.js';

export function loadVocabulary(path: string): Vocabulary {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Vocabulary;
  if (!parsed.vertical || !Array.isArray(parsed.concepts)) {
    throw new Error(`vocabolario malformato: ${path}`);
  }
  return parsed;
}

/**
 * Indice delle forme testuali di un vocabolario, per la risoluzione.
 *
 * Le forme più lunghe si provano per prime: «stazione appaltante» deve vincere
 * su «stazione», altrimenti la fattispecie si perde nel termine generico e due
 * norme che parlano di cose diverse finiscono nello stesso concetto.
 */
export class VocabularyIndex {
  private readonly forms: Array<{ form: string; concept: VocabularyConcept }>;

  constructor(readonly vocabulary: Vocabulary) {
    this.forms = [];
    for (const concept of vocabulary.concepts) {
      for (const form of [concept.label, ...concept.synonyms]) {
        this.forms.push({ form: normalize(form), concept });
      }
    }
    this.forms.sort((a, b) => b.form.length - a.form.length);
  }

  /**
   * Concetto denotato da un testo, o `null` se nessuno.
   *
   * `null` non è un fallimento da nascondere: una proposizione senza concetto non
   * entra nei confronti, ed è esattamente quello che deve succedere.
   */
  resolve(text: string): VocabularyConcept | null {
    const haystack = normalize(text);
    for (const { form, concept } of this.forms) {
      if (haystack.includes(form)) return concept;
    }
    return null;
  }

  /** Tutti i concetti denotati in un testo, dal più specifico. */
  resolveAll(text: string): VocabularyConcept[] {
    const haystack = normalize(text);
    const seen = new Set<string>();
    const out: VocabularyConcept[] = [];
    for (const { form, concept } of this.forms) {
      if (seen.has(concept.id)) continue;
      if (haystack.includes(form)) {
        seen.add(concept.id);
        out.push(concept);
      }
    }
    return out;
  }

  /**
   * Due concetti si riferiscono a fattispecie sovrapposte?
   *
   * Sovrapposti significa: lo stesso concetto, oppure uno discende dall'altro
   * nella gerarchia `broader`. Due concetti fratelli **non** sono sovrapposti:
   * «lavori» e «servizi» sono entrambi appalti e restano cose diverse.
   */
  overlaps(a: string, b: string): boolean {
    if (a === b) return true;
    return this.ancestors(a).includes(b) || this.ancestors(b).includes(a);
  }

  ancestors(conceptId: string): string[] {
    const out: string[] = [];
    let current = this.byId(conceptId)?.broader;
    const guard = new Set<string>([conceptId]);
    while (current && !guard.has(current)) {
      out.push(current);
      guard.add(current);
      current = this.byId(current)?.broader;
    }
    return out;
  }

  byId(conceptId: string): VocabularyConcept | null {
    return this.vocabulary.concepts.find((c) => c.id === conceptId) ?? null;
  }

  get size(): number {
    return this.vocabulary.concepts.length;
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
