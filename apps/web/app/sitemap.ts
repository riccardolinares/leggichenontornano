import type { MetadataRoute } from 'next';
import { SITE_URL, dataset } from '@/lib/dataset';

export const dynamic = 'force-static';

/**
 * Gli URL sono il prodotto (ADR 0008): la sitemap elenca quelli stabili, cioè
 * le pagine fisse e le schede delle segnalazioni pubblicate. Le pagine del
 * lettore norma sono centinaia di migliaia e non vanno in sitemap: si
 * raggiungono dalle schede, che sono la cosa che qualcuno cita.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const reader = dataset();
  const ora = new Date();
  const fisse = ['', '/come-funziona', '/dati', '/stampa'].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: ora,
    changeFrequency: 'daily' as const,
    priority: p === '' ? 1 : 0.6,
  }));
  const anomalie = reader.publishedAnomalies().map((a) => ({
    url: `${SITE_URL}/anomalia/${encodeURIComponent(a.id)}`,
    lastModified: new Date(a.computedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));
  return [...fisse, ...anomalie];
}
