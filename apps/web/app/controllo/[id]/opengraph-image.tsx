import { ImageResponse } from 'next/og';
import { CHECK_DEFINITIONS } from '@leggichenontornano/engine';
import { cornice, DIMENSIONE, FONTE_NORMATTIVA, OG, TIPO_IMMAGINE } from '@/lib/og';
import { dataset } from '@/lib/dataset';
import { numero, percentuale } from '@/lib/testo';

/*
 * L'anteprima della pagina di un controllo.
 *
 * Quello che va fatto vedere qui non è quante segnalazioni ha prodotto, ma
 * **quanto è preciso**: è la pagina che serve a chi deve decidere se fidarsi di
 * una regola, e la precisione è l'unica cosa che risponde a quella domanda.
 *
 * Quando la precisione non è ancora misurata non si scrive una percentuale
 * inventata né uno zero: si dice che la misura non c'è. Un'anteprima viaggia
 * senza la sua pagina, ed è il posto in cui una cifra non sostenuta fa più
 * danni.
 */

export const alt = 'Cosa cerca questo controllo, e quanto è preciso';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export function generateStaticParams() {
  return CHECK_DEFINITIONS.map((c) => ({ id: c.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const controllo = CHECK_DEFINITIONS.find((c) => c.id === id);
  const metrica = dataset().metric(id);

  if (!controllo) {
    return new ImageResponse(
      cornice({
        occhiello: 'Un controllo',
        accento: OG.verderame,
        titolo: 'Cosa cerca questa regola, su quante norme gira e quanto è precisa.',
        fonte: FONTE_NORMATTIVA,
      }),
      size,
    );
  }

  const precisione = metrica?.precision;
  /* La descrizione comincia con la maiuscola perché altrove è una frase a sé.
     Qui segue i due punti dopo l'etichetta, e una maiuscola lì in mezzo si
     legge come un errore di battitura. */
  const descrizione =
    controllo.description.charAt(0).toLowerCase() + controllo.description.slice(1);

  return new ImageResponse(
    cornice({
      occhiello: `Controllo di livello ${controllo.level}`,
      accento: precisione === null || precisione === undefined ? OG.ocra : OG.verderame,
      ...(precisione === null || precisione === undefined
        ? {
            titolo: `${controllo.label}: ${descrizione}`,
            nota: 'Precisione non ancora misurata: servono le revisioni umane prima di poterla dichiarare.',
          }
        : {
            cifra: percentuale(precisione),
            unita: 'di precisione',
            titolo: `${controllo.label}: ${descrizione}`,
            nota: `Misurata su ${numero(metrica?.reviewed ?? 0)} revisioni umane.`,
          }),
      fonte: FONTE_NORMATTIVA,
    }),
    size,
  );
}
