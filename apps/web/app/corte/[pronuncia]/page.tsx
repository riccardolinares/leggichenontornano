import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { dataset } from '@/lib/dataset';
import {
  bloccoDatiStrutturati,
  datiStrutturatiBriciole,
  datiStrutturatiDocumento,
  metadatiPagina,
} from '@/lib/seo';
import {
  data,
  nomeNorma,
  numero,
  percorsoNorma,
  percorsoPronuncia,
  pronunciaDaEcli,
  pronunciaDaSlug,
  slugPronuncia,
  titoloPronuncia,
} from '@/lib/testo';

/*
 * Una pagina per decisione.
 *
 * «Sentenza 251 del 2001» è una cosa che si cerca per numero, e chi la cerca
 * vuole due risposte: cosa ha deciso, e su cosa. La prima sta nel dispositivo,
 * che qui si riporta **alla lettera** e non riassunto: il senso di una
 * declaratoria sta in «nella parte in cui prevede…», e un riassunto quella
 * parte la perde sempre.
 *
 * L'indirizzo è lo slug — `/corte/sentenza-251-2001` — e non più l'ECLI, che
 * nessuno può leggere al telefono e che il routing statico non sapeva servire.
 * Questa pagina risponde anche ai vecchi indirizzi, reindirizzandoli: erano in
 * sitemap, e un URL pubblicato non si rompe due volte.
 */

interface Props {
  params: Promise<{ pronuncia: string }>;
}

export function generateStaticParams() {
  const tutte = dataset().pronunce();
  return tutte.map((p) => ({ pronuncia: slugPronuncia(p, tutte) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pronuncia: segmento } = await params;
  const reader = dataset();
  const tutte = reader.pronunce();
  const pronuncia = pronunciaDaSlug(segmento, tutte);
  /* Anche il vecchio indirizzo finisce qui, ed è giusto che non venga
     indicizzato: la pagina lo reindirizza, e l'indirizzo da indicizzare è
     quello nuovo. */
  if (!pronuncia) return { title: 'Pronuncia non trovata', robots: { index: false, follow: true } };

  const colpite = reader.attiColpitiDa(pronuncia.ecli);
  return metadatiPagina({
    titolo: titoloPronuncia(pronuncia),
    descrizione: `Dichiarazione di illegittimità costituzionale depositata il ${data(pronuncia.dataDeposito)}. ${
      colpite.length > 0
        ? `Colpisce ${colpite.map((c) => nomeNorma(c.act.urn)).join(', ')}.`
        : 'Nessuna norma del corpus risulta colpita.'
    }`,
    percorso: percorsoPronuncia(pronuncia, tutte),
    tipo: 'article',
  });
}

/** I passi distinti del dispositivo citati dagli archi di questa decisione. */
function citazioni(relazioni: Array<{ evidence: string | null }>): string[] {
  return [...new Set(relazioni.map((r) => r.evidence).filter((e): e is string => !!e))];
}

export default async function Pronuncia({ params }: Props) {
  const { pronuncia: segmento } = await params;
  const reader = dataset();
  const tutte = reader.pronunce();
  const pronuncia = pronunciaDaSlug(segmento, tutte);

  if (!pronuncia) {
    /* Prima di dire che non esiste: è uno dei vecchi indirizzi con l'ECLI?
       Stavano in sitemap e possono essere stati incollati in un atto, quindi
       vanno accompagnati al nuovo, non fatti morire su un 404. */
    const spostata = pronunciaDaEcli(segmento, tutte);
    if (spostata) permanentRedirect(percorsoPronuncia(spostata, tutte));
    notFound();
  }

  const colpite = reader.attiColpitiDa(pronuncia.ecli);

  return (
    <article className="contenitore">
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiDocumento({
            titolo: titoloPronuncia(pronuncia),
            descrizione: pronuncia.dispositivo.slice(0, 300),
            percorso: percorsoPronuncia(pronuncia, tutte),
            dataPubblicazione: pronuncia.dataDeposito,
            licenza: 'https://creativecommons.org/licenses/by-sa/3.0/it/',
          }),
        )}
      />
      <script
        {...bloccoDatiStrutturati(
          datiStrutturatiBriciole([
            { nome: 'Pronunce della Corte', percorso: '/corte' },
            { nome: titoloPronuncia(pronuncia), percorso: percorsoPronuncia(pronuncia, tutte) },
          ]),
        )}
      />
      <nav aria-label="Percorso" style={{ fontSize: '0.85rem', marginBottom: '1.2rem' }}>
        <Link href="/corte">Pronunce della Corte</Link> <span aria-hidden="true">›</span>{' '}
        <span>{titoloPronuncia(pronuncia)}</span>
      </nav>

      <h1>{titoloPronuncia(pronuncia)}</h1>
      <p className="apertura">
        Depositata il {data(pronuncia.dataDeposito)}.{' '}
        {colpite.length > 0
          ? `Ha colpito ${colpite.length === 1 ? 'un atto presente' : `${numero(colpite.length)} atti presenti`} nel corpus.`
          : 'Nessun atto del corpus risulta colpito da questa decisione.'}
      </p>

      {/* La distinzione che decide tutto il resto, e che va detta prima dei
          dettagli: illegittimità non è abrogazione. */}
      <p className="riga-corpus">
        <strong>Illegittimità non è abrogazione.</strong> Una norma abrogata smette di valere da una
        certa data in avanti; una norma dichiarata illegittima è come se non fosse mai esistita,
        salvo i rapporti ormai esauriti. È la differenza fra «da quando» e «mai».
      </p>

      <section className="sezione" aria-labelledby="dispositivo">
        <h2 id="dispositivo" className="sezione__titolo">
          Il dispositivo, con le parole della Corte
        </h2>
        <p style={{ fontSize: '0.92rem', color: 'var(--inchiostro-tenue)' }}>
          Riportato alla lettera: il senso di una declaratoria sta nel «nella parte in cui», e un
          riassunto quella parte la perde.
        </p>
        <blockquote className="prova">
          <p className="prova__etichetta">Dispositivo</p>
          <p className="prova__testo">{pronuncia.dispositivo}</p>
        </blockquote>
        {pronuncia.url ? (
          <p>
            <a href={pronuncia.url}>Il testo integrale sul sito della Corte costituzionale</a>
          </p>
        ) : null}
      </section>

      {colpite.length > 0 ? (
        <section className="sezione" aria-labelledby="colpite">
          <h2 id="colpite" className="sezione__titolo">
            Le norme colpite
          </h2>
          <ul className="elenco">
            {colpite.map(({ act, relazioni }) => (
              <li key={act.urn} className="scheda">
                <h3 className="scheda__titolo">
                  <Link href={percorsoNorma(act.urn)}>{nomeNorma(act.urn)}</Link>
                </h3>
                <p className="scheda__pratica">{act.title}</p>
                <p className="scheda__meta">
                  {relazioni.map((r) => (
                    <span key={r.id}>
                      {r.wholeAct
                        ? 'L’intero atto'
                        : `Art. ${r.targetArticle ?? '—'}${
                            r.targetParagraphs.length > 0
                              ? `, comm${r.targetParagraphs.length === 1 ? 'a' : 'i'} ${r.targetParagraphs.join(', ')}`
                              : ''
                          }`}
                    </span>
                  ))}
                </p>
                {/* La citazione una volta sola, non una per articolo: una
                    declaratoria che colpisce due articoli dello stesso atto
                    porta lo stesso identico passo su entrambi, e ripeterlo
                    riempie la pagina di testo uguale. */}
                {citazioni(relazioni).map((passo) => (
                  <blockquote key={passo} className="prova" style={{ margin: '0 0 0.6rem' }}>
                    <p className="prova__etichetta">Dal dispositivo</p>
                    <p className="prova__testo">{passo}</p>
                  </blockquote>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="attribuzione">
        Fonte della decisione: <a href="https://www.cortecostituzionale.it">Corte costituzionale</a>
        , open data con licenza{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/it/">CC BY-SA 3.0</a>. ECLI:{' '}
        <code>{pronuncia.ecli}</code>.
      </p>
    </article>
  );
}
