import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/*
 * Il bottone di shadcn, con le varianti del progetto.
 *
 * Le classi Tailwind leggono le variabili agganciate alla tavolozza del sito,
 * quindi `bg-primary` è verderame e non il blu di default. I nomi delle
 * varianti restano quelli di shadcn — `default`, `outline`, `ghost` — perché
 * chi conosce la libreria li ritrova, e chi legge il codice del progetto li
 * impara una volta sola.
 *
 * `asChild` serve ai link: un `<Link>` che sembra un bottone deve restare un
 * link, altrimenti smette di aprirsi in una scheda nuova e sparisce
 * dall'elenco dei collegamenti di una pagina — che in questo sito è anche il
 * modo in cui il controllo sui link rotti trova le cose.
 */
const varianti = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ' +
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variante: {
        default: 'bg-primary text-primary-foreground hover:bg-verderame-scuro',
        outline: 'border border-bordo-forte bg-card text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        distruttiva: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      misura: {
        default: 'h-10 px-4 py-2',
        piccola: 'h-8 px-3 text-xs',
        grande: 'h-12 px-6 text-base',
        icona: 'h-10 w-10',
      },
    },
    defaultVariants: { variante: 'default', misura: 'default' },
  },
);

export function Bottone({
  className,
  variante,
  misura,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof varianti> & { asChild?: boolean }) {
  const Componente = asChild ? Slot : 'button';
  return <Componente className={cn(varianti({ variante, misura }), className)} {...props} />;
}

export { varianti as variantiBottone };
