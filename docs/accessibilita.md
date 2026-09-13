# Accessibilità

Il requisito è **WCAG 2.1 livello AA**, e non è un proposito: è una suite di test
che fa fallire la build.

Un progetto civico con utenti potenziali nella pubblica amministrazione non ha
una ragione per trattare una violazione di accessibilità diversamente da una
qualunque altra regressione. In più, in Italia, per i siti della PA è un obbligo
di legge (l. 4/2004, e le linee guida AgID che recepiscono la UNI EN 301 549):
anche se questo sito non è di una PA, essere conformi è la condizione perché
possa esserne citato.

## Come si verifica

```bash
pnpm --filter @antinomia/web run build
pnpm --filter @antinomia/web exec playwright install --with-deps chromium
pnpm run e2e
```

Due progetti Playwright, `desktop` e `telefono`, su ogni pagina del sito:
indice, scheda anomalia, lettore norma, come funziona, dati, stampa, pagina non
trovata.

`@axe-core/playwright` con i tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.
**Nessuna regola è disattivata.** Se una violazione fosse un falso positivo,
andrebbe documentata nel file di test con il motivo — non silenziata.

Oltre ad axe, verifiche che axe non può fare:

| Verifica                                                         | Perché                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Il collegamento «Vai al contenuto» è il primo a ricevere il fuoco | Chi naviga da tastiera non deve attraversare il menu a ogni pagina       |
| La gerarchia dei titoli non salta livelli                         | Uno screen reader naviga per intestazioni                                |
| Ogni tabella ha `<caption>` e `<th>`                              | Senza, una tabella è una griglia di celle senza significato              |
| Ogni elemento interattivo mostra il fuoco                         | `outline: none` è il modo più diffuso di rendere un sito inutilizzabile  |
| Il contrasto regge anche in tema scuro                            | axe controlla il tema che trova, non l'altro                             |
| Nessuno scorrimento orizzontale a 360 px                          | È il telefono da cui arriva chi riceve un link su WhatsApp               |
| Il sito funziona senza JavaScript                                 | Reti lente, blocchi aziendali, browser vecchi delle postazioni pubbliche |
| Il foglio di stile è davvero applicato                            | Una pagina senza CSS supera quasi tutti i controlli e non è il sito      |

## Cose trovate dai test, non a mano

Vale la pena elencarle: sono la ragione per cui i test girano anche a 393 px e
in tema scuro.

- **Tabelle che scorrono senza accesso da tastiera.** Su schermo stretto i
  contenitori delle tabelle scorrono orizzontalmente. Senza `tabindex="0"` chi
  non usa il mouse non può vedere le colonne di destra. Risolto con il componente
  [`Tabella`](../apps/web/components/tabella.tsx), che aggiunge anche il nome
  accessibile prendendolo dalla didascalia — che serve comunque.
- **Lo stesso sul diagramma delle relazioni**, per lo stesso motivo.
- **Scorrimento orizzontale della pagina «stampa»** a 360 px, causato da URN e
  URL lunghi senza spazi. Questo sito mostra URN ovunque per scelta, e quindi
  `overflow-wrap: anywhere` sul monospazio non è un dettaglio.

## Scelte di progetto che sono anche scelte di accessibilità

**Niente grafo force-directed** ([ADR 0003](adr/0003-niente-grafo-force-directed.md)).
Fra le cinque ragioni, una è che un canvas è invisibile a uno screen reader. Al
suo posto c'è un SVG con layout deterministico **e la stessa informazione in
forma di tabella** accanto. La tabella non è un ripiego: è il contenuto, il
disegno lo illustra.

**Il sito funziona senza JavaScript.** L'unico componente che ne ha bisogno è il
bottone «copia l'indirizzo»; tutto il resto sono link e `<details>`. La modalità
confronto del lettore norma è un parametro dell'URL, non uno stato del client.

**Colore mai da solo.** Le etichette di gravità hanno testo oltre al colore, la
pagina corrente nella navigazione ha `aria-current="page"` oltre al grassetto,
le finestre di vigenza hanno un elenco testuale sotto la barra.

**Contrasto.** Ogni colore di testo raggiunge almeno 4,5:1 sul proprio fondo,
ogni elemento non testuale almeno 3:1, in entrambi i temi. I valori sono nei
token CSS in cima a [`globals.css`](../apps/web/app/globals.css).

## Quello che manca

- Nessuna prova con screen reader reali (NVDA, VoiceOver). axe trova le
  violazioni strutturali, non dice se la pagina si **ascolta** bene. È il passo
  successivo, e va fatto con persone che usano quegli strumenti tutti i giorni.
- Nessuna dichiarazione di accessibilità formale AgID: serve quando il sito avrà
  un dominio pubblico.
