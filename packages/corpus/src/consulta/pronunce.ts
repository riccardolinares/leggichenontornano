/**
 * Le pronunce della Corte costituzionale, dagli open data ufficiali.
 *
 * Perché stanno qui. Una dichiarazione di illegittimità costituzionale è una
 * contraddizione **certificata dall'ordinamento**: non la troviamo noi, la
 * dichiara l'unico organo che può farlo. Serve a due cose diverse, e vale la
 * pena tenerle separate:
 *
 *  1. come **relazione del grafo** (`DICHIARA_ILLEGITTIMO`): una norma
 *     dichiarata illegittima non è abrogata, ma cessa di avere efficacia, e un
 *     rinvio a una norma caduta è un rinvio che non torna;
 *  2. come **gold standard**: sono annotazioni prodotte da magistrati per altri
 *     scopi, che è esattamente quello che serve per misurare, invece di
 *     giudicare noi il nostro stesso output.
 *
 * Quello che questo modulo **non** fa: non interpreta la pronuncia, non ne
 * riassume la motivazione, non decide se una questione fosse fondata. Legge il
 * dispositivo, cioè la parte in cui la Corte scrive cosa ha deciso, e ne estrae
 * gli estremi delle norme nominate. Il giudizio è della Corte; noi copiamo il
 * riferimento.
 *
 * Licenza dei dati: CC BY-SA 3.0, Corte costituzionale — `dati.cortecostituzionale.it`.
 */
import { unzipSync } from 'fflate';

/** Una pronuncia, come la pubblicano gli open data. */
export interface Pronuncia {
  /** Identificatore europeo della giurisprudenza, es. `ECLI:IT:COST:2016:1`. */
  ecli: string;
  numero: string;
  anno: string;
  /** `S` sentenza, `O` ordinanza. */
  tipologia: string;
  dataDecisione: string | null;
  dataDeposito: string | null;
  presidente: string | null;
  redattore: string | null;
  /** Il dispositivo: la parte in cui la Corte scrive cosa ha deciso. */
  dispositivo: string;
  /** L'epigrafe: quali norme erano impugnate e da chi. */
  epigrafe: string;
}

/**
 * Gli open data della Consulta sono in **CP1252**, non in UTF-8.
 *
 * Non è un dettaglio da nota a piè di pagina: decodificandoli come UTF-8 il
 * parser si ferma con un errore sul primo accento, e decodificandoli come
 * latin-1 le virgolette caporali diventano caratteri di controllo. Le
 * virgolette contano, perché nei dispositivi racchiudono il titolo dell'atto.
 */
export function decodeCp1252(bytes: Uint8Array): string {
  return new TextDecoder('windows-1252').decode(bytes);
}

/** Le date della Consulta sono `gg/mm/aaaa`. Le nostre sono ISO. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

/**
 * Ripulisce il testo dalle entità e dai ritorni a capo del sorgente.
 *
 * `&#13;` compare **letteralmente** nel JSON, non come entità da decodificare:
 * è un artefatto della conversione da XML, ed è a fine riga in quasi ogni
 * campo.
 */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&#13;?/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawPronuncia {
  ecli?: string;
  numero_pronuncia?: string;
  anno_pronuncia?: string;
  tipologia_pronuncia?: string;
  data_decisione?: string;
  data_deposito?: string;
  presidente?: string;
  redattore_pronuncia?: string;
  dispositivo?: string;
  epigrafe?: string;
}

/**
 * Legge l'archivio distribuito dalla Consulta.
 *
 * È uno zip di zip: l'archivio per periodo contiene un archivio per anno, che
 * contiene un JSON. Li apriamo tutti in memoria perché l'intero corpus dal 2001
 * sta in poche decine di megabyte una volta scompattato, e perché un file
 * temporaneo in più è un file temporaneo che qualcuno dimentica di cancellare.
 */
export function readPronunceArchive(zip: Uint8Array): Pronuncia[] {
  const out: Pronuncia[] = [];
  for (const [, inner] of Object.entries(unzipSync(zip))) {
    const interno = isZip(inner) ? unzipSync(inner) : { 'diretto.json': inner };
    for (const [nome, contenuto] of Object.entries(interno)) {
      if (!nome.toLowerCase().endsWith('.json')) continue;
      out.push(...parsePronunceJson(decodeCp1252(contenuto)));
    }
  }
  return out;
}

export function parsePronunceJson(text: string): Pronuncia[] {
  const parsed = JSON.parse(text) as { elenco_pronunce?: RawPronuncia[] } | RawPronuncia[];
  const righe = Array.isArray(parsed) ? parsed : (parsed.elenco_pronunce ?? []);
  return righe
    .filter((r) => typeof r.ecli === 'string' && r.ecli.length > 0)
    .map((r) => ({
      ecli: r.ecli!,
      numero: r.numero_pronuncia ?? '',
      anno: r.anno_pronuncia ?? '',
      tipologia: r.tipologia_pronuncia ?? '',
      dataDecisione: toIsoDate(r.data_decisione),
      dataDeposito: toIsoDate(r.data_deposito),
      presidente: r.presidente ?? null,
      redattore: r.redattore_pronuncia ?? null,
      dispositivo: normalizeText(r.dispositivo),
      epigrafe: normalizeText(r.epigrafe),
    }));
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** L'URL pubblico di una pronuncia, dal suo ECLI. */
export function consultaUrl(ecli: string): string {
  const parti = ecli.split(':');
  const anno = parti[4] ?? '';
  const numero = parti[5] ?? '';
  return `https://www.cortecostituzionale.it/actionSchedaPronuncia.do?anno=${anno}&numero=${numero}`;
}
