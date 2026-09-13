/**
 * Un articolo del blog, come sta su disco.
 *
 * Gli articoli sono file versionati nella repository, non righe in un
 * database. Tre conseguenze volute:
 *
 *  1. la generazione del sito non richiede nient'altro che il repository;
 *  2. ogni articolo ha una cronologia leggibile con `git log`: quando è stato
 *     scritto, con quale modello, e se qualcuno l'ha corretto a mano dopo;
 *  3. un articolo sbagliato si corregge con una pull request, che è il modo in
 *     cui si correggono le cose in questo progetto.
 */

export interface Sezione {
  titolo: string;
  paragrafi: string[];
}

export interface Articolo {
  /** Identificatore stabile e leggibile: è l'URL. */
  slug: string;
  /** Giorno di pubblicazione, formato AAAA-MM-GG. */
  data: string;
  /** La segnalazione da cui nasce. L'articolo non esiste senza. */
  anomaliaId: string;
  titolo: string;
  /** Due o tre frasi che reggono da sole: è quello che finisce nell'anteprima. */
  sommario: string;
  sezioni: Sezione[];
  /**
   * Chi ha scritto le parole.
   *
   * L'identificatore del modello, oppure `null` quando l'articolo l'ha scritto
   * una persona. Sta nel file e non in una nota perché la firma compare in
   * pagina, e deve dire la verità in entrambi i casi: un articolo scritto da un
   * modello va dichiarato dove qualcuno lo legge, e uno scritto a mano non deve
   * prendersi quell'etichetta.
   *
   * `promptVersione` serve a sapere quali articoli generati sono confrontabili
   * fra loro, se le istruzioni cambiano.
   */
  modello: string | null;
  promptVersione: string | null;
  generatoIl: string;
}

/** `Decreto… rinvia a…` → `2026-09-13-decreto-rinvia-a`. */
export function slugDa(data: string, titolo: string): string {
  const corpo = titolo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter((p) => p.length > 0)
    .slice(0, 9)
    .join('-');
  return `${data}-${corpo}`.slice(0, 80).replace(/-+$/, '');
}
