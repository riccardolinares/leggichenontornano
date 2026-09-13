import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE, accentoGravita } from '@/lib/og';
import { articolo, articoli } from '@/lib/blog';
import { colpoDiSegnalazione } from '@/lib/colpo';
import { dataset } from '@/lib/dataset';
import { data } from '@/lib/testo';

/*
 * L'anteprima di un approfondimento.
 *
 * Usa la **stessa cifra della scheda da cui l'articolo nasce**, non una cifra
 * ricavata dal testo dell'articolo. Il motivo è che il testo è prosa e la cifra
 * dev'essere un dato: se un giorno l'articolo scrivesse un numero diverso da
 * quello della scheda, l'anteprima continuerebbe a dire quello giusto — e la
 * verifica, a monte, non avrebbe fatto passare l'articolo.
 */

export const alt = 'Anteprima dell’approfondimento';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export function generateStaticParams() {
  return articoli().map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articolo(slug);

  if (!a) {
    return new ImageResponse(
      cornice({
        occhiello: 'Approfondimenti',
        accento: OG.verderame,
        titolo: 'Un approfondimento al giorno su una legge che non torna.',
      }),
      size,
    );
  }

  const reader = dataset();
  const segnalazione = reader.anomaly(a.anomaliaId);
  const conosciutoAl = reader.data.manifest?.knownAt ?? a.data;
  const colpo = segnalazione ? colpoDiSegnalazione(segnalazione, conosciutoAl) : null;

  return new ImageResponse(
    cornice({
      occhiello: `Approfondimento · ${data(a.data)}`,
      accento: segnalazione ? accentoGravita(segnalazione.severity) : OG.verderame,
      ...(colpo
        ? { cifra: colpo.cifra, unita: colpo.unita, titolo: colpo.frase, nota: a.titolo }
        : { titolo: a.titolo }),
    }),
    size,
  );
}
