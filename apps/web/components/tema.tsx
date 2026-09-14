'use client';

import { useEffect, useState } from 'react';
import { Bottone } from '@/components/ui/bottone';
import { ThemeProvider, useTheme } from 'next-themes';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

/**
 * Chiaro, scuro, sistema.
 *
 * È il componente `mode-toggle` di shadcn/ui — stessa impalcatura: `next-themes`
 * per lo stato e per lo script che scrive l'attributo **prima della prima
 * pittura**, il menù a discesa di Radix per il comportamento da tastiera.
 *
 * Quello che non è di shadcn sono le classi. shadcn le scrive in Tailwind, e
 * qui Tailwind non c'è: il sito ha una tavolozza scritta a mano in
 * `globals.css`, e installare Tailwind vorrebbe dire azzerarla con il suo
 * preflight e riscrivere millecinquecento righe di CSS per ottenere lo stesso
 * aspetto di adesso. Il modello di shadcn è «copia il componente e diventa
 * tuo», non «installa una libreria»: copiato e adattato è il modo previsto di
 * usarlo, non una scorciatoia.
 *
 * Radix vale la dipendenza per una ragione sola, ed è il comportamento che a
 * mano si sbaglia: il fuoco che entra nel menù e torna al bottone, `Esc` che
 * chiude, le frecce che scorrono le voci, `aria-expanded` e `aria-checked`
 * coerenti. Su un sito che dichiara WCAG 2.1 AA non è un dettaglio.
 */

/**
 * `attribute="data-theme"` fa scrivere a `next-themes` il tema **risolto**
 * sull'elemento radice: `data-theme="dark"` anche quando la scelta è «sistema».
 * Il CSS deve quindi conoscere due soli casi, e li conosce (vedi il blocco in
 * testa a `globals.css`).
 *
 * `disableTransitionOnChange` evita che il cambio di tema animi mezza pagina:
 * una transizione su cento colori contemporaneamente si vede come uno sfarfallio.
 */
export function FornitoreTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

const SCELTE = [
  { valore: 'light', etichetta: 'Chiaro', Icona: Sun },
  { valore: 'dark', etichetta: 'Scuro', Icona: Moon },
  { valore: 'system', etichetta: 'Come il sistema', Icona: Monitor },
] as const;

export function SelettoreTema() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  /*
   * Prima dell'idratazione il tema non si sa: il server non conosce né la
   * scelta salvata né la preferenza del sistema. Disegnare comunque un'icona
   * significherebbe disegnare quella sbagliata per metà delle persone e vederla
   * saltare un istante dopo. Finché non siamo montati il bottone c'è — occupa
   * il suo spazio, quindi la testata non si sposta — ma resta neutro.
   */
  const [montato, setMontato] = useState(false);
  useEffect(() => setMontato(true), []);

  const IconaAttuale = !montato ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const scelta = montato ? (theme ?? 'system') : 'system';
  const descrizione = montato
    ? `Tema: ${SCELTE.find((s) => s.valore === scelta)?.etichetta.toLowerCase() ?? 'come il sistema'}`
    : 'Tema';

  return (
    <Menu.Root>
      {/* `asChild` fa sì che Radix metta i suoi attributi sul bottone del
          progetto invece di aggiungere un elemento suo: resta un solo
          `<button>` in pagina, che è quello che i test cercano per ruolo. */}
      <Menu.Trigger asChild>
        <Bottone variante="testata" misura="testata" aria-label={descrizione}>
          <IconaAttuale aria-hidden="true" focusable="false" size={18} strokeWidth={1.75} />
        </Bottone>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content className="tema__menu" align="end" sideOffset={6}>
          {SCELTE.map(({ valore, etichetta, Icona }) => (
            <Menu.CheckboxItem
              key={valore}
              className="tema__voce"
              checked={scelta === valore}
              onCheckedChange={() => setTheme(valore)}
            >
              <Icona aria-hidden="true" focusable="false" size={16} strokeWidth={1.75} />
              <span>{etichetta}</span>
              {/* Il segno di spunta dice quale scelta è attiva a chi guarda;
                  a chi non guarda lo dice `aria-checked`, che Radix mette da
                  sé sulla voce. */}
              <span className="tema__spunta" aria-hidden="true">
                {scelta === valore ? <Check size={14} strokeWidth={2.5} /> : null}
              </span>
            </Menu.CheckboxItem>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
