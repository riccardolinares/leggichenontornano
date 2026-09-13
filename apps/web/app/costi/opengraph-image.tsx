import { ImageResponse } from 'next/og';
import { VALUTA } from '@leggichenontornano/consumi';
import { cornice, DIMENSIONE, OG, TIPO_IMMAGINE } from '@/lib/og';
import { riepilogoConsumi } from '@/lib/consumi';
import { denaro, numero } from '@/lib/testo';

/*
 * L'anteprima della pagina dei costi.
 *
 * Quando il registro ha righe, la cifra è quella: quanto è costato finora.
 * Quando non ne ha, l'anteprima **non mette uno zero**. Uno zero grande in
 * un'anteprima che viaggia da sola verrebbe letto come «non costa niente», che
 * è la sola cosa falsa che questa pagina potrebbe dire — e sarebbe letta da
 * chi non aprirà mai la pagina in cui la cautela è scritta.
 *
 * Le distanze fra la cifra e la sua unità sono margini espliciti dentro
 * `cornice`: su una riga allineata alla linea di base il motore che disegna
 * queste immagini ignora il `gap`.
 */

export const alt = 'Quanto costa il progetto «Le leggi che non tornano», e chi lo tiene in piedi';
export const size = DIMENSIONE;
export const contentType = TIPO_IMMAGINE;

export default function Image() {
  const r = riepilogoConsumi();

  if (r.righe > 0 && r.totali.costo > 0) {
    return new ImageResponse(
      cornice({
        occhiello: 'Costi e contributori',
        accento: OG.ocra,
        cifra: denaro(r.totali.costo, VALUTA),
        titolo: `di modelli linguistici, su ${numero(r.totali.chiamate)} chiamate registrate una per una. Nessuna pubblicità, nessun abbonamento.`,
        nota: 'Costo stimato dal listino pubblico, non una fattura.',
      }),
      size,
    );
  }

  return new ImageResponse(
    cornice({
      occhiello: 'Costi e contributori',
      accento: OG.ocra,
      titolo:
        'Quanto costa far girare questo progetto, chi ci ha lavorato, e le tre strade per dare una mano.',
      nota: 'Il registro dei consumi è appena nato: la pagina dice cosa non sa ancora.',
    }),
    size,
  );
}
