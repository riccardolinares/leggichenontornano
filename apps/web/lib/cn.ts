import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Unisce classi Tailwind risolvendo i conflitti a favore dell'ultima.
 *
 * È la funzione che shadcn chiama `cn`, e serve perché senza di lei
 * `"p-2"` e `"p-4"` finiscono entrambe nell'attributo e vince quella che il
 * foglio di stile dichiara per ultima — cioè una scelta che non si vede dal
 * codice. Con `twMerge` vince quella scritta dopo nella chiamata, che è quello
 * che chi legge si aspetta.
 */
export function cn(...classi: ClassValue[]): string {
  return twMerge(clsx(classi));
}
