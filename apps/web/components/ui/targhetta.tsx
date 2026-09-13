import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/*
 * La targhetta — il `Badge` di shadcn.
 *
 * Le varianti non sono decorative: dicono la gravità di una segnalazione, ed è
 * il motivo per cui il colore da solo non basta mai. Ogni targhetta porta
 * anche la parola («gravità alta»), perché chi non distingue il rosso
 * dall'ocra deve leggere la stessa informazione — è il vincolo WCAG 1.4.1, e
 * qui è anche solo buon senso: una sfumatura non è un dato.
 */
const varianti = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold',
  {
    variants: {
      gravita: {
        alta: 'border-ossido bg-ossido-velo text-ossido',
        media: 'border-ocra bg-ocra-velo text-ocra',
        bassa: 'border-bordo bg-secondary text-muted-foreground',
        neutra: 'border-bordo bg-secondary text-foreground',
      },
    },
    defaultVariants: { gravita: 'neutra' },
  },
);

export function Targhetta({
  className,
  gravita,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof varianti>) {
  return <span className={cn(varianti({ gravita }), className)} {...props} />;
}
