import { ImageResponse } from 'next/og';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { data, nomeNorma, numero } from '@/lib/testo';

/*
 * L'anteprima del lettore norma.
 *
 * Il problema di un atto, qui, non è una singola incongruenza: è che il testo
 * è cambiato molte volte, o che è stato abrogato mentre qualcosa continua a
 * rinviarci. L'anteprima mostra quello dei due che c'è, e se non c'è nessuno
 * dei due mostra semplicemente il nome dell'atto — che è sempre corretto.
 */

export const alt = 'Anteprima della norma';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

/**
 * Gli stessi atti pregenerati dalla pagina.
 *
 * Senza questo elenco l'anteprima resta una rotta dinamica: funziona, ma la
 * prima richiesta la calcola al volo — e la prima richiesta è quasi sempre il
 * crawler di una chat, che aspetta poco e non ritenta.
 */
export function generateStaticParams() {
  const reader = dataset();
  const urns = new Set<string>();
  for (const a of reader.publishedAnomalies()) {
    for (const urn of a.urns) urns.add(urn.split('~')[0]!);
  }
  for (const act of reader.data.acts.slice(0, 30)) urns.add(act.urn);
  return [...urns].map((urn) => ({ urn: encodeURIComponent(urn) }));
}

export default async function Image({ params }: { params: Promise<{ urn: string }> }) {
  const { urn } = await params;
  const decoded = decodeURIComponent(urn);
  const reader = dataset();
  const act = reader.act(decoded);

  if (!act) {
    return new ImageResponse(
      cornice({
        occhiello: 'Le leggi che non tornano',
        accento: OG.verderame,
        titolo: 'Questa norma non è nel corpus ingerito.',
      }),
      size,
    );
  }

  const nome = nomeNorma(decoded);
  const versioni = reader.versions(decoded).length;

  if (act.abrogated) {
    /* Per un atto abrogato il numero che dice qualcosa non è quante
       segnalazioni lo nominano, ma **quanti atti ancora in vigore continuano a
       rinviarci**: si contano gli atti rinvianti delle segnalazioni in cui
       questo compare come bersaglio, non tutte quelle che lo citano. */
    const rinvianti = new Set(
      reader
        .anomaliesFor(decoded)
        .filter(
          (a) =>
            a.published &&
            a.checkId === 'rinvio-ad-atto-abrogato' &&
            a.urns[1] === decoded &&
            a.urns[0],
        )
        .map((a) => a.urns[0]!),
    ).size;

    return new ImageResponse(
      cornice({
        occhiello: 'Norma abrogata',
        accento: OG.ossido,
        ...(rinvianti > 0
          ? { cifra: numero(rinvianti), unita: rinvianti === 1 ? 'atto' : 'atti' }
          : {}),
        titolo:
          rinvianti > 0
            ? `ancora in vigore ${rinvianti === 1 ? 'rinvia' : 'rinviano'} a questo testo, che è stato cancellato dall’ordinamento.`
            : `Abrogato${act.abrogatedFrom ? ` dal ${data(act.abrogatedFrom)}` : ''}.`,
        nota: nome,
      }),
      size,
    );
  }

  return new ImageResponse(
    cornice({
      occhiello: 'Testo vigente',
      accento: OG.verderame,
      ...(versioni > 1 ? { cifra: numero(versioni), unita: 'versioni' } : {}),
      titolo:
        versioni > 1
          ? 'di questo atto, ciascuna con la data da cui è stata in vigore.'
          : 'Il testo dell’atto, con le date di vigenza di ogni versione.',
      nota: nome,
    }),
    size,
  );
}
