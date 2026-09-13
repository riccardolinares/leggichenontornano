# Diario delle versioni

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il
versionamento è [semantico](https://semver.org/lang/it/).

Una regola in più, che vale per questo progetto e non per tutti: **quando il
numero di segnalazioni cambia, qui si scrive perché.** Un calo non è una
regressione. Sul corpus reale le segnalazioni pubblicate sono passate da 238 a
103 mentre la qualità saliva, un difetto della fonte alla volta, e senza questa
riga sembrerebbe che il motore si fosse rotto.

## [Non rilasciato]

Prima versione completa. Le revisioni registrate sono ancora poche, e finché lo
sono la pagina Dati lo dichiara: la precisione di un controllo vale quanto il
campione su cui è misurata.

### Aggiunto

- **Ingestione** dagli open data di Normattiva: Akoma Ntoso, URN:NIR, ELI,
  multivigenza. Store bitemporale con asse di vigenza e asse di conoscenza, così
  che una segnalazione pubblicata resti riproducibile dopo un aggiornamento del
  corpus.
- **Grafo tipizzato e datato** delle relazioni fra atti, attraversato con
  recursive CTE in PostgreSQL.
- **Motore dei controlli** su tre livelli, con cancello di pubblicazione all'85%
  di precisione su almeno 30 revisioni umane. La soglia è codificata e provata
  dai test, non dichiarata.
- **Verifica in Gazzetta Ufficiale** dei provvedimenti attuativi, mandato per
  mandato: tre esiti — `adottato`, `non-adottato`, `non-verificabile` — e solo
  il secondo autorizza il controllo `attuazione-mancante` a pubblicare. Ogni
  verifica registra la query esatta, l'URL interrogato, la data e, quando il
  provvedimento c'è, i suoi estremi e la citazione letterale. Sul corpus di oggi
  la copertura è **zero**: nessun mandato ha ancora prodotto un `non-adottato`,
  e il contatore continua a dire quello che diceva prima. Vedi
  [ADR 0013](docs/adr/0013-la-verifica-in-gazzetta.md).
- **Corte costituzionale**: 8.674 pronunce, 2.902 dichiarazioni di illegittimità
  lette dal dispositivo, archi `DICHIARA_ILLEGITTIMO` nel grafo e 762 voci di
  gold standard.
- **API pubblica** REST, che funziona sul database o sul solo dataset.
- **Sito** con indice, scheda anomalia autoconsistente, lettore norma con
  multivigenza, «Come funziona» e «Dati». Accessibilità WCAG 2.1 AA verificata
  da test che fanno fallire la build.
- **Distribuzione**: bot quotidiano, contatore nazionale, pagina stampa,
  pipeline schedulata che riscarica il delta e apre una pull request con il diff.
- **Dataset derivato** in JSONL e Parquet, con licenze e provenienza nel
  manifesto.

### Misurato

- **103 segnalazioni pubblicate**, tutte di livello 1 e tutte verificate a mano.
  22 di livello 2 e 0 di livello 3 restano nella coda interna, perché la loro
  precisione non è misurata.
- **Accordo 9 su 9** fra le declaratorie lette dai dispositivi della Corte e le
  note di aggiornamento scritte da Normattiva: due fonti indipendenti, ed è
  l'unica precisione misurabile senza revisione umana.
- **Recall sul gold standard**: 4,3% complessivo, 39,8% restringendosi alle
  annotazioni i cui atti sono nel corpus ingerito. I due numeri stanno separati
  perché si alzano in modi diversi — il primo scaricando più corpus, il secondo
  scrivendo controlli migliori.

### Perché il numero di segnalazioni è sceso

Ogni calo qui sotto è stato un miglioramento, e ciascuno è documentato per esteso
in [docs/qualita-fonti.md](docs/qualita-fonti.md).

- **238 → 103** sul livello 1, correggendo sette irregolarità della fonte. La
  più costosa: un solo arco mal ancorato marcava come abrogato il codice del
  processo amministrativo e rendeva false sette modifiche successive regolari.
- **210 → 0** sul livello 3, delimitando il verticale **per atti** invece che per
  parole. «Concessione» sta nel codice dei contratti pubblici e in quello della
  navigazione del 1942: finché il confronto si attivava su qualunque comma
  contenente quella forma, accostava materie che non c'entrano niente
  ([ADR 0009](docs/adr/0009-il-verticale-e-un-elenco-di-atti.md)).
- Zero è la risposta onesta con l'estrattore a regole su cinque atti. Resta
  comunque nella coda interna, perché la precisione non è misurata.

### Corretto

- **L'integrazione continua non era mai partita.** `pnpm` era dichiarato due
  volte — nel workflow e in `packageManager` — e l'azione si rifiutava di
  scegliere. Il badge era rosso dal primo commit e nessuno dei passi
  dichiarati veniva eseguito.
- **La verifica costruiva un sito vuoto.** `LCNT_SNAPSHOT` era un percorso
  relativo che da `apps/web` non puntava a nulla: trentotto test si saltavano
  da soli e il riepilogo sembrava quasi verde. Ora il percorso è assoluto, e
  un test che non si salta mai fallisce se il dataset è vuoto.
- **Un pezzo del dataset non usciva dall'esportazione.** `verticali.json` lo
  scriveva il comando di estrazione, quindi `esporta --dest altrove` produceva
  un dataset incompleto e la pipeline quotidiana non lo aggiornava mai. Ora il
  verticale sta nel database come ogni altra tabella.

### Non ancora fatto

- Revisione esterna del primo lotto da parte di giuristi. Dichiarata sul sito,
  nella pagina Dati.
- **La verifica in Gazzetta Ufficiale c'è, la copertura no.** Il sistema è
  costruito e provato su risposte reali salvate su disco, ma sul corpus attuale
  ha prodotto zero `non-adottato`: gli atti che contengono mandati sono tutti
  molto citati in Gazzetta, e su un atto citato la domanda larga non conclude.
  Finché è così il contatore nazionale continua a misurare **termini scaduti**,
  non attuazioni mancate, e il controllo `attuazione-mancante` continua a non
  produrre segnalazioni. La copertura cresce ampliando il corpus verso le leggi
  poco citate, non allentando la regola.
- Nessuna revisione umana registrata: le percentuali di precisione non esistono
  ancora, e i controlli di livello 1 pubblicano perché deterministici, non
  perché verificati.
