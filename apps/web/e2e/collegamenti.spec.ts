import { expect, test } from '@playwright/test';
import { percorsiDaVerificare } from './percorsi';

/**
 * Nessun collegamento del sito porta a una pagina che non c'è.
 *
 * Questo file nasce da nove 404 trovati in produzione — otto nel grafo attorno
 * alla norma, uno nella pagina Dati — che nessun test vedeva. Non erano
 * indirizzi sbagliati a mano: erano link **costruiti dal codice**, e quindi
 * sempre presenti, sempre plausibili e sempre rotti.
 *
 * Il controllo attraversa le pagine di ogni famiglia e chiede lo stato di ogni
 * `href` interno che ci trova. È volutamente stupido: non sa cosa sia un ECLI
 * né un URN, guarda solo se la pagina risponde. Un test che sapesse come sono
 * fatti gli indirizzi avrebbe lo stesso errore del codice che li costruisce.
 */

/** Gli indirizzi già chiesti, per non chiedere la home duecento volte. */
const visti = new Map<string, number>();

async function stato(
  richiedi: (u: string) => Promise<{ status(): number }>,
  url: string,
): Promise<number> {
  const gia = visti.get(url);
  if (gia !== undefined) return gia;
  const r = await richiedi(url);
  visti.set(url, r.status());
  return r.status();
}

test.describe('collegamenti', () => {
  for (const percorso of percorsiDaVerificare()) {
    test(`nessun collegamento rotto su ${percorso.nome}`, async ({ page, baseURL }) => {
      await page.goto(percorso.url);

      const href = await page.locator('a[href]').evaluateAll((elementi) =>
        elementi
          .map((e) => e.getAttribute('href') ?? '')
          // Solo i collegamenti interni: quelli verso l'esterno dipendono da
          // siti che non controlliamo, e un loro disservizio non è un difetto
          // di questo sito.
          .filter((h) => h.startsWith('/') && !h.startsWith('//')),
      );

      const rotti: string[] = [];
      for (const h of [...new Set(href)]) {
        const s = await stato((u) => page.request.get(u, { maxRedirects: 5 }), `${baseURL}${h}`);
        if (s !== 200) rotti.push(`${h} → ${s}`);
      }

      expect(rotti, `collegamenti rotti su ${percorso.url}`).toEqual([]);
    });
  }
});
