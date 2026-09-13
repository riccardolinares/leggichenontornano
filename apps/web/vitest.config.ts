import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest qui prova le funzioni pure e le rotte, e nient'altro.
 *
 * Le verifiche del sito girano in un browser vero con Playwright (`pnpm e2e`):
 * accessibilità, tastiera, contrasto e assenza di JavaScript non si misurano in
 * jsdom. Quello che resta a Vitest sono le poche cose che un browser non
 * aggiunge niente a verificare — costruire un indirizzo e risolverlo, una
 * rotta che risponde, un file CSS che dice due volte la stessa cosa — dove un
 * test in millisecondi vale quanto un giro di browser.
 *
 * L'esclusione degli `.spec.ts` serve comunque: senza, `pnpm run test`
 * proverebbe a eseguire i file di Playwright come test di Vitest e fallirebbe
 * per un motivo che non c'entra niente con il sito.
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
