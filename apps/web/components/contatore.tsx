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
 * L'etichetta dice **termini scaduti**, non «provvedimenti mai adottati». Non è
 * prudenza: è la ragione per cui questa cifra si può citare. Ogni giorno che
 * conta corrisponde a una data scritta in una legge, e chi la riprende può
 * risalire fino a quella data. Se il decreto è poi arrivato con cinque anni di
 * ritardo, quei cinque anni li conta lo stesso — il ritardo è reale, il buco
 * no. «Provvedimenti mai adottati» sarebbe un titolo migliore e un'affermazione
 * che non regge alla prima verifica.
 *
 * La riga che dice cosa misura sta accanto al numero, non in fondo alla pagina:
 * è la parte che rende la cifra utilizzabile da un giornalista.
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
        <strong>Cosa misura, esattamente:</strong> termini scaduti, contati riga per riga sui
        mandati con una scadenza scritta nel testo — non attuazioni mancate. È il motivo per cui
        questa cifra si può citare: ogni giorno che conta corrisponde a una data che sta in una
        legge. {contatore.caveat} Calcolato al {data(contatore.computedAt)}.
        {contatore.verified > 0
          ? ` Verifica in Gazzetta Ufficiale completata su ${numero(contatore.verified)} di questi mandati, uno per uno: per ${numero(contatore.adottatiInRitardo)} il decreto è arrivato dopo la scadenza, per ${numero(contatore.nonAdottati)} non risulta pubblicato.`
          : ' Su nessuno di questi atti la verifica in Gazzetta Ufficiale è già stata fatta: per questo nessuna singola mancata attuazione è pubblicata come segnalazione.'}
      </p>
    </div>
  );
}
