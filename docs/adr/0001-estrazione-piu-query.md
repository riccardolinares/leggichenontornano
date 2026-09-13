# 0001 — L'LLM estrae struttura, il codice giudica

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

Il modo ovvio di cercare contraddizioni fra norme con un modello linguistico è
dargli due testi e chiedergli se si contraddicono. È anche il modo che rende il
progetto indifendibile.

Un verdetto prodotto direttamente da un modello ha quattro proprietà fatali per
un progetto la cui unica risorsa è la credibilità:

1. non è riproducibile — la stessa coppia di testi può dare esiti diversi;
2. non è verificabile — chi contesta la segnalazione non ha nulla da ispezionare
   se non la prosa del modello;
3. non è misurabile — non esiste una metrica onesta su un verdetto olistico;
4. l'errore non è confinato — un'allucinazione nella comprensione del testo
   arriva intatta fino alla prima pagina.

## Decisione

Il modello estrae **struttura**, mai verdetti. Per ogni comma produce una
proposizione normalizzata tipizzata: soggetto/fattispecie, modalità deontica,
oggetto, termine, conseguenza, condizioni, ambito, URN, comma, finestra di
vigenza.

La contraddizione è poi una **query** su quelle proposizioni:

```
stessa modalità ∧ stesso soggetto ∧ fattispecie sovrapposta
∧ vigenze intersecanti ∧ valore divergente
```

Nessun percorso di codice invia due testi normativi a un modello chiedendo un
giudizio di coerenza. Questa è una proprietà architetturale del pacchetto
`engine`: il tipo `AnomalyFinding` non ha un campo dove una spiegazione generata
possa entrare, e la regola che ha prodotto la segnalazione viene serializzata in
chiaro insieme alla segnalazione stessa.

## Conseguenze

- Positiva: la segnalazione è ispezionabile. Chi contesta può dire se abbiamo
  sbagliato **l'estrazione** o se il conflitto è **reale**: due errori diversi,
  entrambi utili, entrambi misurabili separatamente.
- Positiva: la precisione dell'estrazione si valida a campione, per campo.
- Positiva: le regole sono codice leggibile, versionato, discutibile.
- Negativa: il recall è più basso. Accettato: si ottimizza per precisione.
- Negativa: serve un vocabolario controllato per dominio prima di poter attivare
  il layer semantico su quel dominio. Vedi ADR 0005.
