import Link from 'next/link';
import { dataset } from '@/lib/dataset';
import { bloccoDatiStrutturati, datiStrutturatiElenco, metadatiPagina } from '@/lib/seo';
import { Tabella } from '@/components/tabella';
import { data, numero, percorsoPronuncia, titoloPronuncia } from '@/lib/testo';

/*
 * Le pronunce della Corte costituzionale che hanno colpito una norma del
 * corpus.
 *
 * Stanno in una sezione loro e non fra gli atti: una sentenza non è un atto
 * normativo, e metterla nell'elenco delle norme sarebbe l'errore concettuale
 * che il progetto passa il tempo a evitare.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Le pronunce della Corte costituzionale',
  descrizione:
    'Le dichiarazioni di illegittimità costituzionale che colpiscono le norme del corpus, con le parole della Corte e le norme colpite.',
  percorso: '/corte',
});

export default function Corte() {
  const reader = dataset();
  const pronunce = reader.pronunce();

  return (
    <div className="contenitore">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiElenco({
            titolo: 'Le pronunce della Corte costituzionale',
            descrizione:
              'Le dichiarazioni di illegittimità costituzionale che colpiscono le norme del corpus.',
            percorso: '/corte',
            quanti: pronunce.length,
          }),
        )}
      />
      <h1>Le pronunce della Corte costituzionale</h1>
      <p className="apertura">
        {numero(pronunce.length)} decision
        {pronunce.length === 1 ? 'e' : 'i'} che hanno dichiarato illegittima una norma presente nel
        corpus. Una dichiarazione di illegittimità non è un’abrogazione: la norma non smette di
        valere da oggi in avanti, è come se non fosse mai esistita, salvo i rapporti ormai esauriti.
      </p>

      <p className="riga-corpus">
        Fonte: <a href="https://www.cortecostituzionale.it">Corte costituzionale open data</a>,
        licenza CC BY-SA 3.0. Le norme colpite sono collegate agli atti tramite l’ECLI della
        decisione, e l’accordo con le note di aggiornamento di Normattiva è misurato sulla{' '}
        <Link href="/dati">pagina dei dati</Link>.
      </p>

      <Tabella didascalia="Le pronunce presenti nel dataset, dalla più recente.">
        <thead>
          <tr>
            <th scope="col">Decisione</th>
            <th scope="col">Deposito</th>
            <th scope="col">Norme colpite</th>
          </tr>
        </thead>
        <tbody>
          {pronunce.map((p) => {
            const colpite = reader.attiColpitiDa(p.ecli);
            return (
              <tr key={p.ecli}>
                <th scope="row">
                  <Link href={percorsoPronuncia(p.ecli)}>{titoloPronuncia(p)}</Link>
                </th>
                <td>{p.dataDeposito ? data(p.dataDeposito) : '—'}</td>
                <td>{numero(colpite.length)}</td>
              </tr>
            );
          })}
        </tbody>
      </Tabella>
    </div>
  );
}
