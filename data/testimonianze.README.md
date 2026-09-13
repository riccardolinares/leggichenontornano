# Testimonianze

Il contenuto di `testimonianze.json` alimenta la pagina
[/dicono](https://leggichenontornano.it/dicono).

**Nessuna voce di questo file può essere scritta da noi.** Ogni riga riporta
parole che qualcun altro ha scritto in pubblico, con il collegamento al posto
dove le ha scritte, così chi legge può verificarle senza fidarsi. Una
testimonianza senza `url` non si aggiunge: sarebbe una frase fra virgolette che
nessuno può controllare, cioè esattamente quello che questo progetto rimprovera
a chi cita una legge senza citarne la data.

Se qualcuno ha detto qualcosa in privato e ci autorizza a pubblicarlo, il campo
`url` resta assente e il campo `fonte` dice `"privata"`: la pagina lo mostra come
tale, senza fingere che sia verificabile.

## Formato

```json
[
  {
    "testo": "Le parole, alla lettera, senza tagli nel mezzo.",
    "autore": "Nome Cognome",
    "ruolo": "Che cosa fa, quando è rilevante. Facoltativo.",
    "fonte": "linkedin",
    "url": "https://www.linkedin.com/posts/...",
    "data": "2026-09-20"
  }
]
```

- `fonte`: `linkedin`, `x`, `facebook`, `telegram`, `articolo`, `video`,
  `privata`.
- `url`: obbligatorio per tutte le fonti tranne `privata`.
- `data`: quando è stato detto, formato `AAAA-MM-GG`.

## I video non si incorporano

Un video si mette come **collegamento**, mai come riquadro incorporato. Un
embed di YouTube o di Instagram carica codice di terze parti su una pagina che
dice quali leggi una persona sta leggendo, ed è una riga che il progetto non
supera (DESIGN.md, regola 5).
