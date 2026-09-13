import Link from 'next/link';
import { dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import { Tabella } from '@/components/tabella';
import { data, nomeNorma, numero, percorsoNorma } from '@/lib/testo';

/*
 * L'indice delle norme del corpus.
 *
 * Il lettore norma esiste da sempre, ma ci si arrivava solo da una
 * segnalazione: un atto senza incongruenze rilevate era nel sito e
 * irraggiungibile. Questa pagina è il punto da cui si vede tutto quello che
 * abbiamo ingerito — compreso, e soprattutto, quello su cui non abbiamo trovato
 * niente.
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

  return (
    <div className="contenitore">
      <h1>Le norme del corpus</h1>
      <p className="apertura">
        {numero(atti.length)} atti ingeriti, di cui {numero(conSegnalazioni)} coinvolti in almeno
        una segnalazione pubblicata. Di ciascuno si può leggere il testo a qualunque data di
        vigenza, e confrontare due versioni.
      </p>

      <p className="riga-corpus">
        <strong>Il corpus è parziale per costruzione.</strong> Contiene gli atti che abbiamo
        ingerito, non la legislazione italiana: una norma che non è in questo elenco non è per
        questo in ordine, semplicemente non l’abbiamo guardata.{' '}
        <Link href="/dati">Cosa copre il dataset</Link>.
      </p>

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
    </div>
  );
}
