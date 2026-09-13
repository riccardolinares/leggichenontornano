/**
 * Formattazione dei testi mostrati nel sito.
 *
 * Regola generale: niente prosa generata. Tutto quello che compare nel sito o è
 * testo normativo citato alla lettera, o è un template scritto qui, o è un campo
 * del dataset. Le funzioni di questo file sono la terza categoria, e sono poche
 * di proposito.
 */
import { humanLabel, tryParseUrn } from '@antinomia/akn-parser';

const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

/** `2016-04-18` → «18 aprile 2016». */
export function data(iso: string | null | undefined): string {
  if (!iso) return 'data non nota';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${MESI[Number(m) - 1] ?? m} ${y}`;
}

/** Finestra di vigenza in lingua comune. */
export function finestra(from: string | null, to: string | null): string {
  if (!from) return 'periodo non determinato';
  if (!to) return `dal ${data(from)}, tuttora in vigore`;
  return `dal ${data(from)} al ${data(to)}`;
}

/** Etichetta leggibile di un URN, con la partizione quando c'è. */
export function nomeNorma(urn: string): string {
  const parsed = tryParseUrn(urn);
  if (!parsed) return urn;
  return humanLabel(parsed);
}

/** URN dell'atto, senza partizione: serve per i collegamenti al lettore. */
export function urnAtto(urn: string): string {
  return urn.split('~')[0] ?? urn;
}

/** Numero di articolo contenuto nella partizione di un URN, se c'è. */
export function articoloDi(urn: string): string | null {
  const m = /~art(\d+(?:-(?:bis|ter|quater|quinquies))?)/i.exec(urn);
  return m?.[1] ?? null;
}

/** Percorso del lettore norma per un URN, con l'eventuale data di vigenza. */
export function percorsoNorma(urn: string, vigenza?: string | null): string {
  const base = `/norma/${encodeURIComponent(urn)}`;
  return vigenza ? `${base}?v=${vigenza}` : base;
}

/** Percorso della scheda anomalia. */
export function percorsoAnomalia(id: string): string {
  return `/anomalia/${encodeURIComponent(id)}`;
}

/** Etichetta del livello della tassonomia. */
export function livello(n: number): string {
  switch (n) {
    case 1:
      return 'Livello 1 — deterministico';
    case 2:
      return 'Livello 2 — gerarchia e competenza';
    default:
      return 'Livello 3 — estrazione e query';
  }
}

/** Classe CSS dell'etichetta in base alla gravità dichiarata. */
export function classeGravita(severity: string): string {
  if (severity === 'alta') return 'etichetta etichetta--antinomia';
  if (severity === 'bassa') return 'etichetta etichetta--neutra';
  return 'etichetta etichetta--area-grigia';
}

/** Percentuale con una cifra, o un trattino esplicito quando non è misurata. */
export function percentuale(value: number | null): string {
  if (value === null) return 'non misurata';
  return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

/** Numero con separatore delle migliaia all'italiana. */
export function numero(value: number): string {
  return new Intl.NumberFormat('it-IT').format(value);
}
