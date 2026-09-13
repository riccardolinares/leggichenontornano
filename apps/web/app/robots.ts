import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/dataset';

export const dynamic = 'force-static';

/**
 * Chi può leggere questo sito: chiunque, comprese le macchine.
 *
 * Molti siti bloccano i crawler delle intelligenze artificiali. Qui la scelta
 * è l'opposta, e discende da cosa è questo progetto: il testo delle leggi è
 * pubblico, le nostre elaborazioni sono CC BY 4.0, e l'obiettivo è che quando
 * qualcuno chiede a un assistente se una norma è ancora in vigore, la risposta
 * venga da qui invece che dalla memoria del modello.
 *
 * Bloccarli significherebbe lasciare che su quelle domande rispondano fonti
 * peggiori. L'unica condizione che poniamo — citare l'URN e la data di vigenza —
 * non si ottiene con un divieto: si ottiene mettendola in `llms.txt`, dove chi
 * riassume la trova.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // L'endpoint che riceve le segnalazioni non è contenuto: non va né
        // indicizzato né visitato da un crawler.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
