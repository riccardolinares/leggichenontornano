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
/controllo/{id}                             cosa cerca una regola, e quanto è precisa
/corte/{ecli}                               una decisione della Corte costituzionale
/norme                                      l'indice degli atti ingeriti
/corte                                      l'indice delle decisioni
/numeri                                     le cifre, con quello che non dicono
```

Regole:

- l'URN:NIR è la chiave primaria, in chiaro nell'URL, non un id opaco; per le
  decisioni della Corte lo stesso ruolo ce l'ha l'ECLI;
- la modalità confronto è un **parametro dello stesso URL**, non una pagina
  separata;
- un parametro che restringe o data un contenuto (`?v=`, `?c=`, `?tipo=`) non
  crea un contenuto nuovo: il `link rel="canonical"` di quelle pagine punta
  sempre all'URL senza parametri. La conseguenza pratica è che ciò che si cita
  e ciò che un motore di ricerca indicizza coincidono;
- quando una cosa si cerca per nome — un tipo di controllo, il numero di una
  sentenza — ha un URL suo e non un filtro: un parametro non ha un titolo, non
  si cita, e non è una pagina;
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
