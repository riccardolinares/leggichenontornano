# 0007 — Store bitemporale: vigenza e conoscenza

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

Un semplice versioning ("questa è la versione 3 dell'articolo") non basta. La
legge 241/1990 ha oltre sessanta versioni succedutesi nel tempo, e le domande che
il progetto deve saper rispondere sono due, diverse:

- *cosa diceva questo articolo il 20 aprile 2013?* — asse della **vigenza**;
- *cosa sapevamo noi di questo articolo il 20 aprile 2013?* — asse della
  **conoscenza**.

La seconda non è accademica: è la domanda che si fa chi contesta una nostra
segnalazione pubblicata mesi fa e nel frattempo superata da una modifica
normativa, e la domanda che ci permette di dire "abbiamo segnalato questo, in
base a questo, in questa data".

## Decisione

Ogni versione di espressione normativa porta quattro date:

- `inForceFrom`, `inForceTo` — finestra di vigenza (può essere aperta a destra);
- `knownFrom`, `knownTo` — finestra di conoscenza, cioè il periodo in cui il
  nostro store ha creduto che quella fosse la versione vigente.

Le correzioni non sovrascrivono: chiudono `knownTo` sulla riga precedente e ne
aprono una nuova. Le segnalazioni pubblicate registrano la `knownAt` usata, così
una segnalazione resta riproducibile anche dopo un aggiornamento del corpus.

## Conseguenze

- Positiva: `GET /norma/{urn}?v=2013-04-20` è deterministico e resta tale.
- Positiva: ogni anomalia archiviata può essere rieseguita sullo stato di
  conoscenza del giorno in cui fu pubblicata.
- Negativa: lo store cresce e ogni query deve portarsi dietro due predicati
  temporali. Mitigato con indici compositi e con un'unica funzione di accesso che
  li applica sempre.
