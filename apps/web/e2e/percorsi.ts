import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * I percorsi da verificare.
 *
 * Le pagine fisse ci sono sempre; la scheda di una segnalazione e il lettore
 * norma esistono solo se il dataset contiene qualcosa. I test si adattano al
 * dataset invece di presupporlo, così `pnpm e2e` funziona su un clone appena
 * fatto come sulla pipeline completa.
 */
export interface Percorso {
  nome: string;
  url: string;
}

const SNAPSHOT =
  process.env['LCNT_SNAPSHOT'] ?? join(process.cwd(), '..', '..', 'data', 'snapshot');

function jsonl<T>(file: string): T[] {
  const path = join(SNAPSHOT, file);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

export function primaAnomalia(): { id: string; urns: string[] } | null {
  const anomalie = jsonl<{ id: string; urns: string[]; published: boolean }>('anomalies.jsonl');
  return anomalie.find((a) => a.published) ?? null;
}

/**
 * Una norma di cui il dataset contiene davvero il testo.
 *
 * Prendere il primo atto dell'elenco non basta: il dataset ridotto ha un tetto
 * agli articoli esportati, e un atto senza testo farebbe saltare i test invece
 * di verificare il lettore. Si sceglie quello con più articoli, che è anche il
 * caso più interessante da guardare.
 */
export function primaNorma(): string | null {
  const articoli = jsonl<{ actUrn: string }>('articles.jsonl');
  const conteggio = new Map<string, number>();
  for (const a of articoli) conteggio.set(a.actUrn, (conteggio.get(a.actUrn) ?? 0) + 1);
  const ordinati = [...conteggio.entries()].sort((a, b) => b[1] - a[1]);
  return ordinati[0]?.[0] ?? jsonl<{ urn: string }>('acts.jsonl')[0]?.urn ?? null;
}

/** Una norma con almeno due versioni: serve a provare la modalità confronto. */
export function normaConPiuVersioni(): string | null {
  const versioni = jsonl<{ actUrn: string }>('versions.jsonl');
  const articoli = jsonl<{ actUrn: string }>('articles.jsonl');
  const conTesto = new Set(articoli.map((a) => a.actUrn));
  const conteggio = new Map<string, number>();
  for (const v of versioni) {
    if (!conTesto.has(v.actUrn)) continue;
    conteggio.set(v.actUrn, (conteggio.get(v.actUrn) ?? 0) + 1);
  }
  const ordinati = [...conteggio.entries()].sort((a, b) => b[1] - a[1]);
  const primo = ordinati[0];
  return primo && primo[1] > 1 ? primo[0] : null;
}

/**
 * Una norma colpita da una dichiarazione di illegittimità costituzionale.
 *
 * La sua pagina ha una sezione che le altre non hanno — citazioni, elenco di
 * definizioni, collegamenti esterni — e senza un percorso dedicato l'audit di
 * accessibilità non la vedrebbe mai.
 */
export function normaConPronuncia(): string | null {
  const relazioni = jsonl<{ type: string; targetUrn: string }>('relations.jsonl');
  const articoli = jsonl<{ actUrn: string }>('articles.jsonl');
  const conTesto = new Set(articoli.map((a) => a.actUrn));
  const colpita = relazioni.find(
    (r) => r.type === 'DICHIARA_ILLEGITTIMO' && conTesto.has(r.targetUrn),
  );
  return colpita?.targetUrn ?? null;
}

/** Un controllo che ha davvero prodotto qualcosa: la sua pagina non è vuota. */
export function primoControlloConEsito(): string | null {
  const anomalie = jsonl<{ checkId: string; published: boolean }>('anomalies.jsonl');
  return anomalie.find((a) => a.published)?.checkId ?? anomalie[0]?.checkId ?? null;
}

/** Una pronuncia presente nel dataset, per la pagina della singola decisione. */
export function primaPronuncia(): string | null {
  return jsonl<{ ecli: string }>('pronunce.jsonl')[0]?.ecli ?? null;
}

/** Uno degli articoli del blog, se ce n'è: la pagina ha una forma sua. */
export function primoApprofondimento(): string | null {
  const cartella = process.env['LCNT_BLOG'] ?? join(process.cwd(), '..', '..', 'data', 'blog');
  if (!existsSync(cartella)) return null;
  const file = readdirSync(cartella)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .at(-1);
  return file ? file.replace(/\.json$/, '') : null;
}

export function percorsiDaVerificare(): Percorso[] {
  const percorsi: Percorso[] = [
    { nome: 'home', url: '/' },
    { nome: 'indice delle segnalazioni', url: '/segnalazioni' },
    { nome: 'indice del blog', url: '/blog' },
    { nome: 'numeri', url: '/numeri' },
    { nome: 'grafo delle leggi', url: '/grafo' },
    { nome: 'elenco delle norme', url: '/norme' },
    { nome: 'elenco delle pronunce', url: '/corte' },
    { nome: 'assistente', url: '/assistente' },
    { nome: 'come funziona', url: '/come-funziona' },
    { nome: 'dati', url: '/dati' },
    { nome: 'stampa', url: '/stampa' },
    { nome: 'dicono di noi', url: '/dicono' },
    { nome: 'segnala un problema', url: '/segnala' },
    { nome: 'mappa del sito', url: '/mappa' },
    { nome: 'pagina non trovata', url: '/percorso-che-non-esiste' },
  ];

  /* Le pagine generate una per controllo e una per pronuncia hanno una forma
     loro — tabelle, citazioni lunghe, elenchi annidati — e senza un percorso
     dedicato l'audit non le guarderebbe mai. */
  const controllo = primoControlloConEsito();
  if (controllo) {
    percorsi.push({ nome: 'pagina di un controllo', url: `/controllo/${controllo}` });
  }

  const approfondimento = primoApprofondimento();
  if (approfondimento) {
    percorsi.push({ nome: 'approfondimento', url: `/blog/${approfondimento}` });
  }

  const pronuncia = primaPronuncia();
  if (pronuncia) {
    percorsi.push({
      nome: 'pagina di una pronuncia',
      url: `/corte/${encodeURIComponent(pronuncia)}`,
    });
  }

  const anomalia = primaAnomalia();
  if (anomalia) {
    percorsi.push({
      nome: 'scheda anomalia',
      url: `/anomalia/${encodeURIComponent(anomalia.id)}`,
    });
  }

  const norma = primaNorma();
  if (norma) {
    percorsi.push({ nome: 'lettore norma', url: `/norma/${encodeURIComponent(norma)}` });
  }

  const colpita = normaConPronuncia();
  if (colpita && colpita !== norma) {
    percorsi.push({
      nome: 'norma con pronuncia della Consulta',
      url: `/norma/${encodeURIComponent(colpita)}`,
    });
  }

  return percorsi;
}
