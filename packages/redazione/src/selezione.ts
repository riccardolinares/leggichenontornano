/**
 * Quale segnalazione raccontare oggi.
 *
 * Stessa logica del bot — deterministica sulla data, mai due volte la stessa —
 * ma con un criterio in più: il blog preferisce le segnalazioni che hanno
 * **materiale per un articolo**. Una scheda senza citazioni e senza finestra
 * temporale produce un pezzo che gira a vuoto, e il modello, non potendo
 * inventare, finirebbe per ripetere il titolo in tre modi diversi.
 */
import type { SnapshotAnomaly, SnapshotReader } from '@leggichenontornano/corpus';

export interface Scelta {
  anomalia: SnapshotAnomaly;
  motivo: string;
}

export interface OpzioniScelta {
  giorno: string;
  giaRaccontate?: ReadonlySet<string>;
}

interface RigaProva {
  quote?: string;
}

/** Quanto materiale ha una scheda: più è alto, meglio si scrive. */
function materiale(a: SnapshotAnomaly): number {
  const prove = ((a.evidence ?? []) as RigaProva[]).filter(
    (p) => typeof p.quote === 'string' && p.quote.trim().length > 80,
  ).length;
  const criteri = Array.isArray(a.resolutions) ? a.resolutions.length : 0;
  const finestra = a.windowFrom ? 1 : 0;
  return prove * 2 + criteri + finestra;
}

export function selezionaPerIlBlog(reader: SnapshotReader, opts: OpzioniScelta): Scelta | null {
  const giaRaccontate = opts.giaRaccontate ?? new Set<string>();
  const candidate = reader.publishedAnomalies().filter((a) => !giaRaccontate.has(a.id));
  if (candidate.length === 0) return null;

  const peso = (a: SnapshotAnomaly): number =>
    a.severity === 'alta' ? 0 : a.severity === 'media' ? 1 : 2;

  const ordinate = [...candidate].sort((a, b) => {
    const m = materiale(b) - materiale(a);
    if (m !== 0) return m;
    const p = peso(a) - peso(b);
    if (p !== 0) return p;
    return hash(`${opts.giorno}:${a.id}`) - hash(`${opts.giorno}:${b.id}`);
  });

  const scelta = ordinate[0]!;
  return {
    anomalia: scelta,
    motivo: `materiale ${materiale(scelta)}, gravità ${scelta.severity}, ${candidate.length} candidate non ancora raccontate`,
  };
}

/** Hash deterministico a 32 bit (FNV-1a). */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
