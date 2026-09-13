import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { percorsiDaVerificare } from './percorsi';

/**
 * Audit di accessibilità con axe-core.
 *
 * «Accessibilità WCAG obbligatoria» non è un proposito: è un test che fallisce.
 * Per un progetto civico con utenti potenziali nella pubblica amministrazione
 * una violazione di livello AA è un difetto come un altro, e va trattata come
 * tale — cioè bloccando la build, non aprendo una issue.
 *
 * Nessuna regola è disattivata. Se una violazione è un falso positivo, va
 * documentata qui con il motivo, non silenziata di nascosto.
 */

const TAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function analizza(page: Page) {
  return new AxeBuilder({ page }).withTags(TAG).analyze();
}

for (const percorso of percorsiDaVerificare()) {
  test(`nessuna violazione WCAG 2.1 AA su ${percorso.nome}`, async ({ page }) => {
    await page.goto(percorso.url);
    const risultato = await analizza(page);

    // Il messaggio d'errore deve dire *cosa* è rotto e *dove*: un conteggio non
    // aiuta nessuno a sistemarlo.
    const dettaglio = risultato.violations
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join('\n    ')}`,
      )
      .join('\n');
    expect(dettaglio, `Violazioni su ${percorso.url}:\n${dettaglio}`).toBe('');
  });
}

test('il contrasto regge anche in tema scuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const risultato = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
  const contrasto = risultato.violations.filter((v) => v.id === 'color-contrast');
  expect(contrasto.map((v) => v.nodes.map((n) => n.target.join(' ')).join(', ')).join('\n')).toBe(
    '',
  );
});

test('il foglio di stile è davvero applicato', async ({ page }) => {
  // Una pagina senza CSS supera quasi tutti i controlli di accessibilità e non
  // assomiglia al sito: senza questa verifica una regressione nel caricamento
  // degli stili passerebbe inosservata fino a uno screenshot.
  await page.goto('/');
  const sfondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(sfondo).not.toBe('rgba(0, 0, 0, 0)');
  expect(sfondo).not.toBe('rgb(255, 255, 255)');
  const carattere = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(carattere.toLowerCase()).toContain('archivo');
});

test('la pagina dichiara la lingua italiana', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

test('esiste un collegamento per saltare al contenuto, ed è il primo a ricevere il fuoco', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const attivo = page.locator(':focus');
  await expect(attivo).toHaveText(/vai al contenuto/i);
  await attivo.press('Enter');
  await expect(page.locator('#contenuto')).toBeVisible();
});

test('la gerarchia dei titoli non salta livelli', async ({ page }) => {
  for (const percorso of percorsiDaVerificare()) {
    await page.goto(percorso.url);
    const livelli = await page.$$eval('h1, h2, h3, h4, h5, h6', (nodi) =>
      nodi.map((n) => Number(n.tagName.slice(1))),
    );
    expect(livelli[0], `${percorso.url}: la pagina deve iniziare con un h1`).toBe(1);
    expect(livelli.filter((l) => l === 1).length, `${percorso.url}: deve esserci un solo h1`).toBe(
      1,
    );
    for (let i = 1; i < livelli.length; i++) {
      expect(
        livelli[i]! - livelli[i - 1]!,
        `${percorso.url}: salto da h${livelli[i - 1]} a h${livelli[i]}`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test('ogni tabella ha una didascalia e intestazioni di riga o colonna', async ({ page }) => {
  for (const percorso of percorsiDaVerificare()) {
    await page.goto(percorso.url);
    const tabelle = await page.$$eval('table', (nodi) =>
      nodi.map((t) => ({
        caption: t.querySelector('caption')?.textContent?.trim() ?? '',
        th: t.querySelectorAll('th').length,
      })),
    );
    for (const t of tabelle) {
      expect(t.caption.length, `${percorso.url}: tabella senza <caption>`).toBeGreaterThan(10);
      expect(t.th, `${percorso.url}: tabella senza <th>`).toBeGreaterThan(0);
    }
  }
});

test('ogni elemento interattivo è raggiungibile da tastiera e mostra il fuoco', async ({
  page,
}) => {
  await page.goto('/come-funziona');
  const interattivi = await page
    .locator('a[href], button, summary, [tabindex]:not([tabindex="-1"])')
    .count();
  expect(interattivi).toBeGreaterThan(5);

  // Si percorre la pagina con Tab e si verifica che il fuoco sia sempre visibile.
  for (let i = 0; i < Math.min(interattivi, 25); i++) {
    await page.keyboard.press('Tab');
    const contorno = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const stile = getComputedStyle(el);
      return { outlineWidth: stile.outlineWidth, outlineStyle: stile.outlineStyle };
    });
    if (!contorno) continue;
    expect(
      contorno.outlineStyle !== 'none' && parseFloat(contorno.outlineWidth) > 0,
      `elemento senza indicatore di fuoco visibile al passo ${i}`,
    ).toBe(true);
  }
});
