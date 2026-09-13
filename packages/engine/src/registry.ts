/**
 * Il registro dei controlli.
 *
 * Un solo posto in cui sapere quali controlli esistono, a che livello stanno e
 * con quale regola lavorano. L'API pubblica lo espone così com'è, e la pagina
 * «Come funziona» lo legge: la documentazione di cosa cerchiamo non è scritta a
 * mano da qualche parte, è questa lista.
 */
import { MODIFICA_AD_ATTO_ABROGATO } from './checks/level1/modifica-ad-atto-abrogato.js';
import { RINVIO_AD_ARTICOLO_INESISTENTE } from './checks/level1/rinvio-ad-articolo-inesistente.js';
import { RINVIO_AD_ATTO_ABROGATO } from './checks/level1/rinvio-ad-atto-abrogato.js';
import { ATTUAZIONE_MANCANTE } from './checks/level1/attuazione-mancante.js';
import { FONTE_SECONDARIA_SU_PRIMARIA } from './checks/level2/fonte-secondaria-su-primaria.js';
import { TERMINI_DIVERGENTI } from './checks/level3/termini-divergenti.js';
import { CONTRASTO_ASSISTITO_DEFINITION } from './checks/level4/contrasto-assistito.js';
import type { CheckDefinition } from './types.js';

export const CHECK_DEFINITIONS: readonly CheckDefinition[] = [
  MODIFICA_AD_ATTO_ABROGATO.definition,
  RINVIO_AD_ATTO_ABROGATO.definition,
  RINVIO_AD_ARTICOLO_INESISTENTE.definition,
  ATTUAZIONE_MANCANTE.definition,
  FONTE_SECONDARIA_SU_PRIMARIA.definition,
  TERMINI_DIVERGENTI.definition,
  CONTRASTO_ASSISTITO_DEFINITION,
];

export function checkById(id: string): CheckDefinition | null {
  return CHECK_DEFINITIONS.find((c) => c.id === id) ?? null;
}

export function checksByLevel(level: 1 | 2 | 3 | 4): CheckDefinition[] {
  return CHECK_DEFINITIONS.filter((c) => c.level === level);
}

export {
  MODIFICA_AD_ATTO_ABROGATO,
  RINVIO_AD_ATTO_ABROGATO,
  RINVIO_AD_ARTICOLO_INESISTENTE,
  ATTUAZIONE_MANCANTE,
  FONTE_SECONDARIA_SU_PRIMARIA,
  TERMINI_DIVERGENTI,
  CONTRASTO_ASSISTITO_DEFINITION,
};
