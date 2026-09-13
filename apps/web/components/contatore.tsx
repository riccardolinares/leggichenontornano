import type { SnapshotCounter } from '@leggichenontornano/corpus';
import { data, numero } from '@/lib/testo';

/**
 * Il contatore nazionale.
 *
 * Deve essere deterministico, crescente e con un **referente concreto**: una
 * frase che si possa verificare riga per riga. Un «indice di disfunzione
 * normativa» normalizzato su base cento sarebbe più bello e non vorrebbe dire
 * niente.
 *
 * L'etichetta dice **termini scaduti**, non «provvedimenti mai adottati». La
 * seconda formulazione è più efficace e non la possiamo sostenere: sappiamo che
 * un termine di legge è passato, non sappiamo ancora se il provvedimento sia
 * arrivato dopo. Fra un titolo migliore e un'affermazione vera, su una legge,
 * non c'è partita.
 *
 * La riga sul limite sta accanto al numero, non in fondo alla pagina: è la parte
 * che distingue una misura da un titolo.
 */
export function ContatoreNazionale({ contatore }: { contatore: SnapshotCounter }) {
  return (
    <div className="contatore">
      <p className="contatore__numero">{numero(contatore.totalDaysLate)}</p>
      <p className="contatore__etichetta">
        giorni trascorsi dalla scadenza dei termini fissati per{' '}
        <strong>{numero(contatore.mandates)}</strong> provvedimenti attuativi previsti da{' '}
        <strong>{numero(contatore.acts)}</strong> atti del corpus.
      </p>
      <p className="contatore__limite">
        {contatore.caveat} Calcolato al {data(contatore.computedAt)}.
        {contatore.verified === 0
          ? ' Nessuno di questi atti ha ancora la verifica in Gazzetta Ufficiale: per questo il contatore misura termini scaduti e non attuazioni mancate, e nessuna singola mancata attuazione è pubblicata come segnalazione.'
          : ` Verifica in Gazzetta Ufficiale completata su ${numero(contatore.verified)} atti.`}
      </p>
    </div>
  );
}
