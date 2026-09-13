import type { SnapshotAnalisiAssistita } from '@leggichenontornano/corpus';

/**
 * Il blocco che mostra un confronto fatto da un modello.
 *
 * Ha un aspetto diverso da tutto il resto della scheda, ed è voluto. Ovunque
 * altrove quello che si legge è un campo del dataset o un testo di legge citato
 * alla lettera; qui è il ragionamento di un modello, e il lettore deve poterlo
 * distinguere **senza leggere**, dal colore e dalla forma.
 *
 * Dentro ci sono tre cose, in quest'ordine: che cosa l'ha prodotto, quanto
 * dichiara di esserne sicuro, e le porzioni letterali dei due testi su cui la
 * conclusione poggia — già verificate dal codice contro i testi originali, che
 * è la ragione per cui il blocco può esistere.
 */

const PAROLE_CONFIDENZA: Record<string, string> = {
  alta: 'Il contrasto si legge nei due testi',
  media: 'Il contrasto dipende in parte da come si leggono i testi',
  bassa: 'Il contrasto dipende da come si interpreta un termine',
};

export function AnalisiAssistita({ analisi }: { analisi: SnapshotAnalisiAssistita }) {
  return (
    <section className="assistita" aria-labelledby="assistita-titolo">
      <h2 id="assistita-titolo" className="assistita__titolo">
        Questo confronto l’ha fatto un modello
      </h2>

      <p className="assistita__cosa">
        Le altre segnalazioni di questo sito nascono da un’interrogazione su date e relazioni:
        quello che dicono è un fatto registrato. Questa nasce da un modello linguistico a cui sono
        stati messi davanti due testi, scelti dal codice, con una domanda sola: un soggetto tenuto a
        rispettarle entrambe può farlo? Le porzioni che cita qui sotto sono state ricontrollate
        automaticamente contro i testi originali — se non ci fossero state, questa scheda non
        esisterebbe.
      </p>

      <p className={`assistita__confidenza assistita__confidenza--${analisi.confidenza}`}>
        <strong>Confidenza {analisi.confidenza}.</strong>{' '}
        {PAROLE_CONFIDENZA[analisi.confidenza] ?? ''}
      </p>

      <blockquote className="assistita__ragionamento">{analisi.ragionamento}</blockquote>

      <p className="assistita__modello">
        Prodotto da <code>{analisi.modello}</code>. La precisione di questo tipo di confronto è
        misurata a parte, e non eredita quella dei controlli deterministici.
      </p>
    </section>
  );
}
