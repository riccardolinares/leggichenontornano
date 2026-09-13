import Link from 'next/link';

/**
 * Le cifre dell'apertura.
 *
 * Non è la `GrigliaCifre` con i numeri più grossi: fa un altro mestiere. La
 * griglia serve a **confrontare** cifre omogenee che il lettore sta scorrendo;
 * queste servono a **fermare** chi è appena arrivato, e sono quattro perché
 * alla quinta non se ne ricorda nessuna.
 *
 * La home apriva con una frase e quattro paragrafi sotto. Era leggibile e non
 * la leggeva nessuno: chi arriva su un sito che parla di leggi non concede sei
 * righe di fiducia. I numeri qui sono gli stessi di prima, presi dallo stesso
 * dataset — cambia che adesso si vedono prima di decidere se restare.
 *
 * Ogni cifra è un collegamento, e porta dove quella cifra è spiegata con il suo
 * limite accanto. Un numero da solo è uno slogan; un numero che porta alla
 * propria smentita possibile è un'affermazione.
 */

export interface CifraForte {
  /** La cifra, già formattata all'italiana. */
  valore: string;
  /** L'unità, quando ne ha una: «atti», «anni». */
  unita?: string;
  /** Cosa dice quella cifra, in una riga che si legge tutta d'un fiato. */
  frase: string;
  /** Dove sta spiegata, con il suo limite. */
  href: string;
}

export function CifreForti({ cifre, didascalia }: { cifre: CifraForte[]; didascalia: string }) {
  if (cifre.length === 0) return null;

  return (
    <ul className="cifre-forti" aria-label={didascalia}>
      {cifre.map((c) => (
        <li key={c.frase} className="cifre-forti__voce">
          <Link href={c.href} className="cifre-forti__collegamento">
            <span className="cifre-forti__valore">
              {c.valore}
              {c.unita ? <span className="cifre-forti__unita"> {c.unita}</span> : null}
            </span>
            <span className="cifre-forti__frase">{c.frase}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
