# 0010 — Un modello può scrivere il blog, e non può decidere niente

- **Stato:** Accettata
- **Data:** 2026-09-13

## Contesto

Il progetto ha una regola scritta in tre posti diversi: **niente prosa
generata**. Quello che compare sul sito o è testo normativo citato alla
lettera, o è un campo del dataset, o è un template scritto a mano nel
repository.

La regola nasce da un'esigenza reale. Una frase generata su una legge è
indifendibile: se è sbagliata non si può dire da dove veniva l'errore, non si
può misurare quanto spesso capiti, e non si può correggere la causa. Un verdetto
sbagliato non si misura — si subisce.

Al tempo stesso il progetto ha un problema che le schede da sole non risolvono.
Una scheda dice **cosa** risulta dai testi, e lo dice bene. Non dice **perché
dovrebbe importare a qualcuno**. Quella distanza — fra un fatto verificabile e
una persona che capisce di cosa si tratta — è la differenza fra un archivio
consultato da dieci addetti e un progetto civico che serve a qualcosa.

Colmarla richiede prosa: spiegare, dare contesto, dire a chi tocca. È
esattamente la cosa che la regola vieta.

## Decisione

Un modello linguistico può scrivere gli articoli del blog, **a quattro
condizioni cumulative**. Se una sola cade, l'articolo non si pubblica.

**1. Il modello non stabilisce fatti: li riceve.** L'unico input è una scheda
costruita da `costruisciFatti`, che contiene campi del dataset e citazioni
letterali — le stesse cose che stanno già nella scheda della segnalazione sul
sito. Il modello non vede il corpus, non può cercare, non riceve mai la domanda
«queste norme si contraddicono?». Quella domanda ha già ricevuto risposta da una
query deterministica, prima che il modello entri in scena.

**2. Un controllo automatico rifiuta quello che i fatti non sostengono.**
`verifica.ts` scarta l'articolo se contiene una cifra che non compare nella
scheda, una citazione fra virgolette che non corrisponde a un testo della
scheda, o una parola da verdetto («illegittimo», «viola», «va abrogato»,
«certamente»). Il controllo è severo e stupido di proposito: non valuta se
l'articolo è scritto bene, valuta se dice qualcosa che non gli è stato dato.

**3. Un articolo rifiutato non si pubblica.** Due tentativi, poi il lavoro del
giorno salta. Saltare un giorno costa infinitamente meno che pubblicare una
frase sbagliata su una legge: la prima cosa la nota il manutentore, la seconda
la nota il lettore che ci credeva.

**4. La firma è visibile e sta in alto.** In cima a ogni articolo generato c'è
scritto che le parole le ha scritte un modello e che i fatti vengono dal
dataset. In alto e non in fondo: chi legge deve saperlo **prima**, non dopo
essersi fatto un'idea. Il campo `modello` di un articolo scritto da una persona
è `null`, e in quel caso la firma dice quello.

Inoltre, ogni articolo è **due metà**, e la divisione è visibile in pagina. Sopra
la prosa; sotto il **dossier** — URN, date, versioni, la query, la precisione
misurata — che non è scritto da nessuno ma assemblato dal dataset al momento
della generazione, e che per costruzione non può divergere dalla scheda.

## Cosa resta vietato

Questa ADR **non** allarga nient'altro. Restano fuori:

- chiedere a un modello se due norme si contraddicono, in qualunque forma;
- far generare il campo `plainLanguage` di una segnalazione, o qualunque altro
  campo del dataset;
- far scrivere a un modello i messaggi del bot, che vanno su piattaforme dove
  una frase circola senza il suo contesto e senza la sua firma;
- pubblicare un articolo senza la segnalazione da cui nasce.

## Conseguenze

- Positiva: il progetto può spiegarsi a chi non è giurista senza rinunciare al
  vincolo che lo rende credibile.
- Positiva: il confine fra «fatti» e «parole» diventa una cosa che si vede in
  pagina, invece di una promessa nel repository.
- Negativa: la verifica automatica è grossolana e rifiuterà articoli corretti —
  per esempio uno che scriva una percentuale legittima ricavata da due numeri
  della scheda. È il verso giusto in cui sbagliare: un falso rifiuto costa un
  giorno di blog, un falso via libera costa la credibilità.
- Negativa: il blog dipende da un servizio esterno e da una chiave. Senza
  `ANTHROPIC_API_KEY` non si pubblica, e non è un errore: il resto del sito
  funziona identico.
