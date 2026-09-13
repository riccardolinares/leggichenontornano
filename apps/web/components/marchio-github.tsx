/**
 * Il marchio di GitHub, disegnato qui.
 *
 * `lucide-react` non ha più le icone dei marchi — le ha tolte dalla versione 1
 * per non distribuire loghi altrui — e le altre icone disponibili («codice»,
 * «ramo») non si riconoscono: un collegamento al codice sorgente funziona
 * perché la gente riconosce il gatto, non perché capisce il simbolo.
 *
 * Il tracciato è quello ufficiale, usato per quello che GitHub consente
 * espressamente: indicare un collegamento a GitHub. Non è colorato, eredita il
 * colore del testo, e sta in un elemento decorativo — l'etichetta per chi non
 * vede sta accanto, nel collegamento.
 */
export function MarchioGithub({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
