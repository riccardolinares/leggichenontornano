/**
 * Parser Akoma Ntoso per gli open data di Normattiva.
 *
 * Produce un modello dell'atto che tiene insieme tre cose che servono tutte al
 * motore delle anomalie e che nessuna da sola basta:
 *
 *  1. la **struttura** (articoli, commi, lettere) con i loro eId, perché una
 *     segnalazione deve poter puntare a un comma, non a un atto;
 *  2. i **riferimenti** (`<ref href>`) e le **modifiche** dichiarate
 *     (`activeModifications` / `passiveModifications`), che sono gli archi del
 *     grafo;
 *  3. le **date**: data dell'atto (Work), data di inizio vigenza di questa
 *     versione (Expression), eventi del ciclo di vita.
 */
import { parseEli, type EliId } from './eli.js';
import {
  childNamed,
  childrenNamed,
  descendants,
  firstDescendant,
  normalizeSpace,
  parseXml,
  textContent,
  walk,
  type XmlElement,
} from './xml.js';

export interface AknProvision {
  /** eId Akoma Ntoso, es. `art_1__para_2`. */
  eId: string;
  /** Tipo strutturale: `paragraph`, `point`, `content`. */
  kind: 'paragraph' | 'point' | 'content';
  /** Numerazione così come stampata, es. `2.` oppure `a)`. */
  num: string | null;
  /** Numerazione normalizzata, es. `2` oppure `a`. */
  number: string | null;
  text: string;
  children: AknProvision[];
}

export interface AknArticle {
  eId: string;
  /** Numero dell'articolo normalizzato, es. `3` o `3-bis`. */
  number: string | null;
  /** Numerazione così come stampata, es. `Art. 3.`. */
  num: string | null;
  heading: string | null;
  /** Partizione URN corrispondente, es. `art3`. */
  partition: string | null;
  text: string;
  paragraphs: AknProvision[];
  /** Rubrica dell'allegato che contiene l'articolo, se l'articolo è in allegato. */
  container: string | null;
}

export type ModificationKind =
  | 'abrogazione'
  | 'modifica'
  | 'introduzione'
  | 'sostituzione'
  | 'proroga'
  | 'altro';

export interface AknTextualMod {
  eId: string;
  /** Tipo dichiarato nell'attributo `type` di Akoma Ntoso. */
  declaredType: string;
  /** URN o eId della norma che dispone la modifica. */
  source: string | null;
  /** URN o eId della norma modificata. */
  destination: string | null;
  /** Testo redazionale che descrive la modifica, in `nakn:text`. */
  narrative: string | null;
}

export interface AknReference {
  eId: string | null;
  /** `href` grezzo, che negli open data è un path AKN o un URN NIR. */
  href: string;
  /** Testo visualizzato del rinvio. */
  text: string;
}

export interface AknLifecycleEvent {
  date: string;
  eId: string | null;
  source: string | null;
}

export interface AknAct {
  /** URN:NIR dell'atto, dal `FRBRalias name="urn:nir"`. */
  urn: string;
  /** Identificatore ELI, quando presente. */
  eli: EliId | null;
  /** Titolo ufficiale dell'atto. */
  title: string;
  /** Tipo di atto ricavato dal path FRBR, es. `decreto_legislativo`. */
  actType: string | null;
  /** Autorità, es. `stato`. */
  authority: string | null;
  /** Data dell'atto (livello Work), formato ISO. */
  workDate: string | null;
  /**
   * Data di inizio vigenza di **questa** versione (livello Expression).
   * Per il testo originale coincide con la pubblicazione.
   */
  expressionDate: string | null;
  /** Pubblicazione in Gazzetta Ufficiale. */
  publication: { date: string | null; number: string | null } | null;
  /** `true` se il file è una versione consolidata (multivigente). */
  consolidated: boolean;
  lifecycle: AknLifecycleEvent[];
  articles: AknArticle[];
  activeModifications: AknTextualMod[];
  passiveModifications: AknTextualMod[];
  references: AknReference[];
}

export interface ParseAknOptions {
  /** Se `true` (default) include anche gli articoli contenuti negli allegati. */
  includeAttachments?: boolean;
}

export function parseAkn(xml: string, opts: ParseAknOptions = {}): AknAct {
  const root = parseXml(xml);
  if (root.localName !== 'akomaNtoso') {
    throw new Error(`radice attesa <akomaNtoso>, trovata <${root.name}>`);
  }
  const doc =
    childNamed(root, 'act') ??
    childNamed(root, 'doc') ??
    childNamed(root, 'bill') ??
    childNamed(root, 'documentCollection');
  if (!doc) throw new Error('nessun elemento di documento sotto <akomaNtoso>');

  const meta = childNamed(doc, 'meta');
  const identification = meta ? childNamed(meta, 'identification') : undefined;
  const work = identification ? childNamed(identification, 'FRBRWork') : undefined;
  const expression = identification ? childNamed(identification, 'FRBRExpression') : undefined;

  const urn = frbrAlias(work, 'urn:nir') ?? '';
  const eliAlias = frbrAlias(work, 'eli');
  const eli = eliAlias ? parseEli(eliAlias) : null;

  const workThis = work ? attrOfChild(work, 'FRBRthis', 'value') : null;
  const frbr = workThis ? parseFrbrPath(workThis) : null;

  const publicationEl = meta ? childNamed(meta, 'publication') : undefined;
  const lifecycleEl = meta ? childNamed(meta, 'lifecycle') : undefined;
  const analysisEl = meta ? childNamed(meta, 'analysis') : undefined;

  const articles = collectArticles(doc, opts.includeAttachments ?? true);

  return {
    urn,
    eli,
    title: extractTitle(work) ?? '',
    actType: frbr?.actType ?? null,
    authority: frbr?.authority ?? null,
    workDate: work ? attrOfChild(work, 'FRBRdate', 'date') : null,
    expressionDate: expression ? attrOfChild(expression, 'FRBRdate', 'date') : null,
    publication: publicationEl
      ? {
          date: publicationEl.attrs['date'] ?? null,
          number: publicationEl.attrs['number'] ?? null,
        }
      : null,
    consolidated: eli?.versionKind === 'CONSOLIDATED',
    lifecycle: lifecycleEl
      ? childrenNamed(lifecycleEl, 'eventRef').map((e) => ({
          date: e.attrs['date'] ?? '',
          eId: e.attrs['eId'] ?? null,
          source: e.attrs['source'] ?? null,
        }))
      : [],
    articles,
    activeModifications: analysisEl ? collectMods(analysisEl, 'activeModifications') : [],
    passiveModifications: analysisEl ? collectMods(analysisEl, 'passiveModifications') : [],
    references: collectReferences(doc),
  };
}

function attrOfChild(parent: XmlElement, localName: string, attr: string): string | null {
  const el = childNamed(parent, localName);
  return el?.attrs[attr] ?? null;
}

function frbrAlias(work: XmlElement | undefined, name: string): string | null {
  if (!work) return null;
  for (const alias of childrenNamed(work, 'FRBRalias')) {
    if (alias.attrs['name'] === name) return alias.attrs['value'] ?? null;
  }
  return null;
}

/**
 * Titolo dell'atto: sta in un `nrdfa:span` con `property="eli:title"`.
 * Normattiva lo chiude con il codice redazionale fra parentesi, che qui si
 * toglie perché è metadato, non titolo.
 */
function extractTitle(work: XmlElement | undefined): string | null {
  if (!work) return null;
  let title: string | null = null;
  walk(work, (el) => {
    if (title) return;
    if (el.localName === 'span' && el.attrs['property'] === 'eli:title') {
      title = el.attrs['content'] ?? null;
    }
  });
  if (!title) return null;
  return normalizeSpace(String(title).replace(/\s*\([0-9A-Z]{6,}\)\s*$/, ''));
}

interface FrbrPath {
  authority: string | null;
  actType: string | null;
}

/** `/akn/it/act/decreto_legislativo/stato/2016-04-18/50/!main` */
export function parseFrbrPath(path: string): FrbrPath {
  const segs = path.split('/').filter(Boolean);
  const actIdx = segs.indexOf('act');
  if (actIdx < 0) return { authority: null, actType: null };
  return {
    actType: segs[actIdx + 1] ?? null,
    authority: segs[actIdx + 2] ?? null,
  };
}

function collectArticles(doc: XmlElement, includeAttachments: boolean): AknArticle[] {
  const out: AknArticle[] = [];
  const body = childNamed(doc, 'body') ?? childNamed(doc, 'mainBody');
  if (body) collectArticlesFrom(body, null, out);
  if (includeAttachments) {
    for (const attachment of descendants(doc, 'attachment')) {
      const inner = firstDescendant(attachment, 'doc') ?? attachment;
      const label = attachmentLabel(inner);
      const main = childNamed(inner, 'mainBody') ?? childNamed(inner, 'body') ?? inner;
      collectArticlesFrom(main, label, out);
    }
  }
  return out;
}

function attachmentLabel(doc: XmlElement): string | null {
  const heading = firstDescendant(doc, 'docTitle') ?? firstDescendant(doc, 'heading');
  if (heading) return textContent(heading);
  return doc.attrs['name'] ?? null;
}

function collectArticlesFrom(el: XmlElement, container: string | null, out: AknArticle[]): void {
  for (const article of descendants(el, 'article')) {
    const num = childNamed(article, 'num');
    const headingEl = childNamed(article, 'heading');
    const numText = num ? textContent(num) : null;
    const number = normalizeArticleNumber(numText);
    out.push({
      eId: article.attrs['eId'] ?? '',
      num: numText,
      number,
      heading: headingEl ? stripOuterParens(textContent(headingEl)) : null,
      partition: number ? `art${number}` : null,
      text: textContent(article),
      paragraphs: collectProvisions(article),
      container,
    });
  }
}

/** `Art. 3-bis.` → `3-bis`; `Art. 12.` → `12`. */
export function normalizeArticleNumber(num: string | null): string | null {
  if (!num) return null;
  const m = /(\d+)\s*[-–]?\s*(bis|ter|quater|quinquies|sexies|septies|octies|novies|decies)?/i.exec(
    num,
  );
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2].toLowerCase()}` : m[1]!;
}

function stripOuterParens(s: string): string {
  const t = s.trim();
  return t.startsWith('(') && t.endsWith(')') ? t.slice(1, -1).trim() : t;
}

function collectProvisions(parent: XmlElement): AknProvision[] {
  const out: AknProvision[] = [];
  for (const child of parent.children) {
    if (child.kind !== 'element') continue;
    if (child.localName === 'paragraph' || child.localName === 'point') {
      const num = childNamed(child, 'num');
      const numText = num ? textContent(num) : null;
      out.push({
        eId: child.attrs['eId'] ?? '',
        kind: child.localName,
        num: numText,
        number: normalizeProvisionNumber(numText),
        text: textContent(child),
        children: collectProvisions(
          childNamed(child, 'list') ?? childNamed(child, 'content') ?? child,
        ),
      });
    } else if (child.localName === 'list' || child.localName === 'content') {
      out.push(...collectProvisions(child));
    }
  }
  return out;
}

/** `2.` → `2`; `a)` → `a`; `2-bis.` → `2-bis`. */
export function normalizeProvisionNumber(num: string | null): string | null {
  if (!num) return null;
  const t = num.trim().replace(/[.)\]]+$/, '');
  return t.length > 0 ? t.toLowerCase() : null;
}

function collectMods(analysis: XmlElement, section: string): AknTextualMod[] {
  const container = childNamed(analysis, section);
  if (!container) return [];
  const out: AknTextualMod[] = [];
  for (const mod of childrenNamed(container, 'textualMod')) {
    const source = childNamed(mod, 'source');
    const destination = childNamed(mod, 'destination');
    const neu = childNamed(mod, 'new');
    const narrativeEl = neu ? firstDescendant(neu, 'text') : undefined;
    out.push({
      eId: mod.attrs['eId'] ?? '',
      declaredType: mod.attrs['type'] ?? '',
      source: cleanHref(source?.attrs['href']),
      destination: cleanHref(destination?.attrs['href']),
      narrative: narrativeEl ? textContent(narrativeEl) : neu ? textContent(neu) : null,
    });
  }
  return out;
}

function cleanHref(href: string | undefined): string | null {
  if (!href) return null;
  const t = href.trim();
  if (t.length === 0 || t === '#') return null;
  return t;
}

function collectReferences(doc: XmlElement): AknReference[] {
  const out: AknReference[] = [];
  for (const ref of descendants(doc, 'ref')) {
    const href = ref.attrs['href'];
    if (!href) continue;
    out.push({
      eId: ref.attrs['eId'] ?? null,
      href,
      text: textContent(ref),
    });
  }
  return out;
}
