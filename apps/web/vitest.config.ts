import { defineConfig } from 'vitest/config';

/**
 * Vitest qui non esegue nulla, ed è voluto.
 *
 * Le verifiche del sito girano in un browser vero con Playwright (`pnpm e2e`):
 * accessibilità, tastiera, contrasto e assenza di JavaScript non si misurano in
 * jsdom. Senza questa configurazione, però, `pnpm run test` proverebbe a
 * eseguire i file `.spec.ts` di Playwright come test di Vitest e fallirebbe per
 * un motivo che non c'entra niente con il sito.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
