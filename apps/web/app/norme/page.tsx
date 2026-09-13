import Link from 'next/link';
import { dataset } from '@/lib/dataset';
import { bloccoDatiStrutturati, datiStrutturatiElenco, metadatiPagina } from '@/lib/seo';
import { Tabella } from '@/components/tabella';
import { GraficoBarre } from '@/components/grafico-barre';
import { data, nomeNorma, numero, percorsoNorma } from '@/lib/testo';

/*
 * L'indice delle norme del corpus.
 *
 * Il lettore norma esiste da sempre, ma ci si arrivava solo da una
 * segnalazione: un atto senza incongruenze rilevate era nel sito e
 * irraggiungibile. Questa pagina è il punto da cui si vede tutto quello che
 * abbiamo ingerito, compreso quello su cui i controlli non hanno segnalato
 * nulla: un atto pulito è un'informazione quanto uno che non torna.
 *
 * Ordinate per numero di segnalazioni e poi per data: chi arriva qui cerca o la
 * norma che conosce, o quella messa peggio.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Le norme del corpus',
  descrizione:
    'Tutti gli atti ingeriti, con le versioni, le segnalazioni che li riguardano e lo stato di vigenza. Il testo di ciascuno si legge a qualunque data.',
  percorso: '/norme',
});

export default function Norme() {
  const reader = dataset();
  const pubblicate = reader.publishedAnomalies();

  const perAtto = new Map<string, number>();
  for (const a of pubblicate) {
    for (const urn of new Set(a.urns.map((u) => u.split('~')[0]!))) {
      perAtto.set(urn, (perAtto.get(urn) ?? 0) + 1);
    }
  }

  const atti = [...reader.data.acts].sort((a, b) => {
    const differenza = (perAtto.get(b.urn) ?? 0) - (perAtto.get(a.urn) ?? 0);
    if (differenza !== 0) return differenza;
    return (b.publicationDate ?? '') < (a.publicationDate ?? '') ? -1 : 1;
  });

  const conSegnalazioni = atti.filter((a) => (perAtto.get(a.urn) ?? 0) > 0).length;

  /* Gli atti riscritti più volte.
     In una tabella di centosessantun righe ordinate per segnalazioni, il
     numero di versioni è una colonna che nessuno somma con l'occhio: per
     accorgersi che un regolamento è stato riscritto settantadue volte bisogna
     ordinare la tabella, e questa tabella non si ordina. Dieci barre lo dicono
     subito, e dicono anche l'altra metà della cosa — che dopo il primo c'è un
     salto, e che i codici riscritti così non sono molti. */
  const riscritti = [...reader.data.acts]
    .filter((a) => a.versionCount > 1)
    .sort((a, b) => b.versionCount - a.versionCount)
    .slice(0, 10);

  return (
    <div className="contenitore">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiElenco({
            titolo: 'Le norme del corpus',
            descrizione: 'Tutti gli atti ingeriti, con versioni, segnalazioni e stato di vigenza.',
            percorso: '/norme',
            quanti: atti.length,
          }),
        )}
      />
      <h1>Le norme del corpus</h1>
      <p className="apertura">
        {numero(atti.length)} atti ingeriti, di cui {numero(conSegnalazioni)} coinvolti in almeno
        una segnalazione pubblicata. Di ciascuno si può leggere il testo a qualunque data di
        vigenza, e confrontare due versioni.
      </p>

      <p className="riga-corpus">
        <strong>Questo è il corpus su cui lavoriamo oggi</strong>, e si allarga a ogni ingestione:
        ogni atto che entra porta con sé le sue relazioni, e fa scattare i controlli anche sugli
        atti che c’erano già. Se cercate una norma che qui non c’è,{' '}
        <Link href="/segnala">ditecelo</Link> — è il modo più rapido per farla entrare.{' '}
        <Link href="/dati">Cosa copre il dataset</Link>.
      </p>

      {riscritti.length > 0 ? (
        <section className="sezione" aria-labelledby="riscritti">
          <h2 id="riscritti" className="sezione__titolo">
            Gli atti riscritti più volte
          </h2>
          <p>
            Una versione è il testo dell’atto come risultava fra due modifiche. Più ce ne sono, più
            è difficile sapere cosa prescrivesse l’atto in una certa data: non è un difetto — un
            regolamento tecnico si aggiorna, e deve — è il contesto in cui le incongruenze nascono.
          </p>
          <GraficoBarre
            barre={riscritti.map((a) => ({
              etichetta: nomeNorma(a.urn),
              valore: a.versionCount,
              valoreTesto: `${numero(a.versionCount)} versioni`,
              href: percorsoNorma(a.urn),
              /* Neutro e non ossido: l'ossido dice «cifra che allarma», e
                 queste non allarmano. Un colore che significa due cose non
                 significa niente. */
              tono: 'neutro',
            }))}
            descrizione={`I ${numero(riscritti.length)} atti del corpus riscritti più volte`}
            didascalia="Gli atti del corpus riscritti più volte, dal più riscritto in giù. Di ciascuno si legge il testo a qualunque data di vigenza."
            colonne={{ etichetta: 'Atto', valore: 'Versioni' }}
          />
        </section>
      ) : null}

      <section className="sezione" aria-labelledby="tutti">
        <h2 id="tutti" className="sezione__titolo">
          Tutti gli atti
        </h2>
        <Tabella didascalia="Gli atti del corpus, con versioni, segnalazioni e stato di vigenza.">
          <thead>
            <tr>
              <th scope="col">Atto</th>
              <th scope="col">Pubblicazione</th>
              <th scope="col">Versioni</th>
              <th scope="col">Segnalazioni</th>
              <th scope="col">Stato</th>
            </tr>
          </thead>
          <tbody>
            {atti.map((a) => (
              <tr key={a.urn}>
                <th scope="row">
                  <Link href={percorsoNorma(a.urn)}>{nomeNorma(a.urn)}</Link>
                </th>
                <td>{a.publicationDate ? data(a.publicationDate) : '—'}</td>
                <td>{numero(a.versionCount)}</td>
                <td>{numero(perAtto.get(a.urn) ?? 0)}</td>
                <td>
                  {a.abrogated
                    ? `Abrogato${a.abrogatedFrom ? ` dal ${data(a.abrogatedFrom)}` : ''}`
                    : 'In vigore'}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      </section>
    </div>
  );
}
