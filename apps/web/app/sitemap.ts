import type { MetadataRoute } from 'next';
import { CHECK_DEFINITIONS } from '@leggichenontornano/engine';
import { SITE_URL, dataset } from '@/lib/dataset';
import { articoli } from '@/lib/blog';
import { testimonianze } from '@/lib/testimonianze';
import { percorsoPronuncia } from '@/lib/testo';

export const dynamic = 'force-static';

/**
 * Gli URL sono il prodotto (ADR 0008): la sitemap elenca quelli stabili.
 *
 * Il criterio non è «tutto quello che il sito sa servire» ma «tutto quello che
 * qualcuno potrebbe voler citare». Il lettore norma sa servire l'intero corpus
 * — centinaia di migliaia di combinazioni di atto e data — e riversarle qui
 * prometterebbe una profondità che il resto del sito non ha: della norma
 * entrano solo gli atti coinvolti in una segnalazione pubblicata.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const reader = dataset();
  const ora = new Date();
  const fisse = [
    '',
    '/segnalazioni',
    '/blog',
    '/numeri',
    '/norme',
    '/corte',
    '/come-funziona',
    '/dati',
    '/stampa',
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: ora,
    changeFrequency: 'daily' as const,
    priority: p === '' ? 1 : 0.7,
  }));

  /* «Dicono di noi» entra in sitemap solo quando ha davvero delle
     testimonianze: una pagina vuota indicizzata promette un contenuto che non
     c'è, e la promessa la paga chi ci arriva da una ricerca. */
  const dicono =
    testimonianze().length > 0
      ? [
          {
            url: `${SITE_URL}/dicono`,
            lastModified: ora,
            changeFrequency: 'monthly' as const,
            priority: 0.5,
          },
        ]
      : [];

  const anomalie = reader.publishedAnomalies().map((a) => ({
    url: `${SITE_URL}/anomalia/${encodeURIComponent(a.id)}`,
    lastModified: new Date(a.computedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  /* Una pagina per controllo: sono poche e sono quelle che qualcuno cerca
     prima di sapere che questo sito esiste («rinvio a norma abrogata»). Ci
     vanno tutti i controlli che hanno prodotto qualcosa, anche quelli le cui
     segnalazioni non pubblichiamo: la pagina dice comunque cosa cerca la
     regola e perché il suo esito resta in coda. */
  const controlli = CHECK_DEFINITIONS.filter((c) => (reader.metric(c.id)?.found ?? 0) > 0).map(
    (c) => ({
      url: `${SITE_URL}/controllo/${c.id}`,
      lastModified: ora,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }),
  );

  /* Le decisioni della Corte: si cercano per numero, e sono un centinaio al
     massimo. A differenza del lettore norma, qui l'elenco completo ci sta.
     L'indirizzo lo costruisce `percorsoPronuncia` e non questa riga: quando la
     sitemap si scriveva l'URL da sola, ha continuato a pubblicare per mesi
     cinquantacinque indirizzi che rispondevano 404. */
  const tuttePronunce = reader.pronunce();
  const pronunce = tuttePronunce.map((p) => ({
    url: `${SITE_URL}${percorsoPronuncia(p, tuttePronunce)}`,
    lastModified: p.dataDeposito ? new Date(p.dataDeposito) : ora,
    changeFrequency: 'yearly' as const,
    priority: 0.6,
  }));

  /* Gli atti coinvolti in una segnalazione pubblicata, e solo quelli: il
     lettore norma copre l'intero corpus, ma una sitemap che elenca ogni atto
     ingerito promette profondità che il resto del sito non ha. */
  const attiCitati = new Set<string>();
  for (const a of reader.publishedAnomalies()) {
    for (const urn of a.urns) attiCitati.add(urn.split('~')[0]!);
  }
  const norme = [...attiCitati].map((urn) => ({
    url: `${SITE_URL}/norma/${encodeURIComponent(urn)}`,
    lastModified: ora,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  /* Gli approfondimenti: sono pochi, crescono di uno al giorno, e sono
     esattamente il tipo di pagina che qualcuno cerca per parole sue («codice
     appalti abrogato rinvio») invece che per numero di legge. */
  const approfondimenti = articoli().map((a) => ({
    url: `${SITE_URL}/blog/${a.slug}`,
    lastModified: new Date(`${a.data}T00:00:00Z`),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    ...fisse,
    ...dicono,
    ...approfondimenti,
    ...anomalie,
    ...controlli,
    ...pronunce,
    ...norme,
  ];
}
