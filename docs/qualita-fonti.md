# Qualità delle fonti: quello che abbiamo trovato

Gli open data di Normattiva sono una risorsa eccellente e questo progetto non
esisterebbe senza. Hanno però delle irregolarità, e alcune sono capaci di
produrre segnalazioni che **sembrano errori del legislatore e sono errori di
marcatura**.

Questo documento le elenca. Non è una lamentela: è la parte dell'ingegneria che
sta fra un dataset pubblico e un'affermazione pubblica. Ogni caso qui sotto è
stato trovato eseguendo il motore sul corpus vero e leggendo le segnalazioni una
per una — non ipotizzato a tavolino.

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

## Come segnalarci un caso nuovo

Se trovate una segnalazione che dipende da un'irregolarità della fonte e non da
un problema della legge, il pulsante **«Non è un conflitto»** sulla scheda apre
una issue con tutti i riferimenti già dentro. Sono le più utili che riceviamo.
