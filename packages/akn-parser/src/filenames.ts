/**
 * I nomi dei file dentro le collezioni di Normattiva portano metadati che non
 * sono ripetuti altrove in forma altrettanto comoda:
 *
 *   1963-02-01_063C0001_ORIGINALE_V0.xml
 *   1963-02-01_063C0001_VIGENZA_2013-03-03_V12.xml
 *
 * cioè: data di pubblicazione in Gazzetta, codice redazionale, tipo di versione,
 * data di inizio vigenza (solo per le versioni consolidate) e progressivo.
 */
export interface VersionFileName {
  publicationDate: string;
  editorialCode: string;
  kind: 'originale' | 'vigenza';
  /** Data di inizio vigenza; per `originale` coincide con la pubblicazione. */
  inForceFrom: string;
  ordinal: number;
}

const RE =
  /^(\d{4}-\d{2}-\d{2})_([A-Za-z0-9]+)_(?:(ORIGINALE)|VIGENZA_(\d{4}-\d{2}-\d{2}))_V(\d+)\.xml$/i;

export function parseVersionFileName(name: string): VersionFileName | null {
  const base = name.split('/').pop() ?? name;
  const m = RE.exec(base);
  if (!m) return null;
  const [, pub, code, originale, vigenza, ordinal] = m;
  return {
    publicationDate: pub!,
    editorialCode: code!,
    kind: originale ? 'originale' : 'vigenza',
    inForceFrom: originale ? pub! : vigenza!,
    ordinal: Number(ordinal),
  };
}
