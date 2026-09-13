import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Chromium già presente nell'ambiente.
 *
 * Alcuni ambienti di esecuzione (container di CI, sandbox) hanno Chromium
 * installato in `PLAYWRIGHT_BROWSERS_PATH` con una revisione diversa da quella
 * che la versione di Playwright del progetto si aspetta. In quel caso Playwright
 * si rifiuta di partire e chiede di scaricare i browser, cosa che in un
 * ambiente senza rete non succede. Se troviamo un binario utilizzabile lo
 * usiamo, altrimenti si lascia decidere a Playwright.
 */
function chromiumDiSistema(): string | undefined {
  const base = process.env['PLAYWRIGHT_BROWSERS_PATH'];
  if (!base) return undefined;
  for (const candidato of [
    `${base}/chromium-1194/chrome-linux/chrome`,
    `${base}/chromium/chrome-linux/chrome`,
  ]) {
    if (existsSync(candidato)) return candidato;
  }
  return undefined;
}

const executablePath = chromiumDiSistema();

/**
 * Verifica end-to-end del sito.
 *
 * Si esegue sulla **build di produzione**, non sul server di sviluppo: gli
 * overlay di sviluppo di Next.js introducono elementi che non esistono nel sito
 * reale, e un audit di accessibilità che li include misura la cosa sbagliata.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env['ANTINOMIA_BASE_URL'] ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
    // Il sito deve funzionare su un telefono: è il dispositivo da cui arriva
    // chi riceve il link di una segnalazione su WhatsApp.
    {
      name: 'telefono',
      use: {
        ...devices['Pixel 5'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: process.env['ANTINOMIA_BASE_URL']
    ? undefined
    : {
        command: 'pnpm exec next start -p 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});
