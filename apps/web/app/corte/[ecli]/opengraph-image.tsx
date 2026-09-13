import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, FONTE_CONSULTA, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { data, nomeNorma, numero, titoloPronuncia } from '@/lib/testo';

/*
 * L'anteprima di una decisione della Corte.
 *
 * Il numero che conta non è quello della sentenza — sta già nel titolo — ma
 * quante norme ha abbattuto. Quando è una sola, il numero non aggiunge niente
 * e al suo posto va il nome dell'atto colpito, che dice molto di più.
 */

export const alt = 'Anteprima della pronuncia';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export function generateStaticParams() {
  return dataset()
    .pronunce()
    .map((p) => ({ ecli: encodeURIComponent(p.ecli) }));
}

export default async function Image({ params }: { params: Promise<{ ecli: string }> }) {
  const { ecli } = await params;
  const decoded = decodeURIComponent(ecli);
  const reader = dataset();
  const pronuncia = reader.pronuncia(decoded);

  if (!pronuncia) {
    return new ImageResponse(
      cornice({
        occhiello: 'Corte costituzionale',
        accento: OG.verderame,
        titolo: 'Questa decisione non è nel dataset.',
        fonte: FONTE_CONSULTA,
      }),
      size,
    );
  }

  const colpite = reader.attiColpitiDa(decoded);
  const unSoloAtto = colpite.length === 1 && colpite[0];

  return new ImageResponse(
    cornice({
      occhiello: `Corte costituzionale · ${titoloPronuncia(pronuncia)}`,
      accento: OG.ossido,
      ...(colpite.length > 1 ? { cifra: numero(colpite.length), unita: 'atti' } : {}),
      titolo: unSoloAtto
        ? `Ha dichiarato illegittime norme del ${nomeNorma(unSoloAtto.act.urn).toLowerCase()}.`
        : colpite.length > 1
          ? 'colpiti da questa decisione: le norme dichiarate illegittime è come se non fossero mai esistite.'
          : 'Dichiarazione di illegittimità costituzionale.',
      nota: pronuncia.dataDeposito ? `Depositata il ${data(pronuncia.dataDeposito)}` : undefined,
      fonte: FONTE_CONSULTA,
    }),
    size,
  );
}
