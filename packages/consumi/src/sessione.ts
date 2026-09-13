/**
 * Leggere i token da un file di sessione di un assistente.
 *
 * Sta in un modulo suo e non dentro la CLI per una ragione sola: è l'unico
 * pezzo di quel comando che vale la pena provare, e un modulo che all'import
 * esegue un comando non si può importare in un test.
 */

export interface SommaToken {
  ingresso: number;
  uscita: number;
  cacheScrittura: number;
  cacheLettura: number;
}

/**
 * Somma i token di un file di sessione, per modello.
 *
 * I formati di trascrizione cambiano, ed è il motivo per cui la lettura è
 * **per struttura e non per formato**: si cerca, ovunque si trovi dentro la
 * riga, un oggetto `usage` con accanto il nome di un modello. Legare questa
 * funzione al percorso esatto di un formato — `message.usage` — significa che
 * il giorno che quel percorso cambia il comando smette di trovare niente e non
 * lo dice, il che per un contributore vuol dire che il proprio lavoro sparisce
 * dal registro in silenzio.
 *
 * Una riga senza conteggi viene saltata: in una trascrizione la maggior parte
 * delle righe non è una chiamata al modello, e fermarsi alla prima sarebbe un
 * errore in condizioni normali.
 */
export function tokenDaSessione(contenuto: string): Map<string, SommaToken> {
  const per = new Map<string, SommaToken>();

  const visita = (nodo: unknown, modelloEreditato: string | null): void => {
    if (nodo === null || typeof nodo !== 'object') return;
    if (Array.isArray(nodo)) {
      for (const v of nodo) visita(v, modelloEreditato);
      return;
    }
    const oggetto = nodo as Record<string, unknown>;
    const modello = typeof oggetto['model'] === 'string' ? oggetto['model'] : modelloEreditato;
    const uso = oggetto['usage'];
    if (uso !== null && typeof uso === 'object' && modello) {
      const u = uso as Record<string, unknown>;
      const quanti = (chiave: string): number => {
        const v = u[chiave];
        return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
      };
      const somma = per.get(modello) ?? {
        ingresso: 0,
        uscita: 0,
        cacheScrittura: 0,
        cacheLettura: 0,
      };
      somma.ingresso += quanti('input_tokens');
      somma.uscita += quanti('output_tokens');
      somma.cacheScrittura += quanti('cache_creation_input_tokens');
      somma.cacheLettura += quanti('cache_read_input_tokens');
      per.set(modello, somma);
      return;
    }
    for (const v of Object.values(oggetto)) visita(v, modello);
  };

  for (const linea of contenuto.split('\n')) {
    if (linea.trim().length === 0) continue;
    try {
      visita(JSON.parse(linea), null);
    } catch {
      continue;
    }
  }
  return per;
}
