import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest qui esegue poco, ed è voluto.
 *
 * Le verifiche del sito girano in un browser vero con Playwright (`pnpm e2e`):
 * accessibilità, tastiera, contrasto e assenza di JavaScript non si misurano in
 * jsdom. Restano a Vitest le poche cose che un browser non aggiunge niente a
 * verificare — una rotta che risponde, un file CSS che dice due volte la stessa
 * cosa — e l'esclusione degli `.spec.ts`, che altrimenti Vitest proverebbe a
 * eseguire come test suoi fallendo per un motivo che non c'entra col sito.
 */
export default defineConfig({
  // L'alias è lo stesso di `tsconfig.json`: senza, un test che importa una
  // rotta fallisce sul primo `@/lib/...`, cioè su codice che compila e gira.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
