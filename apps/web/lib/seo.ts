import type { Metadata } from 'next';
import { SITE_URL } from './dataset';

/**
 * I metadati delle pagine, costruiti in un posto solo.
 *
 * Scriverli pagina per pagina funziona per tre pagine e smette di funzionare
 * alla quarta: una dimentica il canonical, un'altra ha un `og:url` relativo,
 * una terza dichiara un'anteprima che non esiste. Sono errori che non si vedono
 * guardando il sito — si vedono quando qualcuno incolla il link e non compare
 * niente, cioè quando è tardi.
 *
 * Il canonical è la parte che conta di più qui: lo stesso contenuto è
 * raggiungibile con parametri diversi (`?v=` per la vigenza, `?tipo=` per il
 * filtro) e senza un canonical esplicito quegli URL diventano pagine distinte
 * agli occhi di un motore di ricerca, che si divide il peso fra copie.
 */

export const NOME_SITO = 'Le leggi che non tornano';

export interface Pagina {
  titolo: string;
  descrizione: string;
  /** Percorso assoluto dalla radice, con la barra iniziale. */
  percorso: string;
  /** `article` per le schede, `website` per gli indici. Predefinito `website`. */
  tipo?: 'website' | 'article';
  /** Quando la pagina non deve finire negli indici (duplicati, pagine di servizio). */
  nonIndicizzare?: boolean;
}

export function metadatiPagina({
  titolo,
  descrizione,
  percorso,
  tipo = 'website',
  nonIndicizzare = false,
}: Pagina): Metadata {
  const url = `${SITE_URL}${percorso}`;
  return {
    title: titolo,
    description: descrizione,
    alternates: { canonical: url },
    openGraph: {
      title: titolo,
      description: descrizione,
      url,
      type: tipo,
      siteName: NOME_SITO,
      locale: 'it_IT',
    },
    twitter: { card: 'summary_large_image', title: titolo, description: descrizione },
    ...(nonIndicizzare ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * I dati strutturati del sito, una volta sola nel layout.
 *
 * `WebSite` serve a dichiarare il nome con cui il sito va citato; `Dataset` è
 * quello che interessa davvero — è il vocabolario con cui un motore di ricerca
 * capisce che qui c'è una raccolta scaricabile, con una licenza e una fonte, e
 * non un blog di opinioni sul diritto.
 */
export function datiStrutturatiSito(repoUrl: string, aggiornatoAl: string | null): string {
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: NOME_SITO,
      url: SITE_URL,
      inLanguage: 'it-IT',
      description:
        'Incongruenze, contraddizioni e aree grigie della legislazione italiana, con le prove e la regola che le ha trovate.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${NOME_SITO} — dataset delle segnalazioni`,
      description:
        'Corpus normativo bitemporale, relazioni datate fra norme e segnalazioni di incongruenza, con la precisione misurata di ogni controllo.',
      url: `${SITE_URL}/dati`,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      isAccessibleForFree: true,
      inLanguage: 'it-IT',
      codeRepository: repoUrl,
      ...(aggiornatoAl ? { dateModified: aggiornatoAl.slice(0, 10) } : {}),
      creator: { '@type': 'Organization', name: NOME_SITO, url: SITE_URL },
      isBasedOn: {
        '@type': 'Dataset',
        name: 'Normattiva — Banca dati delle norme vigenti',
        url: 'https://dati.normattiva.it',
        license: 'https://creativecommons.org/licenses/by/4.0/',
      },
    },
  ]);
}

/**
 * I dati strutturati di una segnalazione.
 *
 * `Article` e non `Claim`: una segnalazione è il resoconto di una query, non
 * una tesi che il progetto sostiene. La differenza non è formale — `Claim`
 * inviterebbe a trattarla come una presa di posizione da verificare o smentire,
 * che è esattamente il fraintendimento che il sito passa il tempo a evitare.
 */
export function datiStrutturatiSegnalazione(opzioni: {
  titolo: string;
  descrizione: string;
  percorso: string;
  pubblicataIl: string;
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opzioni.titolo,
    description: opzioni.descrizione,
    url: `${SITE_URL}${opzioni.percorso}`,
    datePublished: opzioni.pubblicataIl.slice(0, 10),
    inLanguage: 'it-IT',
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: NOME_SITO, url: SITE_URL },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  });
}

/**
 * I dati strutturati di un approfondimento del blog.
 *
 * `BlogPosting`, e quando le parole le ha scritte un modello l'autore è
 * dichiarato come tale. Mettere il nome del progetto come autore di un testo
 * generato sarebbe comodo per il posizionamento e falso: `author` è un campo
 * che dice chi risponde di quelle frasi.
 */
export function datiStrutturatiArticolo(opzioni: {
  titolo: string;
  descrizione: string;
  percorso: string;
  pubblicatoIl: string;
  /** Identificatore del modello, quando l'articolo è generato. */
  autoreMacchina?: string;
}): string {
  const url = `${SITE_URL}${opzioni.percorso}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: opzioni.titolo,
    description: opzioni.descrizione,
    url,
    mainEntityOfPage: url,
    datePublished: opzioni.pubblicatoIl.slice(0, 10),
    dateModified: opzioni.pubblicatoIl.slice(0, 10),
    inLanguage: 'it-IT',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    author: opzioni.autoreMacchina
      ? { '@type': 'SoftwareApplication', name: opzioni.autoreMacchina }
      : { '@type': 'Organization', name: NOME_SITO, url: SITE_URL },
    publisher: { '@type': 'Organization', name: NOME_SITO, url: SITE_URL },
  });
}
