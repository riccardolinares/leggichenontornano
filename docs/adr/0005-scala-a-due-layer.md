# 0005 — Due layer con scala diversa

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

Il layer deterministico e il layer semantico hanno costi marginali per atto
completamente diversi. Trattarli come un'unica pipeline significa o rallentare il
primo o sbagliare il secondo.

## Decisione

Due layer con scala deliberatamente diversa.

**Layer deterministico — corpus completo.** Ingestione di tutto il corpus statale
disponibile, costruzione del grafo delle relazioni, rilevamento delle anomalie
formali. Gira su tutto fin dall'inizio: è lavoro di pipeline su metadati e
riferimenti, e scala.

**Layer semantico — verticali progressivi.** Si attiva **un dominio alla volta**,
ognuno con il suo vocabolario controllato di poche centinaia di concetti in
`data/vocabolari/<dominio>.json`. Primo verticale: trasparenza e anticorruzione /
appalti.

## Motivazione

L'estrazione delle proposizioni deontiche dipende da un vocabolario controllato
di dominio per stabilire che due norme parlano della **stessa fattispecie**.
Senza quel vocabolario, la similarità testuale produce falsi positivi in massa:
«impresa» negli appalti e «impresa» nel fisco sono lo stesso token e cose
diverse.

## Conseguenze

- Positiva: il sito ha contenuto vero dal primo giorno, prodotto dal layer che
  non può sbagliare.
- Positiva: ogni verticale nuovo è un incremento misurabile e recensibile da
  esperti di quel dominio.
- Negativa: la copertura semantica cresce lentamente. Accettato, ed è dichiarato
  nel sito: assenza di segnale ≠ norma coerente.
