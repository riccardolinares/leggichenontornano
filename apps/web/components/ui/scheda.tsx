import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/*
 * La scheda di shadcn.
 *
 * Il sito la usava già, con il nome `.scheda`: un rettangolo di carta alta su
 * fondo carta, un bordo sottile, angoli quasi vivi. Qui è la stessa cosa
 * scritta in Tailwind, e i colori arrivano dalle stesse variabili — quindi il
 * tema scuro continua a funzionare senza una riga in più.
 */
export function Scheda({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-md border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  );
}

export function SchedaTesta({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-3', className)} {...props} />;
}

export function SchedaTitolo({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('font-serif text-lg leading-snug', className)} {...props} />;
}

export function SchedaCorpo({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function SchedaPiede({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 p-5 pt-0 text-sm text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
