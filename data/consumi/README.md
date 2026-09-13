# Il registro dei consumi

Una riga per ogni chiamata a un modello linguistico fatta da questo progetto, in
JSONL, un file al mese (`AAAA-MM.jsonl`). È quello che alimenta la pagina
[/costi](https://leggichenontornano.it/costi).

Il registro è **append-only**: una riga scritta non si modifica e non si
cancella. Se un prezzo cambia, cambia il listino in
[`packages/consumi/src/prezzi.ts`](../../packages/consumi/src/prezzi.ts) — con la
data da cui vale — e le righe vecchie restano al prezzo che avevano quel giorno.
Ricalcolare la spesa dell'anno scorso ai prezzi di oggi non dà la spesa
dell'anno scorso.

## Una riga

```json
{
  "quando": "2026-09-13T05:31:12.482Z",
  "modello": "claude-opus-5",
  "uso": "blog",
  "tokenIngresso": 3821,
  "tokenUscita": 912,
  "tokenCacheScrittura": 0,
  "tokenCacheLettura": 0,
  "costo": 0.041915,
  "valuta": "USD",
  "listino": "2026-01-01",
  "chi": "progetto",
  "origine": "automatico"
}
```

`costo` è **stimato**, non fatturato: è il prodotto dei token per il listino in
vigore quel giorno, e `listino` dice quale listino, così il conto si rifà a mano.
Vale `null` quando il modello non è a listino, e la pagina conta quella chiamata
tenendola fuori dal totale in dollari invece di valutarla zero.

`origine` distingue due cose che non vanno sommate senza dirlo:

- `automatico` — la chiamata l'ha fatta il progetto e l'ha misurata da sé;
- `dichiarato` — un contributore ha dichiarato il consumo del proprio lavoro con
  un assistente, e `chi` porta il suo nome utente GitHub.

## Chi ci scrive

Le righe `automatico` le scrive il client avvolto in
[`packages/consumi/src/cliente.ts`](../../packages/consumi/src/cliente.ts), da cui
passa ogni chiamata del progetto: la redazione del blog, l'estrazione deontica e
il confronto assistito. Le committa la stessa GitHub Action che produce
l'artefatto — `blog.yml` per l'approfondimento del giorno, `pipeline.yml` nella
sua pull request quotidiana.

Le righe `dichiarato` le scrive chi contribuisce, con un comando:

```bash
pnpm consumi dichiara --chi <vostro-utente-github> --sessione <file.jsonl>
```

Le istruzioni per esteso sono in [CONTRIBUTING.md](../../CONTRIBUTING.md).
