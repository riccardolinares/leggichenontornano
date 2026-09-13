/**
 * Quale segnalazione pubblicare oggi.
 *
 * Una al giorno, e la costanza batte il picco: un account che pubblica una cosa
 * verificabile ogni giorno per sei mesi diventa una fonte che i giornalisti
 * seguono; un account che pubblica trenta cose in un giorno e poi tace diventa
 * rumore.
 *
 * La selezione è **deterministica sulla data**: due esecuzioni nello stesso
 * giorno scelgono la stessa segnalazione, e un'esecuzione fallita si può
 * ripetere senza pubblicare due volte cose diverse.
 */
import type { SnapshotAnomaly, SnapshotReader } from '@antinomia/corpus';

export interface Selezione {
  anomalia: SnapshotAnomaly;
  /** Perché è stata scelta questa, in una riga, per il log. */
  motivo: string;
}

export interface OpzioniSelezione {
  /** Data di riferimento, formato ISO. */
  giorno: string;
  /** Identificatori già pubblicati: non si ripete una segnalazione. */
  giaPubblicate?: ReadonlySet<string>;
}

/**
 * Sceglie la segnalazione del giorno.
 *
 * Criteri, in ordine: mai pubblicata prima, gravità alta prima di media, e a
 * parità di tutto il resto un ordine pseudocasuale ancorato alla data. La
 * gravità pesa perché la prima segnalazione che qualcuno vede non deve essere
 * la più marginale, ma non domina: dopo qualche settimana una coda di sole
 * segnalazioni gravi si esaurisce e restano solo quelle che nessuno ha scelto.
 */
export function selezionaDelGiorno(
  reader: SnapshotReader,
  opts: OpzioniSelezione,
): Selezione | null {
  const giaPubblicate = opts.giaPubblicate ?? new Set<string>();
  const candidate = reader.publishedAnomalies().filter((a) => !giaPubblicate.has(a.id));
  if (candidate.length === 0) return null;

  const peso = (a: SnapshotAnomaly): number =>
    a.severity === 'alta' ? 0 : a.severity === 'media' ? 1 : 2;

  const ordinate = [...candidate].sort((a, b) => {
    const p = peso(a) - peso(b);
    if (p !== 0) return p;
    return hash(`${opts.giorno}:${a.id}`) - hash(`${opts.giorno}:${b.id}`);
  });

  const scelta = ordinate[0]!;
  return {
    anomalia: scelta,
    motivo: `gravità ${scelta.severity}, ${candidate.length} candidate non ancora pubblicate`,
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
