# 0008 — Gli URL sono il prodotto

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

Il target di questo progetto include avvocati, funzionari pubblici, giornalisti e
ricercatori. Per tutti loro l'artefatto utile non è una sessione di navigazione:
è **un link da incollare** in una memoria difensiva, in una determina, in un
articolo, in una nota a piè di pagina.

## Decisione

Lo schema degli URL è parte dell'API pubblica e segue una policy di stabilità.

```
/anomalia/{id}                              scheda anomalia
/norma/{urn}                                testo vigente oggi
/norma/{urn}?v=2013-04-20                   testo vigente a quella data
/norma/{urn}~art3?v=2013-04-20              singolo articolo a quella data
/norma/{urn}~art3?v=2013-04-20&c=2016-08-01 modalità confronto fra due date
```

Regole:

- l'URN:NIR è la chiave primaria, in chiaro nell'URL, non un id opaco;
- la modalità confronto è un **parametro dello stesso URL**, non una pagina
  separata;
- nessun URL di contenuto richiede JavaScript per risolversi: ogni pagina è
  generata staticamente o renderizzata server-side;
- un URL pubblicato non viene rimosso: se il contenuto cambia natura si
  reindirizza in modo permanente.

## Conseguenze

- Positiva: il contenuto è citabile e il progetto acquisisce autorevolezza per
  accumulo di citazioni.
- Positiva: gli URL sono anche gli identificatori del dataset esportato, quindi
  dataset e sito non divergono.
- Negativa: vincola la struttura del frontend. Accettato: è il vincolo giusto.
- Negativa: gli URN contengono caratteri (`:`, `;`) che vanno gestiti con
  attenzione in encoding e routing. Risolto in
  `packages/akn-parser/src/urn.ts` con funzioni di escape/unescape esplicite e
  test dedicati.
