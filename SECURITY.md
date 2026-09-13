# Segnalare un problema di sicurezza

Non aprite una issue pubblica.

Scrivete a **linares.riccardo@gmail.com** con «leggichenontornano — sicurezza»
nell'oggetto. Rispondiamo entro cinque giorni lavorativi e vi teniamo aggiornati
fino alla chiusura.

## Cosa ci interessa

Questo progetto non tratta dati personali e non ha autenticazione, quindi la
superficie è piccola. Le cose che ci interessano davvero:

- **Esecuzione di codice** attraverso i file XML ingeriti. Il parser accetta
  input da una fonte pubblica ma non controllata da noi; espansione di entità,
  XXE, consumo di risorse illimitato sono tutti pertinenti.
- **Avvelenamento del dataset**: qualunque strada per far comparire sul sito una
  segnalazione che non discende dai dati di origine. Per un progetto la cui
  unica risorsa è la credibilità, questa è la classe di problemi più grave che
  abbiamo, più di una qualunque vulnerabilità del server.
- **Aggiramento del cancello di pubblicazione**: un modo per far uscire
  segnalazioni di un controllo sotto soglia.
- Problemi nelle GitHub Action, in particolare quelli che permettano di
  esfiltrare i segreti del bot o di scrivere sul repository.

## Cosa non è un problema di sicurezza

- Una segnalazione sbagliata su una norma. È importante e vogliamo saperlo, ma
  la strada è il pulsante **«Non è un conflitto»** sulla scheda, che apre una
  issue pubblica ed è esattamente quello che serve.
- L'assenza di autenticazione. Non c'è niente da autenticare: il sito è di sola
  lettura e i dati sono pubblici.

## Divulgazione

Preferiamo la divulgazione coordinata. Se il problema riguarda i dati di origine
e non il nostro codice, vi aiutiamo a portarlo a chi di dovere.
