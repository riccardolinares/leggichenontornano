import type { ReactNode } from 'react';

/**
 * Una tabella che può scorrere orizzontalmente.
 *
 * Su schermo stretto le tabelle di questo sito non ci stanno, e il contenitore
 * scorre. Un'area che scorre deve essere raggiungibile da tastiera, altrimenti
 * chi non usa il mouse non può vedere le colonne di destra: `tabindex="0"` la
 * rende focalizzabile e le frecce la scorrono.
 *
 * Un'area focalizzabile ha bisogno di un nome, altrimenti uno screen reader
 * annuncia «gruppo» e basta: il nome è la didascalia della tabella, che serve
 * comunque e quindi non è lavoro in più.
 *
 * Scoperto dall'audit axe su viewport da telefono, non a mano: è il motivo per
 * cui i test girano anche a 393 px di larghezza.
 */
export function Tabella({
  didascalia,
  stile,
  children,
}: {
  didascalia: string;
  stile?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className="tabella-contenitore"
      tabIndex={0}
      role="region"
      aria-label={didascalia}
      style={stile}
    >
      <table>
        <caption>{didascalia}</caption>
        {children}
      </table>
    </div>
  );
}
