# 0016 — Quanto costa il progetto si misura, e si pubblica

- **Stato:** Accettata
- **Data:** 2026-09-13

## Contesto

Il progetto usa modelli linguistici in due punti, e in tutti e due costano:
`packages/redazione` scrive gli approfondimenti del blog, il controllo di
livello 4 confronta norme dove la query non arriva
([ADR 0011](0011-il-modello-confronta-dove-la-query-non-arriva.md)).

Finora quel costo non era scritto da nessuna parte. Le conseguenze sono tre, e
nessuna è teorica:

1. Il sito chiede soldi — c'è un bottone per offrire un caffè — senza dire
   quanti ne servono e per cosa.
2. Un contributore che vuole aggiungere un controllo assistito non ha modo di
   sapere se costerà dieci euro l'anno o mille, e quindi o non lo propone o lo
   propone alla cieca.
3. Nessuno può verificare l'affermazione «il grosso del lavoro è
   deterministico». È vera, ma è vera perché lo diciamo noi.

## Decisione

**Ogni chiamata a un modello passa da un punto solo, e quel punto registra.** Il
registro annota data e ora, modello esatto, token in ingresso e in uscita
(quelli di cache separati), a cosa serviva la chiamata, e il costo stimato.

Tre vincoli che rendono il registro affidabile invece che decorativo:

- **Non si può dimenticare di registrare.** Il client del modello è avvolto: chi
  aggiunge un uso nuovo passa di lì per forza. Un registro a cui ci si iscrive a
  mano misura la disciplina di chi scrive il codice, non i consumi.
- **I prezzi stanno in un file solo**, versionato, con la data da cui valgono.
  Sparsi nel codice sarebbero sbagliati entro un mese, e un costo sbagliato è
  peggio di nessun costo.
- **Il registro è un file append-only nella repo**, coerente con
  [ADR 0015](0015-niente-database-in-produzione.md): una riga di consumo è un
  fatto datato, e un fatto datato sta bene in git.

Il costo è **stimato** e va chiamato così ovunque compaia. Il conto vero lo fa
il fornitore, e fra i due ci sono differenze — arrotondamenti, sconti, chiamate
fallite e riprovate. Scrivere «costo» invece di «costo stimato» sarebbe la
solita cifra precisa e non verificabile che questo progetto non pubblica.

## Chi contribuisce, e con cosa

La stessa pagina che pubblica i consumi pubblica **chi ha contribuito**, presi
da GitHub, e dice apertamente cosa misura la classifica: il numero di commit
_non_ è il valore del contributo. Una revisione giuridica che smonta una
segnalazione sbagliata vale più di cento commit di formattazione, e la pagina
deve dirlo invece di lasciar credere il contrario.

Le tre strade per contribuire stanno lì con la stessa dignità: **tecnica**,
**giuridica** — che è quella che al progetto manca di più, perché senza
revisioni umane la precisione non si misura e i controlli restano sotto la
soglia di [ADR 0002](0002-soglia-di-pubblicazione.md) — ed **economica**.

## Motivazioni

1. **Un progetto che pubblica i limiti degli altri pubblica anche i propri
   conti.** Chiedere soldi senza dire quanto si spende sarebbe incoerente con
   tutto il resto del sito.
2. **Il numero rende discutibile una scelta architetturale.** «Usiamo il modello
   solo dove il deterministico non arriva» diventa verificabile: se il costo
   dell'analisi assistita cresce più delle segnalazioni che produce, si vede, e
   si può decidere di smettere.
3. **È il dato che manca a chiunque voglia rifare una cosa simile.** Quanto costa
   tenere in piedi un progetto civico che usa modelli linguistici è una domanda
   che oggi non ha risposte pubbliche.

## Conseguenze

- Positiva: la sostenibilità smette di essere un'opinione.
- Positiva: chi propone un uso nuovo del modello può stimarne il costo prima di
  scrivere il codice.
- Negativa: la stima si discosterà dalla fattura, e qualcuno lo farà notare. È
  il motivo per cui si chiama stima.
- Negativa: pubblicare un consumo che cresce è scomodo. È anche l'unico modo
  perché qualcuno se ne accorga in tempo.
