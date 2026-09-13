import Link from 'next/link';
import { Condivisione } from '@/components/condivisione';
import { GrigliaCifre } from '@/components/griglia-cifre';
import { GraficoBarre } from '@/components/grafico-barre';
import { SITE_URL, dataset } from '@/lib/dataset';
import { metadatiPagina } from '@/lib/seo';
import {
  data,
  nomeNorma,
  numero,
  numeroDecimale,
  percorsoNorma,
  percorsoPronuncia,
  titoloPronuncia,
  urnAtto,
} from '@/lib/testo';

/*
 * I numeri che fanno notizia.
 *
 * Una pagina fatta per essere mandata a qualcuno. Il che pone subito il
 * problema che la rende difficile: un numero condiviso viaggia **senza la
 * pagina**, e quello che resta è la frase che ci sta attorno. Se quella frase
 * dice più di quanto il dato sostiene, l'errore non si corregge più — arriva in
 * una chat dove nessuno leggerà mai la nota a piè di pagina.
 *
 * Da qui la forma di ogni voce: la cifra, cosa misura, e **cosa non dice**, sul
 * posto e nello stesso corpo di testo. Non una nota, non un asterisco: una
 * riga accanto al numero, che chi copia il numero copia anche.
 *
 * E ogni cifra è calcolata qui dal dataset. Nessuna è scritta a mano: se il
 * corpus cambia, cambiano, ed è l'unico modo perché restino vere.
 */

export const dynamic = 'force-static';

export const metadata = metadatiPagina({
  titolo: 'I numeri',
  descrizione:
    'Le cifre più dure che il dataset sostiene: giorni di ritardo sui provvedimenti attuativi, atti in vigore che rinviano a leggi cancellate, e cosa ciascun numero non dice.',
  percorso: '/numeri',
});

interface Voce {
  cifra: string;
  unita: string;
  /** Cosa misura, in poche parole: è quello che compare nella griglia. */
  sintesi: string;
  frase: React.ReactNode;
  limite: React.ReactNode;
  /**
   * Il grafico, dove la cifra da sola nasconde la sua forma.
   *
   * Non ce l'hanno tutte le voci, e non deve averlo tutte: un grafico che
   * ripete il numero scritto sopra è decorazione. Sta qui solo dove la
   * distribuzione dice qualcosa che il totale non dice.
   */
  grafico?: React.ReactNode;
  ancora: string;
}

export default function Numeri() {
  const reader = dataset();
  const manifest = reader.data.manifest;
  const contatore = reader.counter();
  const pubblicate = reader.publishedAnomalies();
  const conosciutoAl = (manifest?.knownAt ?? new Date().toISOString()).slice(0, 10);

  /* Gli URN di una segnalazione possono portare una partizione (`~art3`): il
     tipo lo consente anche dove i dati attuali non lo fanno. Contarli così
     come sono conterebbe due volte lo stesso atto citato a due articoli, e
     produrrebbe collegamenti a `/norma/<urn~art3>` che il lettore non
     riconosce. Si normalizza sempre all'atto. */
  const rinvii = pubblicate.filter((a) => a.checkId === 'rinvio-ad-atto-abrogato');
  const attiRinvianti = new Set(
    rinvii.map((a) => (a.urns[0] ? urnAtto(a.urns[0]) : null)).filter((u): u is string => !!u),
  ).size;

  /* Il bersaglio più richiamato: una legge cancellata che decine di atti in
     vigore continuano a citare. È il numero che si capisce senza spiegazioni. */
  const perBersaglio = new Map<string, Set<string>>();
  for (const a of rinvii) {
    const bersaglio = a.urns[1] ? urnAtto(a.urns[1]) : null;
    const sorgente = a.urns[0] ? urnAtto(a.urns[0]) : null;
    if (!bersaglio || !sorgente) continue;
    const insieme = perBersaglio.get(bersaglio) ?? new Set<string>();
    insieme.add(sorgente);
    perBersaglio.set(bersaglio, insieme);
  }
  const [bersaglioPiuCitato] = [...perBersaglio.entries()].sort((a, b) => b[1].size - a[1].size);

  /* L'atto riscritto più volte. Non è un'incongruenza ed è per questo che sta
     qui: settantatré versioni dello stesso regolamento sono il contesto in cui
     le incongruenze nascono. */
  const piuVersioni = [...reader.data.acts].sort((a, b) => b.versionCount - a.versionCount)[0];

  const anniDaAbrogazione = (iso: string | null): number =>
    iso
      ? Math.floor(
          (Date.parse(`${conosciutoAl}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) /
            86_400_000 /
            365.25,
        )
      : 0;

  const pronunce = reader.pronunce();
  const alta = manifest?.concordanzaPronunce?.find((c) => c.confidence === 'alta');

  const voci: Voce[] = [];

  if (contatore && contatore.mandates > 0) {
    const anni = Math.round(contatore.totalDaysLate / 365.25);
    voci.push({
      cifra: numero(contatore.totalDaysLate),
      unita: 'giorni',
      frase: (
        <>
          di ritardo accumulati sui termini che la legge stessa si era data per{' '}
          <strong>{numero(contatore.mandates)} provvedimenti attuativi</strong>, previsti da{' '}
          {numero(contatore.acts)} atti del corpus. Sono <strong>{numero(anni)} anni</strong> messi
          in fila: in media {numeroDecimale(contatore.totalDaysLate / contatore.mandates / 365.25)}{' '}
          anni per ciascun adempimento.
        </>
      ),
      limite: (
        <>
          <strong>Cosa non dice:</strong> che quei provvedimenti non siano mai stati adottati. Il
          conteggio parte dalla scadenza del termine: se il decreto è poi arrivato con cinque anni
          di ritardo, quei cinque anni li conta lo stesso, ma il provvedimento c’è. Misura{' '}
          <em>termini scaduti</em>, non attuazioni mancate.{' '}
          {contatore.verified > 0 ? (
            <>
              Su <strong>{numero(contatore.verified)}</strong> di questi mandati siamo andati a
              guardare in Gazzetta Ufficiale, uno per uno: per {numero(contatore.adottatiInRitardo)}{' '}
              il decreto è arrivato dopo la scadenza, per {numero(contatore.nonAdottati)} non
              risulta pubblicato. Sugli altri non lo sappiamo, e solo i mandati verificati possono
              diventare una segnalazione.
            </>
          ) : (
            <>
              La verifica in Gazzetta Ufficiale non l’abbiamo ancora fatta, ed è il motivo per cui
              nessuna singola mancata attuazione è pubblicata come segnalazione.
            </>
          )}
        </>
      ),
      sintesi: 'di ritardo sui termini dei provvedimenti attuativi',
      ancora: 'ritardo',
    });
  }

  if (attiRinvianti > 0) {
    const piuVecchio = rinvii.reduce((max, a) => Math.max(max, anniDaAbrogazione(a.windowFrom)), 0);

    /* «Cento atti rinviano a una norma cancellata» non dice la cosa più
       importante: che le norme cancellate sono pochissime. Il grafico la
       mostra in un colpo d'occhio — quasi tutto il fenomeno sta in due decreti
       sugli appalti, e un lettore che ne applica uno si riconosce subito. Una
       distribuzione per anni direbbe meno: con due soli bersagli sarebbero due
       colonne isolate e sei colonne vuote in mezzo, cioè le stesse due cifre
       sotto un asse che promette una forma che non c'è. */
    const barreBersagli = [...perBersaglio.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .map(([urn, sorgenti]) => {
        const anni = anniDaAbrogazione(reader.act(urn)?.abrogatedFrom ?? null);
        return {
          etichetta: nomeNorma(urn),
          valore: sorgenti.size,
          valoreTesto: `${numero(sorgenti.size)} ${sorgenti.size === 1 ? 'atto' : 'atti'}`,
          etichettaLunga: `${nomeNorma(urn)}, abrogata ${anni} anni fa`,
          href: percorsoNorma(urn),
        };
      });

    voci.push({
      cifra: numero(attiRinvianti),
      unita: attiRinvianti === 1 ? 'atto' : 'atti',
      frase: (
        <>
          <strong>ancora in vigore oggi</strong> rinviano a una norma che è stata cancellata
          dall’ordinamento. Chi li applica trova un richiamo a un testo che non c’è più e deve
          ricostruire da sé quale disciplina si sia messa al suo posto. Il rinvio più vecchio punta
          a una legge abrogata <strong>{piuVecchio} anni fa</strong>.
        </>
      ),
      limite: (
        <>
          <strong>Cosa non dice:</strong> che siano tutti errori. Un rinvio può essere{' '}
          <em>recettizio</em> — aver incorporato il testo richiamato una volta per tutte — e allora
          l’abrogazione successiva non lo tocca. Distinguere i due casi richiede di leggere la
          singola norma, e questo lo facciamo scheda per scheda, non a colpi di statistica.
        </>
      ),
      grafico: (
        <GraficoBarre
          barre={barreBersagli}
          descrizione={`Le norme abrogate che gli atti in vigore continuano a richiamare, e da quanti atti ciascuna`}
          didascalia={`Le norme abrogate ancora richiamate da atti in vigore, e quanti atti richiamano ciascuna, sul corpus aggiornato al ${data(conosciutoAl)}.`}
          colonne={{ etichetta: 'Norma abrogata', valore: 'Atti che la richiamano' }}
        />
      ),
      sintesi: 'in vigore che rinviano a una norma cancellata',
      ancora: 'rinvii',
    });
  }

  if (bersaglioPiuCitato) {
    const [urn, sorgenti] = bersaglioPiuCitato;
    const atto = reader.act(urn);
    voci.push({
      cifra: numero(sorgenti.size),
      unita: sorgenti.size === 1 ? 'atto' : 'atti',
      frase: (
        <>
          continuano a richiamare <Link href={percorsoNorma(urn)}>{nomeNorma(urn)}</Link>, abrogato{' '}
          {atto?.abrogatedFrom ? (
            <>
              il {data(atto.abrogatedFrom)}, cioè{' '}
              <strong>{anniDaAbrogazione(atto.abrogatedFrom)} anni fa</strong>
            </>
          ) : (
            'da anni'
          )}
          . Una legge che non esiste più, citata come se esistesse, in atti che continuano a
          produrre effetti.
        </>
      ),
      limite: (
        <>
          <strong>Cosa non dice:</strong> quanti di questi richiami creino davvero un problema
          applicativo. Dice che ci sono, con l’articolo esatto e la data: il resto è nelle singole
          schede.
        </>
      ),
      sintesi: 'che richiamano la stessa legge abrogata',
      ancora: 'bersaglio',
    });
  }

  if (piuVersioni && piuVersioni.versionCount > 1) {
    voci.push({
      cifra: numero(piuVersioni.versionCount),
      unita: 'versioni',
      frase: (
        <>
          dello stesso atto:{' '}
          <Link href={percorsoNorma(piuVersioni.urn)}>{nomeNorma(piuVersioni.urn)}</Link> è stato
          riscritto {numero(piuVersioni.versionCount - 1)} volte. Per sapere cosa prescriveva in una
          certa data bisogna sapere quale versione fosse in vigore quel giorno — ed è esattamente il
          motivo per cui questo sito tiene due assi temporali invece di uno.
        </>
      ),
      limite: (
        <>
          <strong>Cosa non dice:</strong> che sia un difetto. Un regolamento tecnico si aggiorna, e
          deve. Dice quanto è difficile, per chi lo applica, sapere cosa vale oggi.
        </>
      ),
      sintesi: 'dello stesso atto, riscritto nel tempo',
      ancora: 'versioni',
    });
  }

  if (pronunce.length > 0) {
    const ultima = pronunce[0]!;
    voci.push({
      cifra: numero(pronunce.length),
      unita: 'pronunce',
      frase: (
        <>
          della Corte costituzionale hanno dichiarato illegittima una norma presente nel corpus. La
          più recente è la{' '}
          <Link href={percorsoPronuncia(ultima.ecli)}>{titoloPronuncia(ultima)}</Link>, depositata
          il {data(ultima.dataDeposito)}. Illegittimità non è abrogazione: è come se quella norma
          non fosse mai esistita.
        </>
      ),
      limite: (
        <>
          <strong>Cosa non dice:</strong> che siano tutte le pronunce della Corte. Sono quelle che
          colpiscono atti che abbiamo ingerito, che è una frazione della legislazione.
        </>
      ),
      sintesi: 'di illegittimità costituzionale sul corpus',
      ancora: 'consulta',
    });
  }

  if (alta && alta.archi > 0) {
    voci.push({
      cifra: `${numero(alta.confermate)} su ${numero(alta.archi)}`,
      unita: '',
      frase: (
        <>
          è l’accordo fra le declaratorie che leggiamo nei dispositivi della Corte e le note di
          aggiornamento che Normattiva scrive negli atti colpiti, sugli archi ad alta confidenza.
          Due fonti indipendenti che dicono la stessa cosa: è l’unica precisione che possiamo
          misurare senza revisione umana.
        </>
      ),
      limite: (
        <>
          <strong>Cosa non dice:</strong> che il resto del sito sia altrettanto verificato. Sugli
          archi a bassa confidenza lo stesso confronto scende molto, e infatti quelli non li
          pubblichiamo. <Link href="/dati">Le misure per intero</Link>.
        </>
      ),
      sintesi: 'accordo fra la Corte e le note di Normattiva',
      ancora: 'accordo',
    });
  }

  return (
    <div className="contenitore">
      <h1>I numeri</h1>
      <p className="apertura">
        Le cifre più dure che questo dataset sostiene, ciascuna con quello che <em>non</em> dice
        scritto accanto. Un numero condiviso viaggia senza la sua pagina: quello che gli sta attorno
        deve reggere da solo.
      </p>

      <p className="riga-corpus">
        Calcolate sul corpus aggiornato al {data(conosciutoAl)}. Nessuna è scritta a mano: se il
        corpus cambia, cambiano. <Link href="/dati">Come rifare questi conti</Link>.
      </p>

      {/* Qui la griglia serve, e si vede dal comportamento del lettore: questa
          pagina si scorre per trovare *una* cifra da citare, non per leggerla
          dalla prima all'ultima. Le voci sono omogenee — una cifra, cosa
          misura — e incolonnarle le rende trovabili. Sotto, ciascuna torna
          dentro la sua frase con il suo limite accanto, che è il posto dove
          smette di essere un numero e diventa un'affermazione. */}
      <GrigliaCifre
        didascalia="Le cifre di questa pagina, in breve"
        cifre={voci.map((v) => ({
          valore: v.cifra,
          ...(v.unita ? { unita: v.unita } : {}),
          etichetta: v.sintesi,
          href: `#${v.ancora}`,
        }))}
      />

      <ol className="numeri">
        {voci.map((v) => (
          <li key={v.ancora} id={v.ancora} className="numero">
            <p className="numero__cifra">
              {v.cifra}
              {v.unita ? <span className="numero__unita"> {v.unita}</span> : null}
            </p>
            <p className="numero__frase">{v.frase}</p>
            <p className="numero__limite">{v.limite}</p>
            {v.grafico}
            <p className="numero__permalink">
              <a href={`${SITE_URL}/numeri#${v.ancora}`}>
                {SITE_URL.replace(/^https?:\/\//, '')}/numeri#{v.ancora}
              </a>
            </p>
          </li>
        ))}
      </ol>

      <section className="sezione" aria-labelledby="rifare">
        <h2 id="rifare" className="sezione__titolo">
          Rifate i conti
        </h2>
        <p>
          Nessuna di queste cifre chiede di fidarsi di noi. Il dataset è scaricabile e le
          interrogazioni sono le stesse che gira il sito: si prende lo snapshot, si esegue la query,
          si confronta il numero. Se non torna, <Link href="/stampa">scriveteci</Link> — e se
          abbiamo sbagliato, lo correggiamo scrivendolo.
        </p>
        <Condivisione url={`${SITE_URL}/numeri`} titolo="I numeri delle leggi che non tornano" />
      </section>
    </div>
  );
}
