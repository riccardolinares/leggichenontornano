import { expect, test } from '@playwright/test';
import { percorsiDaVerificare } from './percorsi';

/**
 * Ogni pagina manda davvero l'anteprima che promette.
 *
 * Il sito dichiara `twitter:card = summary_large_image` su **tutte** le pagine,
 * dal layout. È una promessa: chi incolla il link si aspetta un'immagine
 * grande. Sei famiglie di pagine — norme, pronunce, segnala, mappa, dicono e i
 * controlli — la facevano senza avere nessuna immagine, e la cosa non si vede
 * guardando il sito: si vede quando qualcuno incolla il link in una chat e non
 * compare niente, cioè quando è tardi.
 *
 * Il test scarica l'immagine e la **misura**. Controllare che il tag ci sia non
 * basta: un `og:image` che punta a un 404 è esattamente il caso che si stava
 * verificando in produzione.
 */

/** Larghezza e altezza dall'intestazione IHDR, senza librerie. */
function misuraPng(dati: Buffer): { larghezza: number; altezza: number } | null {
  if (dati.length < 24 || dati.readUInt32BE(0) !== 0x89504e47) return null;
  return { larghezza: dati.readUInt32BE(16), altezza: dati.readUInt32BE(20) };
}

/**
 * Il contenuto di un `meta`, e `null` se quel `meta` non c'è.
 *
 * Si legge dal DOM già caricato invece che con `locator().getAttribute()`,
 * che di fronte a un elemento assente **aspetta** — è pensato per una pagina
 * che si sta ancora costruendo, e qui la pagina è ferma da un pezzo.
 *
 * La differenza si è vista in fabbrica: cinque pagine senza `og:image` hanno
 * trasformato un guasto da dichiarare in tre quarti d'ora di attesa, due
 * tentativi di riprova per pagina e nessuna riga che dicesse cosa mancava. Un
 * controllo che non sa fallire in fretta si legge come un guasto degli
 * strumenti, e manda a cercare nel posto sbagliato.
 */
async function contenuto(page: import('@playwright/test').Page, nome: string) {
  return page.evaluate((n) => {
    const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
    return el?.getAttribute('content') ?? null;
  }, nome);
}

test.describe('anteprime social', () => {
  for (const percorso of percorsiDaVerificare()) {
    // La pagina «non trovata» non si condivide, e non deve promettere niente.
    if (percorso.url.includes('percorso-che-non-esiste')) continue;

    test(`l’anteprima di ${percorso.nome} esiste ed è un’immagine vera`, async ({ page }) => {
      await page.goto(percorso.url);

      expect(await contenuto(page, 'og:title'), 'manca og:title').toBeTruthy();
      expect(await contenuto(page, 'og:description'), 'manca og:description').toBeTruthy();

      const immagine = await contenuto(page, 'og:image');
      expect(immagine, `${percorso.url} dichiara summary_large_image senza og:image`).toBeTruthy();
      // Deve essere assoluta: i crawler non hanno una pagina da cui risolvere
      // un percorso relativo.
      expect(immagine, 'og:image non è assoluta').toMatch(/^https?:\/\//);

      /* L'indirizzo è assoluto e punta al dominio pubblico anche quando i test
         girano in locale: si riporta al server in prova, altrimenti questo
         controllo misurerebbe la produzione invece di quello che si sta per
         pubblicare. */
      const qui = new URL(page.url());
      const locale = new URL(immagine!);
      locale.protocol = qui.protocol;
      locale.host = qui.host;

      const risposta = await page.request.get(locale.href);
      expect(risposta.status(), `l’anteprima di ${percorso.url} risponde male`).toBe(200);
      expect(risposta.headers()['content-type']).toContain('image/');

      const misura = misuraPng(await risposta.body());
      expect(misura, 'l’anteprima non è un PNG leggibile').not.toBeNull();
      // 1200×630 è la misura che tutte le piattaforme ritagliano senza tagliare
      // le parole: sotto, l'immagine viene ingrandita e si sgrana.
      expect(`${misura!.larghezza}x${misura!.altezza}`).toBe('1200x630');
    });
  }
});
