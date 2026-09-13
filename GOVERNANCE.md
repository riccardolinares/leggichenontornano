# Governo del progetto

Questo documento dice **chi decide cosa**, e soprattutto quali decisioni
nessuno può prendere.

Serve perché il progetto fa affermazioni pubbliche su leggi dello Stato. Un
progetto che pubblica «questa norma non torna» deve poter spiegare, a chi lo
contesta, in base a quale processo quella frase è arrivata online.

---

## Le decisioni che nessuno può prendere

Sono scritte nel codice e verificate da test. Non esiste un permesso, un ruolo o
una maggioranza che le scavalchi: per cambiarle si cambia il codice, e la
modifica è pubblica come tutto il resto.

**La soglia di pubblicazione non si aggira.** Un tipo di controllo pubblica
quando la revisione umana su campione supera l'85% di precisione, con almeno 30
revisioni. Non c'è un pulsante «pubblica comunque», e chi mantiene il progetto
non ne ha uno. La regola sta in
[`publication-gate.ts`](packages/engine/src/publication-gate.ts) e i test in
[`gate.test.ts`](packages/engine/test/gate.test.ts) la verificano.

**Nessun modello linguistico dà verdetti.** Il modello, dove è usato, estrae
campi da un comma alla volta e non vede mai due norme insieme. `AnomalyFinding`
non ha un campo in cui possa entrare una spiegazione generata, e non deve
acquisirlo.

Dal 2026 un modello scrive anche gli articoli del blog, e questo **non** è
un'eccezione a quella regola: riceve una scheda di fatti già stabiliti da query
deterministiche e ci scrive attorno, un controllo automatico rifiuta l'articolo
se contiene una cifra o una citazione che la scheda non sostiene, e la firma in
cima alla pagina dice chi ha scritto le parole. Le condizioni esatte, e cosa
resta vietato, stanno in
[ADR 0010](docs/adr/0010-il-modello-scrive-attorno-ai-fatti.md).

**I limiti si pubblicano.** Quello che il progetto non sa, non copre o non ha
ancora verificato sta sul sito, non in una nota a piè di pagina del repository:
l'elenco degli atti su cui il confronto semantico lavora davvero, quante
revisioni ha raccolto ogni controllo e quindi quali non hanno ancora una
precisione misurata, il fatto che il contatore nazionale misuri termini scaduti
e non attuazioni mancate.

Una proposta che tocchi uno di questi punti non si valuta come una pull request.
Si scrive una **ADR** che argomenti il contrario, e si discute quella.

---

## Chi decide il resto

Il progetto è piccolo e non fingiamo il contrario: oggi c'è un manutentore, e
l'elenco sta in [MAINTAINERS.md](MAINTAINERS.md).

- **Correzioni, test, documentazione, prestazioni**: una pull request, una
  revisione, si unisce.
- **Un controllo nuovo, un verticale nuovo, un cambiamento nell'interfaccia
  pubblica dell'API**: una pull request che spieghi il caso reale, e una
  discussione prima di scrivere il codice se il lavoro è grosso. Nessuno deve
  scoprire a lavoro finito che la strada era un'altra.
- **Una decisione architetturale**: una ADR in [`docs/adr/`](docs/adr). Le ADR
  non si cancellano — si sostituiscono con una nuova che dichiara superata la
  precedente.

Quando due valutazioni giuridiche si contraddicono, non decide chi ha più
commit. Le risposte contrastanti restano entrambe nel gold standard e la
precisione misurata si sposta di conseguenza: è il numero a decidere se il
controllo resta pubblicato.

---

## Come si diventa manutentori

Non c'è una procedura a punti. Chi ha contribuito con continuità, e ha mostrato
di capire perché i vincoli qui sopra esistono, riceve l'invito. Il criterio che
conta più di tutti: **aver corretto qualcosa che avevamo sbagliato**. Cinque dei
dodici difetti documentati in [docs/qualita-fonti.md](docs/qualita-fonti.md)
sono nostri, e trovarne un sesto vale più di una funzionalità nuova.

---

## Cosa succede se il progetto si ferma

È il modo in cui muoiono i progetti civici: non per mancanza di stelle, ma
quando il dataset smette di aggiornarsi e nessuno se ne accorge per otto mesi.

Due difese, entrambe automatiche:

1. La pipeline quotidiana apre una **issue** se fallisce, e una sola alla volta:
   mille issue identiche sono rumore, e il rumore è il modo in cui un progetto
   smette di accorgersi dei guasti.
2. Il dataset derivato è pubblicato in JSONL e Parquet, con licenza aperta, e il
   sito si rigenera da quello. Chiunque può ricostruire il progetto senza
   chiedere niente a nessuno — che è il punto della licenza EUPL.

Se il progetto viene archiviato, il README lo dirà nella prima riga, con la data
dell'ultimo aggiornamento del dataset. Un sito civico che mostra dati vecchi
senza dirlo è peggio di un sito spento.
