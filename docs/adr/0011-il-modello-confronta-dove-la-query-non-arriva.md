# 0011 — Il modello confronta, dove la query non arriva

- **Stato:** Accettata
- **Data:** 2026-09-13
- **Modifica:** [ADR 0001](0001-estrazione-piu-query.md), [ADR 0009](0009-il-verticale-e-un-elenco-di-atti.md)

## Contesto

[ADR 0001](0001-estrazione-piu-query.md) dice che il modello estrae campi e la
query decide. È stata la scelta giusta e resta valida per tutto quello che una
query sa descrivere — che è moltissimo: un rinvio a una norma abrogata è un
fatto che si legge nel grafo, e chiunque può rileggerlo.

Ma quella regola ha un costo che finora non abbiamo mai messo per iscritto:
**lascia fuori una categoria intera di contrasti**, quelli in cui due
disposizioni si escludono a vicenda senza condividere una parola.

> «Il responsabile trasmette la documentazione entro trenta giorni dalla
> richiesta.»
>
> «La trasmissione avviene previo parere dell'organo di vigilanza, reso entro
> novanta giorni.»

Non hanno un token in comune, non condividono un concetto del vocabolario, e
nessuna interrogazione le mette in relazione. Una persona che le legge vede il
problema in tre secondi.

Nello stesso periodo [ADR 0009](0009-il-verticale-e-un-elenco-di-atti.md)
delimitava il livello 3 a un elenco di atti, per una ragione buona: senza
vocabolario controllato «concessione» negli appalti e «concessione» nella
navigazione sono la stessa parola e due cose diverse. Ma quel confine, che
protegge il confronto per concetti, non serve a un confronto che legge i due
testi per intero.

## Decisione

**Il confronto lo può fare un modello, a un livello suo, con le sue regole.**

Nasce il **livello 4**, `contrasto-assistito`, e quattro cose lo tengono in
piedi.

**1. Le coppie da esaminare le sceglie il codice.** La selezione è
deterministica e ispezionabile — vigenze sovrapposte, atti diversi, stesso
concetto oppure somiglianza lessicale sopra una soglia — ed è ordinata sempre
allo stesso modo. Il modello non decide cosa guardare: guarda quello che gli
viene messo davanti, e risponde a una domanda sola («un soggetto tenuto a
entrambe può rispettarle entrambe?»).

**2. Ogni conclusione poggia su due citazioni letterali, e il codice le
ricontrolla.** Il modello deve copiare dai due testi le porzioni esatte su cui
si basa. `citazioneVerificata` controlla che compaiano davvero nei testi: se una
non c'è, la segnalazione non nasce. È il controllo che regge l'intero livello —
senza, sarebbe la parte meno affidabile del sito travestita da quella più
solida.

**3. La prosa del modello sta in un campo suo.** `plainLanguage` e `title`
restano generati da template, come su ogni altra scheda. Il ragionamento va in
`assistita`, che esiste **solo** sulle segnalazioni di livello 4: l'assenza di
quel campo è essa stessa un'informazione, e dice che in quella scheda non c'è
una riga di prosa generata da nessuna parte.

**4. La precisione si misura a parte.** Il livello 4 ha la sua riga nella pagina
Dati e il suo cancello di pubblicazione. Non eredita la fiducia guadagnata dai
livelli deterministici, e la confidenza dichiarata dal modello arriva fino alla
scheda: «forse» e «certamente» non vanno nello stesso indice senza distinzione.

In pagina il blocco ha un aspetto diverso da tutto il resto — fondo ocra, che in
questo sito vuol dire «area grigia» — perché chi scorre se ne accorga **senza
leggere**.

### E il corpus si allarga

L'estrazione deontica può girare su **tutti** gli atti ingeriti
(`--tutto-il-corpus`), non solo su quelli di un verticale. Il vocabolario
continua a ricondurre a concetti dove ci riesce, e le proposizioni che restano
fuori da un concetto non alimentano il livello 3 e non lo inquinano: alimentano
il livello 4, che i concetti non li usa.

ADR 0009 resta valida per quello che diceva davvero — il confronto **per
concetti** ha bisogno di un confine — e smette di valere come confine
dell'intero layer semantico.

## Cosa resta vietato

- Chiedere al modello **quale delle due norme debba prevalere**. I criteri di
  risoluzione restano calcolati dal codice sui metadati, e una scheda dice quali
  sono invocabili, non chi vince.
- Far generare al modello `plainLanguage`, `title` o qualunque altro campo che
  su tre livelli su quattro viene da un template.
- Pubblicare una segnalazione di livello 4 senza le citazioni verificate.
- Mandare una segnalazione di livello 4 al bot quotidiano: su quelle piattaforme
  una frase circola senza il suo contesto e senza il suo blocco ocra.

## Conseguenze

- Positiva: il progetto trova una classe di contrasti che prima non vedeva, e
  che è quella che un lettore riconosce come «il problema vero».
- Positiva: il confine fra «fatto registrato» e «confronto assistito» diventa
  una cosa che si vede in pagina, invece di una promessa nel repository.
- Negativa: ogni segnalazione di livello 4 costa una chiamata a un servizio
  esterno. Le coppie sono limitate e ordinate per punteggio, e senza
  `ANTHROPIC_API_KEY` il livello 4 semplicemente non gira — il resto del motore
  funziona identico.
- Negativa: la verifica delle citazioni è grossolana e scarterà anche confronti
  corretti, per esempio quando il modello normalizza una parola citando. È il
  verso giusto in cui sbagliare.
