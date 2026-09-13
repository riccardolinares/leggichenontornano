import type { SnapshotCounter } from '@antinomia/corpus';
import { data, numero } from '@/lib/testo';

/**
 * Il contatore nazionale.
 *
 * Deve essere deterministico, crescente e con un **referente concreto**: «giorni
 * di ritardo accumulati dai provvedimenti attuativi previsti e non ancora
 * adottati» è una frase che si può verificare riga per riga. Un «indice di
 * disfunzione normativa» normalizzato su base cento sarebbe più bello e non
 * vorrebbe dire niente.
 *
 * La riga sul limite sta accanto al numero, non in fondo alla pagina: è la parte
 * che distingue una misura da un titolo.
 */
export function ContatoreNazionale({ contatore }: { contatore: SnapshotCounter }) {
  return (
    <div className="contatore">
      <p className="contatore__numero">{numero(contatore.totalDaysLate)}</p>
      <p className="contatore__etichetta">
        giorni di ritardo accumulati dai <strong>{numero(contatore.mandates)}</strong> provvedimenti
        attuativi previsti da <strong>{numero(contatore.acts)}</strong> atti del corpus e non ancora
        adottati.
      </p>
      <p className="contatore__limite">
        {contatore.caveat} Calcolato al {data(contatore.computedAt)}.
        {contatore.verified === 0
          ? ' Nessuno di questi atti ha ancora la verifica in Gazzetta Ufficiale: per questo il contatore esiste, ma nessuna singola mancata attuazione è pubblicata come segnalazione.'
          : ` Verifica in Gazzetta Ufficiale completata su ${numero(contatore.verified)} atti.`}
      </p>
    </div>
  );
}
