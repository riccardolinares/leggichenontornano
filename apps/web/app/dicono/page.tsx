import Link from 'next/link';
import { EMAIL, REPO_URL, SOSTIENI_URL } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import { ETICHETTA_FONTE, testimonianze } from '@/lib/testimonianze';
import { data } from '@/lib/testo';

/*
 * Il muro delle testimonianze.
 *
 * Con una regola che decide tutto il resto: **nessuna di queste frasi la
 * scriviamo noi**, e ognuna porta il collegamento al posto dove è stata
 * scritta. Un sito che chiede ai lettori di verificare ogni affermazione e poi
 * mette in vetrina elogi non verificabili si toglie da solo la faccia con cui
 * lo chiede.
 *
 * Finché non ce ne sono, la pagina dice che non ce ne sono. È meno bello e
 * costa niente; l'alternativa — tre citazioni generiche attribuite a «un
 * funzionario pubblico» — costa tutto.
 *
 * I video sono collegamenti, mai riquadri incorporati: un embed carica codice
 * di terze parti su una pagina che dice quali leggi una persona sta leggendo
 * (DESIGN.md, regola 5).
 */

export const dynamic = 'force-static';

const voci = testimonianze();

export const metadata = metadatiPagina({
  titolo: 'Dicono di noi',
  descrizione:
    'Chi usa questo progetto e cosa ne ha scritto in pubblico, con il collegamento a dove l’ha scritto.',
  percorso: '/dicono',
  // Una pagina vuota non va negli indici: prometterebbe un contenuto che non c'è.
  nonIndicizzare: voci.length === 0,
});

export default function Dicono() {
  return (
    <div className="contenitore stretto">
      <h1>Dicono di noi</h1>
      <p className="apertura">
        Quello che altri hanno scritto in pubblico su questo progetto, con il collegamento a dove
        l’hanno scritto. Nessuna di queste frasi l’abbiamo scritta noi, e nessuna sta qui senza il
        posto in cui andarla a leggere.
      </p>

      {voci.length === 0 ? (
        <div className="niente-segnale">
          <h2>Ancora nessuna</h2>
          <p>
            Il progetto è appena online e non ha ancora raccolto testimonianze pubbliche. Questa
            pagina resta vuota finché non ce ne sono di vere: mettere tre citazioni generiche
            attribuite a «un funzionario pubblico» costerebbe molto più di quanto renderebbe.
          </p>
          <p>
            Se il progetto vi è servito per qualcosa — una verifica prima di scrivere un pezzo, un
            rinvio che non tornava, una norma che credevate in vigore — scrivetelo dove vi pare e{' '}
            <a href={`mailto:${EMAIL}`}>mandateci il link</a>. Anche una critica: se regge, sta qui
            uguale.
          </p>
        </div>
      ) : (
        <ul className="muro">
          {voci.map((t) => (
            <li key={`${t.autore}-${t.testo.slice(0, 24)}`} className="muro__voce">
              <blockquote className="muro__testo">{t.testo}</blockquote>
              <p className="muro__firma">
                <strong>{t.autore}</strong>
                {t.ruolo ? <span>, {t.ruolo}</span> : null}
                {' — '}
                {t.url ? (
                  <a href={t.url} rel="noopener">
                    {ETICHETTA_FONTE[t.fonte]}
                  </a>
                ) : (
                  <span>{ETICHETTA_FONTE[t.fonte]}</span>
                )}
                {t.data ? <span>, {data(t.data)}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="sezione" aria-labelledby="sostieni">
        <h2 id="sostieni" className="sezione__titolo">
          Se volete che continui
        </h2>
        <p>
          Il progetto non ha pubblicità, non ha abbonamenti e non rivende i dati di chi legge. I
          costi sono quelli veri di una cosa che gira tutti i giorni: il dominio, l’hosting, le
          chiamate a un modello per le estrazioni.
        </p>
        <p className="azioni">
          <a className="bottone bottone--primario" href={SOSTIENI_URL}>
            Offri un caffè al progetto
          </a>
          <a className="bottone" href={`${REPO_URL}/issues/new`}>
            Segnala un errore
          </a>
          <Link className="bottone" href="/mcp">
            Usalo nel tuo assistente
          </Link>
        </p>
      </section>
    </div>
  );
}
