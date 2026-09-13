import Link from 'next/link';

/**
 * Una griglia di cifre.
 *
 * La regola generale del progetto resta quella di sempre: **i numeri stanno
 * dentro le frasi**, perché un numero dentro una frase si legge e una griglia
 * di metriche si guarda soltanto. Una home che apre con sei riquadri non dice
 * cosa contiene il sito, dice «guarda quanti dati abbiamo».
 *
 * Ma è una regola, non un divieto. La griglia serve quando le cifre sono
 * **omogenee e destinate al confronto** — stessa unità, stesso significato, e
 * il lettore le sta scorrendo per trovarne una, non per capire cosa dicono. In
 * quel caso incolonnarle è la forma giusta, e infilarle in un paragrafo le
 * renderebbe più difficili da trovare, non più chiare.
 *
 * Il criterio pratico: se togliendo la griglia il testo resta comprensibile,
 * la griglia era decorazione. Se invece il lettore deve confrontare la prima
 * cifra con la quinta, la griglia sta facendo il suo lavoro.
 */

export interface Cifra {
  /** La cifra, già formattata all'italiana. */
  valore: string;
  /** L'unità o il soggetto: «giorni», «atti». Può mancare. */
  unita?: string;
  /** Cosa misura, in poche parole. */
  etichetta: string;
  /** Dove porta, quando c'è un posto dove leggerne di più. */
  href?: string;
}

export function GrigliaCifre({ cifre, didascalia }: { cifre: Cifra[]; didascalia: string }) {
  if (cifre.length === 0) return null;

  return (
    <div className="griglia-cifre" role="group" aria-label={didascalia}>
      {cifre.map((c) => {
        const corpo = (
          <>
            <span className="griglia-cifre__valore">
              {c.valore}
              {c.unita ? <span className="griglia-cifre__unita"> {c.unita}</span> : null}
            </span>
            <span className="griglia-cifre__etichetta">{c.etichetta}</span>
          </>
        );
        return c.href ? (
          <Link key={c.etichetta} href={c.href} className="griglia-cifre__voce">
            {corpo}
          </Link>
        ) : (
          <div key={c.etichetta} className="griglia-cifre__voce">
            {corpo}
          </div>
        );
      })}
    </div>
  );
}
