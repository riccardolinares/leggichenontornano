import { ImageResponse } from 'next/og';
import { accentoGravita, cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { colpoDiSegnalazione } from '@/lib/colpo';
import { dataset } from '@/lib/dataset';
import { nomeNorma, urnAtto } from '@/lib/testo';

/*
 * L'anteprima di una segnalazione.
 *
 * È la feature con il rapporto impatto/sforzo più alto del progetto: decide se
 * una segnalazione esce dal sito o ci resta dentro.
 *
 * Non mostra il titolo, che è lungo e pieno di riferimenti normativi: mostra
 * **il numero di quella norma** — da quanti anni quel rinvio punta a un testo
 * cancellato — e la frase che dice di cosa è il numero. Chi scorre una chat
 * legge «10 anni» e capisce; il titolo lo leggerà dopo, nella pagina.
 *
 * Quando quel numero non esiste (segnalazione senza finestra temporale, o
 * troppo recente perché il numero aggiunga qualcosa) si torna all'anteprima
 * generica con il titolo. È la stessa cornice, senza cifra: un'immagine
 * corretta in meno vale di una a effetto che dice una cosa non vera.
 */

export const alt = 'Anteprima della segnalazione';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export function generateStaticParams() {
  return dataset()
    .publishedAnomalies()
    .map((a) => ({ id: a.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reader = dataset();
  const anomalia = reader.anomaly(decodeURIComponent(id));

  if (!anomalia) {
    return new ImageResponse(
      cornice({
        occhiello: 'Le leggi che non tornano',
        accento: OG.verderame,
        titolo:
          'Incongruenze, contraddizioni e aree grigie della legislazione italiana, con le prove e la regola che le ha trovate.',
      }),
      size,
    );
  }

  const accento = accentoGravita(anomalia.severity);
  const conosciutoAl = reader.data.manifest?.knownAt ?? anomalia.computedAt;
  const colpo = colpoDiSegnalazione(anomalia, conosciutoAl);
  const primoUrn = anomalia.urns[0];
  const atto = primoUrn ? nomeNorma(urnAtto(primoUrn)) : undefined;

  return new ImageResponse(
    cornice({
      occhiello: 'Segnalazione',
      accento,
      ...(colpo
        ? { cifra: colpo.cifra, unita: colpo.unita, titolo: colpo.frase }
        : { titolo: anomalia.title }),
      ...(atto ? { nota: atto } : {}),
    }),
    size,
  );
}
