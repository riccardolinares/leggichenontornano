# Qualità delle fonti: quello che abbiamo trovato

Gli open data di Normattiva sono una risorsa eccellente e questo progetto non
esisterebbe senza. Hanno però delle irregolarità, e alcune sono capaci di
produrre segnalazioni che **sembrano errori del legislatore e sono errori di
marcatura**.

Questo documento le elenca. Non è una lamentela: è la parte dell'ingegneria che
sta fra un dataset pubblico e un'affermazione pubblica. Ogni caso qui sotto è
stato trovato eseguendo il motore sul corpus vero e leggendo le segnalazioni una
per una — non ipotizzato a tavolino.

Gli ultimi cinque casi (§8-§12) **non sono difetti della fonte: sono nostri**.
Stanno qui lo stesso, perché si sono manifestati allo stesso modo — leggendo
l'output — e perché un progetto che elenca gli errori altrui e tace i propri
non è quello che vogliamo essere.

---

## 1. La narrativa della modifica nomina un atto diverso dall'ancoraggio

**Cosa succede.** Una `<textualMod>` dice, nel suo `nakn:text`:

> ha disposto (con l'art. 1, comma 2) l'abrogazione del D.L. 8 marzo 2020, n. 11

mentre il suo `<destination href>` punta a
`urn:nir:stato:decreto.legislativo:2010-07-02;104`, cioè al **codice del processo
amministrativo**.

**Cosa produceva.** Quell'unico arco marcava come abrogato il codice del processo
amministrativo. A cascata, sette modifiche successive perfettamente regolari
diventavano «modifica a una norma già abrogata»: sette segnalazioni false su
leggi vere, tutte discendenti da un arco solo.

**Cosa facciamo.** `parseActCitation` ricostruisce l'URN dalla citazione scritta
nel testo e lo confronta con l'ancoraggio. Quando divergono l'arco nasce a
**bassa confidenza** e i controlli di livello 1 lo ignorano. Non scegliamo quale
dei due abbia ragione: non lo sappiamo, e fingere di saperlo sarebbe lo stesso
errore con un altro nome.

Codice: `packages/akn-parser/src/citations.ts`,
`packages/corpus/src/graph/build-relations.ts`.

---

## 2. I `<ref>` di un elenco sono ancorati all'atto nominato prima

**Cosa succede.** La l. cost. 22 novembre 1967, n. 2, all'art. 7, abroga

> l'articolo 3, primo comma, della legge costituzionale 9 febbraio 1948, n. 1;
> **gli articoli 3, 4, 10 della legge costituzionale 11 marzo 1953, n. 1**

I tre `<ref>` di «3, 4, 10» sono ancorati alla **l. cost. 1/1948**, che di
articoli ne ha quattro.

Lo stesso, in forma diversa, nella l. 23 giugno 2014, n. 89:

> Casi di esclusione dall'obbligo di tracciabilità di cui alla legge 13 agosto
> 2010, n. 136 **Art. 19, comma 1, lettera a), del D.Lgs. 163/2006**

Qui l'atto dell'ancoraggio è giusto (la l. 136/2010) ma il frammento `art_19`
appartiene al d.lgs. 163/2006, nominato dopo.

**Cosa produceva.** «La l. cost. 2/1967 rinvia all'art. 10 della l. cost. 1/1948,
che non esiste» e «la l. 89/2014 rinvia all'art. 19 della l. 136/2010, che non
esiste». Entrambe vere come descrizione del file XML, entrambe false come
affermazioni sulla legge.

**Cosa facciamo.** Un rinvio con bersaglio **a livello di articolo** nasce a
bassa confidenza. L'atto resta affidabile, l'articolo no. Il controllo
`rinvio-ad-articolo-inesistente` di conseguenza non produce nulla su questa
sorgente, e la pagina Dati lo dice.

Codice: `referenceConfidence` in `packages/corpus/src/graph/build-relations.ts`.

---

## 3. I rinvii dentro le note redazionali non sono rinvii normativi

**Cosa succede.** Le note di Normattiva hanno la forma

> Art. 40: - Per la legge 9 marzo 1989, n. 86 si veda…

dove «art. 40» è un articolo **dell'atto che ospita la nota**, non dell'atto
citato. Sono `<ref>` a tutti gli effetti, dentro un `<authorialNote>`.

**Cosa produceva.** «La l. 146/1994 rinvia all'art. 40 della l. 86/1989, che non
esiste». La l. 86/1989 ha quattordici articoli; l'art. 40 è della legge che
ospita la nota.

**Cosa facciamo.** Il parser marca i rinvii dentro `<authorialNote>`
(`inNote: true`) e il grafo li registra con `origin: 'nota'` e confidenza bassa.
Restano navigabili, non fondano segnalazioni.

Codice: `collectReferences` in `packages/akn-parser/src/akn.ts`.

---

## 4. Il nome del file e il `FRBRExpression` dichiarano date diverse

**Cosa succede.** Il file `1953-03-14_053C0001_VIGENZA_1989-01-17_V2.xml`
contiene un `FRBRExpression/FRBRdate` con valore `1967-12-10`, cioè la data della
versione precedente.

**Cosa produceva.** Versioni fuori ordine, finestre di vigenza sbagliate, e di
conseguenza risposte sbagliate alla domanda «cosa diceva questo articolo a questa
data» — che è la domanda centrale del progetto.

**Cosa facciamo.** La data del **nome del file** vince, perché è la chiave con cui
Normattiva stessa indicizza la versione. La discordanza viene registrata nel campo
`dateConflict` della versione e **mostrata nel lettore norma**: è un dato sulla
qualità della fonte e non va perso in silenzio.

Codice: `buildTimeline` in `packages/akn-parser/src/multivigenza.ts`.

---

## 5. Alcuni codici non usano `<article>`: un allegato per articolo

**Cosa succede.** Tredici dei quaranta atti della collezione «Codici» — fra cui il
**codice civile** e il **codice della navigazione** — non contengono elementi
`<article>`. Il corpo dell'atto è il decreto di approvazione (due o tre articoli)
e il codice vero sta negli allegati, uno per articolo, con il numero
nell'attributo `name` del `<doc>`:

```xml
<doc name="Codice civile-art. 1"><mainBody><paragraph>…
```

**Cosa produceva.** Il codice civile risultava avere **due** articoli invece di
2969. Ogni rinvio a un suo articolo sembrava un rinvio nel vuoto: il modo più
rapido per riempire il sito di segnalazioni false su una legge che tutti
conoscono.

**Cosa facciamo.** Il parser riconosce questa forma e ricostruisce gli articoli
dal nome del `<doc>`. Un atto può così avere due numerazioni — quella del decreto
di approvazione e quella del codice allegato — e la più numerosa viene marcata
come **principale**: chi chiede «l'art. 1 del codice civile» vuole «Le persone
fisiche», non «È approvato il testo del Codice civile».

Codice: `articleFromDocName` e `markPrincipal` in `packages/akn-parser/src/akn.ts`.

---

## 6. Il tipo di atto compare in due grafie nello stesso file

**Cosa succede.** I path AKN usano `decreto_legislativo` nel corpo e
`decretoLegislativo` nel preambolo. Lo stesso atto, due grafie.

**Cosa produceva.** Niente di visibile, che è il problema: i riferimenti scritti
nella grafia non gestita non trovavano mai l'atto citato e sparivano dal grafo
senza un errore. Silenzio, non rumore — il tipo di guasto che non si nota.

**Cosa facciamo.** `normalizeActType` gestisce entrambe.

Codice: `packages/corpus/src/graph/href.ts`.

---

## 7. Entità XML oltre il limite predefinito del parser

**Cosa succede.** Il d.lgs. 50/2016 è un file da 3 MB con decine di migliaia di
entità XML legittime. Il tetto predefinito di `fast-xml-parser` è 1000 espansioni
totali, pensato contro l'attacco «billion laughs».

**Cosa produceva.** L'ingestione si fermava con un'eccezione sui file più grandi,
cioè esattamente sui codici.

**Cosa facciamo.** Il tetto sul **numero** di espansioni è alzato — è comunque
limitato linearmente dalla dimensione del file — mentre restano bassi quelli che
contano davvero contro l'attacco: la **profondità** di annidamento e la lunghezza
massima di una singola espansione.

Codice: `packages/akn-parser/src/xml.ts`.

---

## 8. Le parole del dominio non delimitano il dominio

**Cosa succede.** Non è un difetto della fonte: è un difetto nostro, scoperto
leggendo la fonte. Il layer semantico attivava il confronto su ogni comma che
contenesse una forma del vocabolario del verticale. Ma «concessione»,
«collaudo», «bando», «lavori pubblici» sono italiano giuridico comune.

**Cosa produceva.** Coppie fra il codice della navigazione del 1942 e il codice
della strada, presentate come divergenze di termini in materia di appalti. Su
questo corpus, 210 segnalazioni di livello 3 di cui quasi nessuna in materia.

**Cosa facciamo.** Ogni verticale dichiara il proprio corpus per URN e
l'estrazione legge solo quegli atti. Il vocabolario resta, per distinguere
fattispecie **dentro** un dominio già delimitato. Vedi
[ADR 0009](adr/0009-il-verticale-e-un-elenco-di-atti.md).

Codice: `packages/engine/src/deontic/vocabulary.ts`, `data/vocabolari/*.json`.

---

## 9. «Stesso soggetto» che non era il soggetto

**Cosa succede.** L'estrattore a regole risolveva il concetto del soggetto sul
soggetto della frase e, se non trovava niente, **ripiegava sull'intera frase**.
Sembrava recall gratuito.

**Cosa produceva.** La regola pubblicata del controllo di livello 3 dice «stesso
soggetto»; con il ripiego diventava «le due frasi nominano lo stesso concetto da
qualche parte». Il risultato più chiaro: l'obbligo del *garante* di comunicare
entro trenta giorni (d.P.R. 207/2010, art. 133) accoppiato al termine di
operatività della *garanzia* (d.lgs. 163/2006, art. 113), perché entrambe le
frasi nominano la stazione appaltante.

**Cosa facciamo.** Il concetto del soggetto si risolve solo sul soggetto. Il
concetto della frase resta, nel campo che gli spetta (`scope`). La divergenza
fra regola pubblicata e codice eseguito è il difetto che questo progetto non può
permettersi: se la regola sotto la scheda non è la query che gira, la scheda
mente.

Codice: `packages/engine/src/deontic/rule-based.ts`.

---

## 10. La citazione dentro il titolo di un altro atto

**Cosa succede.** Nel dispositivo di una pronuncia della Corte costituzionale il
titolo dell'atto colpito è virgolettato, e dentro quel titolo può esserci la
citazione di **un'altra** norma:

> Dichiara l'illegittimità costituzionale della deliberazione legislativa
> statutaria adottata […] dal Consiglio regionale della Regione Marche e recante
> "Disciplina transitoria in attuazione dell'articolo 3 della **legge
> costituzionale 22 novembre 1999, n. 1**".

**Cosa produceva.** L'unica citazione datata della frase sta dentro il titolo.
Presa per buona, il grafo diceva che l'art. 3 di una legge costituzionale
**vigente** era stato dichiarato illegittimo. Un arco, e la cosa più dannosa che
questo progetto possa dire.

**Cosa facciamo.** I titoli — parentesi, virgolette caporali, virgolette dritte
— si rimuovono prima di cercare la norma. La stessa rimozione toglie anche il
rumore innocuo: i titoli dei codici citano le direttive europee che attuano.

Codice: `packages/corpus/src/consulta/dispositivo.ts`.

---

## 11. «1° ottobre» non è una data, per un'espressione regolare distratta

**Cosa succede.** Nei testi normativi italiani il primo del mese si scrive con il
marcatore ordinale: «decreto-legge 1° ottobre 2007, n. 159». L'espressione che
riconosce le citazioni chiedeva una o due cifre seguite da uno spazio.

**Cosa produceva.** Niente di visibile, che è sempre il problema. Su una
pronuncia della Corte costituzionale la prima citazione spariva e la
declaratoria di illegittimità finiva sulla **legge di conversione** invece che
sul decreto-legge. Nel corpus ingerito la forma compare in oltre quattromila
articoli.

**Cosa facciamo.** L'espressione accetta il marcatore ordinale. In più, nel
dispositivo, tutto ciò che segue la formula «convertito, con modificazioni,
nella legge…» viene ignorato: la legge di conversione non è mai la norma caduta.

Codice: `packages/akn-parser/src/citations.ts`,
`packages/corpus/src/consulta/dispositivo.ts`.

---

## 12. `limitatamente a\b` non corrisponde mai a «limitatamente alle parole»

**Cosa succede.** Lo stesso inciampo di `/\bpuò\b/` sull'accento, con un'altra
lettera: fra la «a» di «limitatamente a» e la «l» di «alle» non c'è alcun
confine di parola, e l'espressione che riconosce le declaratorie **parziali** non
scattava.

**Cosa produceva.** «Dichiara l'illegittimità costituzionale dell'art. 287,
comma 1, […] limitatamente alle parole "rilasciato dall'ispettorato"» veniva
registrata come declaratoria **totale**: cioè come se la norma fosse caduta per
intero, quando invece resta in vigore con un contenuto diverso.

**Cosa facciamo.** Il confine finale sta su ciascuna alternativa che lo
sopporta, non sul gruppo. Il caso è in `packages/corpus/test/consulta.test.ts`,
con il testo reale che lo ha rivelato.

---

## Un controllo che abbiamo deciso di non scrivere

Vale la pena registrare anche questo, perché la tentazione era forte.

Con le declaratorie della Corte costituzionale nel grafo, il controllo ovvio è:
«questo comma è stato dichiarato illegittimo e il testo multivigente lo pubblica
ancora come vigente». Sul corpus ingerito il candidato c'era, ed era di quelli
che circolano: l'art. 2, comma 61 del d.l. 225/2010, la norma interpretativa
sulla prescrizione degli interessi bancari, dichiarata illegittima dalla
sentenza 78/2012 e tuttora leggibile nel testo dell'articolo.

Poi abbiamo letto l'articolo per intero, e in coda c'era questo:

> AGGIORNAMENTO (10) La Corte Costituzionale, con sentenza 13 - 16 febbraio
> 2012, n. 22 […] ha dichiarato "l'illegittimita' costituzionale dell'articolo
> 2, comma 2-quater, del decreto-legge 29 dicembre 2010, n. 225…"

Normattiva **annota le declaratorie**. Non le cancella dal testo — e fa bene,
perché il testo storico serve — ma le registra. Una segnalazione che dicesse
«nessuno ve lo dice» sarebbe falsa, e il primo giurista che la leggesse se ne
accorgerebbe in dieci secondi. Il controllo non esiste.

Resta un problema vero, ma è di lettura, non di legge: la nota sta in fondo a un
articolo che può essere lunghissimo, mentre il comma si legge da solo. È un
problema che si risolve mostrando meglio, non segnalando: il lettore norma porta
le declaratorie in una sezione propria, con le parole del dispositivo, sopra il
grafo.

E la scoperta ha prodotto qualcosa che vale più del controllo: **due fonti
indipendenti** che dicono la stessa cosa. Il comando
`antinomia-corpus consulta verifica` confronta ciò che abbiamo letto nei
dispositivi della Corte con ciò che Normattiva annota negli atti colpiti.
Sull'ingestione corrente l'accordo è **9 su 9 per gli archi ad alta
confidenza**. Nessuna delle due fonti deriva dall'altra, quindi non è un
controllo circolare: è l'unica precisione che possiamo misurare senza revisione
umana, e va rimisurata a ogni aggiornamento del corpus.

---

## Come segnalarci un caso nuovo

Se trovate una segnalazione che dipende da un'irregolarità della fonte e non da
un problema della legge, il pulsante **«Non è un conflitto»** sulla scheda apre
una issue con tutti i riferimenti già dentro. Sono le più utili che riceviamo.
