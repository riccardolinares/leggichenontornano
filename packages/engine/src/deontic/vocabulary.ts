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
  // Un verticale senza confine dichiarato è il difetto che ha prodotto i falsi
  // positivi di livello 3 sul corpus reale: caricarlo comunque significherebbe
  // ripeterli. Meglio fermarsi qui, dove il messaggio è leggibile.
  if (!parsed.corpus || !Array.isArray(parsed.corpus.radici) || parsed.corpus.radici.length === 0) {
    throw new Error(
      `vocabolario senza corpus dichiarato: ${path}. Un verticale è un elenco di atti, non solo di parole: aggiungi «corpus.radici».`,
    );
  }
  if (!Array.isArray(parsed.corpus.espansione)) parsed.corpus.espansione = [];
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

/**
 * Parole troppo generiche per essere sinonimi in un vocabolario di dominio.
 *
 * Scoperto sul corpus reale: «Autorità» come sinonimo di ANAC faceva risolvere a
 * quel concetto frasi del codice della navigazione del 1942, e il confronto di
 * livello 3 produceva coppie fra norme che non c'entravano niente. Un sinonimo
 * generico non è un sinonimo impreciso: annulla la ragione per cui il
 * vocabolario esiste, cioè distinguere «impresa» negli appalti da «impresa» nel
 * fisco.
 */
const TROPPO_GENERICHE = new Set([
  'autorità',
  'autorita',
  'amministrazione',
  'ente',
  'soggetto',
  'contratto',
  'servizi',
  'servizio',
  'forniture',
  'fornitura',
  'lavori',
  'atto',
  'provvedimento',
  'procedura',
  'termine',
  'organo',
  'ufficio',
  'attività',
  'attivita',
]);

/**
 * Relazioni che non possono delimitare un verticale, e perché.
 *
 * I motivi non sono teorici: sono quello che è successo su questo corpus.
 */
const ESPANSIONE_VIETATA: Record<string, string> = {
  RINVIA:
    'rinviare a una norma non colloca l’atto in quella materia: 190 atti rinviano al codice dei contratti pubblici e quasi nessuno è un atto di appalti',
  DEROGA: 'derogare a una norma non colloca l’atto in quella materia',
  MODIFICA:
    'l’atto che modifica un codice è quasi sempre omnibus, e la modifica è già dentro il testo multivigente della radice: includerlo aggiunge solo le sue norme di altre materie',
  INTRODUCE:
    'come MODIFICA: su questo corpus gli atti che introducono articoli nel codice dei contratti pubblici sono decreti anticrisi e proroghe di termini',
  ABROGA:
    'come MODIFICA: l’abrogazione è già registrata nella vigenza della radice, e l’atto abrogante appartiene alla propria materia',
  SOSTITUISCE: 'come MODIFICA: la sostituzione è già dentro il testo multivigente della radice',
  CONVERTE: 'la legge di conversione segue il decreto convertito, non la materia del decreto',
};

/** Una sigla: tutte maiuscole, almeno due lettere, niente minuscole in mezzo. */
const SIGLA = /^[A-Z]{2,}$/;

export interface ProblemaVocabolario {
  concetto: string;
  forma: string;
  motivo: string;
}

/**
 * Controlla un vocabolario prima che entri in produzione.
 *
 * Non è un controllo di stile: un vocabolario con un sinonimo generico produce
 * segnalazioni false in massa, e le produce in silenzio.
 */
export function validaVocabolario(vocabulary: Vocabulary): ProblemaVocabolario[] {
  const problemi: ProblemaVocabolario[] = [];
  const visti = new Map<string, string>();

  if (vocabulary.corpus.radici.length === 0) {
    problemi.push({
      concetto: '(corpus)',
      forma: '',
      motivo:
        'nessuna radice dichiarata: senza confine per atti il verticale confronta norme di materie diverse',
    });
  }
  for (const radice of vocabulary.corpus.radici) {
    if (!radice.startsWith('urn:nir:')) {
      problemi.push({
        concetto: '(corpus)',
        forma: radice,
        motivo:
          'radice che non è un URN NIR: il confine del verticale si dichiara per atti, non per titoli',
      });
    }
  }
  // Quasi nessuna relazione può espandere un verticale senza riaprire il difetto
  // che il corpus dichiarato serve a chiudere.
  for (const tipo of vocabulary.corpus.espansione) {
    const motivo = ESPANSIONE_VIETATA[tipo];
    if (motivo) problemi.push({ concetto: '(corpus)', forma: tipo, motivo });
  }

  for (const concept of vocabulary.concepts) {
    for (const forma of [concept.label, ...concept.synonyms]) {
      const chiave = forma.toLowerCase().trim();

      if (TROPPO_GENERICHE.has(chiave)) {
        problemi.push({
          concetto: concept.id,
          forma,
          motivo:
            'forma troppo generica: compare in norme che non appartengono al dominio e fa collassare concetti distinti',
        });
      }

      // Una parola corta in minuscolo («ente», «atto») compare ovunque; una
      // sigla in maiuscolo («RUP», «CIG», «ANAC») è discriminante proprio
      // perché è una sigla, e nel linguaggio normativo italiano appartiene a un
      // dominio solo. La lunghezza da sola non distingue i due casi.
      if (chiave.length < 4 && !SIGLA.test(forma.trim())) {
        problemi.push({
          concetto: concept.id,
          forma,
          motivo: 'forma troppo corta per essere discriminante e non è una sigla',
        });
      }

      const altro = visti.get(chiave);
      if (altro && altro !== concept.id) {
        problemi.push({
          concetto: concept.id,
          forma,
          motivo: `la stessa forma denota anche «${altro}»: due concetti distinti non possono condividere un sinonimo`,
        });
      }
      visti.set(chiave, concept.id);
    }

    if (concept.broader && !vocabulary.concepts.some((c) => c.id === concept.broader)) {
      problemi.push({
        concetto: concept.id,
        forma: concept.broader,
        motivo: 'il concetto sovraordinato non esiste nel vocabolario',
      });
    }
  }

  return problemi;
}

/** Una relazione del grafo, ridotta a ciò che serve per delimitare il verticale. */
export interface RelazioneCorpus {
  type: string;
  sourceUrn: string;
  targetUrn: string;
}

export interface CorpusVerticale {
  /** Tutti gli atti che appartengono al dominio. */
  atti: Set<string>;
  /** Radici dichiarate che il corpus scaricato non contiene. */
  radiciAssenti: string[];
  /** Quanti atti ha aggiunto l'espansione dal grafo. */
  aggiuntiDalGrafo: number;
}

/**
 * Espande le radici dichiarate in un corpus di atti, risalendo il grafo.
 *
 * L'espansione è **di profondità uno** e passa solo da `ATTUA`: un regolamento
 * di esecuzione del codice dei contratti pubblici appartiene alla materia.
 *
 * Le altre relazioni no, e la ragione è misurata sul corpus reale:
 *
 *  - `RINVIA`: 190 atti rinviano al codice dei contratti pubblici e quasi
 *    nessuno è un atto di appalti. Citare una norma non colloca nella materia.
 *  - `MODIFICA`, `INTRODUCE`, `ABROGA`, `SOSTITUISCE`: l'atto che modifica un
 *    codice è quasi sempre omnibus — «Provvedimenti anticrisi, nonché proroga
 *    di termini» ne modifica due articoli e ne contiene trecento di altre
 *    materie. Per di più la modifica è **già dentro** il testo multivigente
 *    della radice: includere l'atto modificante non aggiunge una norma di
 *    appalti, aggiunge tutte le sue norme che appalti non sono.
 *  - La chiusura transitiva amplifica l'errore: un omnibus tira dentro gli
 *    omnibus che lo modificano, e in tre passi il verticale è il corpus intero.
 *    Su questi dati la profondità illimitata portava il verticale da 9 atti a
 *    131, e i confronti di livello 3 da 4 a 210.
 */
export function espandiCorpus(
  vocabulary: Vocabulary,
  relazioni: readonly RelazioneCorpus[],
  attiNoti?: ReadonlySet<string>,
): CorpusVerticale {
  const tipi = new Set(vocabulary.corpus.espansione);
  const perTarget = new Map<string, RelazioneCorpus[]>();
  for (const r of relazioni) {
    if (!tipi.has(r.type)) continue;
    const lista = perTarget.get(r.targetUrn);
    if (lista) lista.push(r);
    else perTarget.set(r.targetUrn, [r]);
  }

  const atti = new Set<string>();
  const radiciAssenti: string[] = [];
  for (const radice of vocabulary.corpus.radici) {
    if (attiNoti && !attiNoti.has(radice)) {
      radiciAssenti.push(radice);
      continue;
    }
    atti.add(radice);
  }
  const radici = atti.size;

  // Un solo passo, dalle radici. Nessuna chiusura transitiva: vedi sopra.
  for (const radice of [...atti]) {
    for (const r of perTarget.get(radice) ?? []) {
      if (attiNoti && !attiNoti.has(r.sourceUrn)) continue;
      atti.add(r.sourceUrn);
    }
  }

  return { atti, radiciAssenti, aggiuntiDalGrafo: atti.size - radici };
}
