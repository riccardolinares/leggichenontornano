import Link from 'next/link';
import { SegnalaProblema } from '@/components/segnala-problema';
import { EMAIL, REPO_URL } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';

/*
 * La pagina della segnalazione.
 *
 * Esiste perché il modulo abbia un indirizzo proprio da mettere nel piede e da
 * mandare a qualcuno («scrivilo qui»). Il modulo compare anche in fondo alle
 * pagine dove serve, ma un modulo senza una pagina sua non si può linkare.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'Qualcosa non torna?',
  descrizione:
    'Segnala un dato che sembra sbagliato, una pagina che non funziona o una frase che non si capisce. Diventa una segnalazione pubblica, e non serve un account.',
  percorso: '/segnala',
});

export default function Segnala() {
  return (
    <div className="contenitore stretto">
      <h1>Qualcosa non torna?</h1>
      <p className="apertura">
        Aiutaci a migliorare il sito. Se un dato ti sembra sbagliato, una pagina non funziona o una
        frase non si capisce, scrivilo qui: diventa una segnalazione pubblica, e non serve avere un
        account da nessuna parte.
      </p>

      <p className="riga-corpus">
        Vale anche — anzi soprattutto — per le segnalazioni giuridiche. Se una scheda dice che due
        norme non tornano e secondo te tornano benissimo, quella risposta cambia la precisione
        misurata del controllo che l’ha prodotta, e può toglierlo dal sito.{' '}
        <Link href="/dati">Come funziona la misura</Link>.
      </p>

      <SegnalaProblema repoUrl={REPO_URL} />

      <section className="sezione" aria-labelledby="altrimenti">
        <h2 id="altrimenti" className="sezione__titolo">
          Se preferisci un altro modo
        </h2>
        <p>
          Una mail a <a href={`mailto:${EMAIL}`}>{EMAIL}</a> arriva nello stesso posto ed è quella
          giusta quando la cosa è delicata e non vuoi lasciarla pubblica. Se hai un account GitHub,{' '}
          <a href={`${REPO_URL}/issues/new`}>aprire una issue direttamente</a> è più rapido per
          tutti.
        </p>
      </section>
    </div>
  );
}
