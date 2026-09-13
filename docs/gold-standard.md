# Gold standard: come misuriamo la precisione

La soglia dell'85% ha senso solo se il numero che la attraversa è vero. Questo
documento dice da dove viene quel numero.

---

## Il problema

Non possiamo misurare la precisione su un campione che scegliamo noi, e non
possiamo misurarla su segnalazioni che abbiamo giudicato noi. Servono anomalie
**già annotate da giuristi**, prodotte per altri scopi, che possiamo usare come
verità di riferimento senza averle toccate.

Ce ne sono quattro fonti pubbliche.

---

## 1. Pareri del Consiglio di Stato in sede consultiva

Gli schemi di decreto passano per il parere della Sezione consultiva per gli atti
normativi. Quei pareri indicano esplicitamente incoerenze, rinvii che non
tornano, definizioni divergenti, termini incompatibili.

È di fatto **un dataset annotato da magistrati**, prodotto per un motivo diverso
dal nostro. Un rilievo che dice «l'art. 4 dello schema rinvia a una disposizione
abrogata» è un'anomalia certificata: se il nostro controllo la trova, è un vero
positivo che non abbiamo scelto noi.

Uso: un rilievo diventa un `GoldItem` con `sourceKind: 'consiglio-di-stato'`, gli
URN coinvolti e il controllo che dovrebbe intercettarlo.

## 2. Sentenze di illegittimità costituzionale

Una dichiarazione di illegittimità è una contraddizione **certificata
dall'ordinamento**. Se una norma dichiarata illegittima compare ancora nel testo
vigente, è un'anomalia di livello 1 con una verità di riferimento perfetta.

Gli open data della Corte costituzionale coprono tutte le decisioni dal 1956 e
usano ECLI nativamente.

Uso: `sourceKind: 'corte-costituzionale'`.

## 3. Rimessioni alle Sezioni Unite

Se la Corte di cassazione dichiara un contrasto di giurisprudenza,
**l'ambiguità esiste per definizione**: non serve stabilire se una norma sia
poco chiara, l'ha già stabilito qualcuno con l'autorità per farlo.

Sono la verità di riferimento delle «aree grigie», la categoria che altrimenti
sarebbe la più difficile da validare.

Uso: `sourceKind: 'sezioni-unite'`.

## 4. Circolari interpretative

Ministeri e Agenzia delle Entrate emanano circolari quando il testo non basta.
Una circolare che spiega come applicare un adempimento segnala che
**l'amministrazione ha dovuto chiarire**, e indica dove.

Sono la fonte più rumorosa delle quattro e vanno pesate di conseguenza.

Uso: `sourceKind: 'circolare'`.

---

## Come si misura

```
precisione(controllo) = revisioni CONFERMATA / revisioni totali
```

Le revisioni entrano da due strade:

1. **Campionamento interno.** `lcnt-engine coda --controllo <id> --seme N`
   estrae un campione pseudocasuale con seme. Il seme è nel comando e il campione
   è riproducibile: chi contesta la nostra metrica può rifare lo stesso campione.
   Revisionare «le prime N» misurerebbe l'ordinamento, non il controllo.

2. **Il pulsante «Non è un conflitto»** sul sito. Apre una issue pubblica; la
   risposta viene registrata con `lcnt-engine revisiona <id> <esito>`.

Gli esiti sono quattro, e la distinzione conta:

| Esito                | Significato                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CONFERMATA`         | L'anomalia c'è.                                                                                             |
| `NON_E_UN_CONFLITTO` | I fatti sono giusti, la qualificazione no (rinvio recettizio, norma speciale, delegificazione autorizzata). |
| `ESTRAZIONE_ERRATA`  | I fatti sono sbagliati: abbiamo letto male il testo.                                                        |
| `DA_APPROFONDIRE`    | Il revisore non se la sente di decidere.                                                                    |

`NON_E_UN_CONFLITTO` e `ESTRAZIONE_ERRATA` contano entrambi come non confermate,
ma indicano due lavori diversi: la prima chiede di raffinare la regola, la seconda
di correggere il parser. Tenerle separate è il motivo per cui ci sono quattro
esiti invece di due.

---

## La regola di pubblicazione

Un controllo pubblica se e solo se:

- ha almeno **30 revisioni** registrate, **e**
- la precisione misurata è **≥ 85%**.

Con l'unica eccezione dei controlli **deterministici di livello 1**, che
pubblicano prima delle 30 revisioni perché non hanno un'estrazione
probabilistica alle spalle — e smettono di pubblicare appena la misura li porta
sotto soglia, come tutti.

Un controllo di livello 2 o 3 **non ha quell'eccezione neanche se è
deterministico**. Il controllo sulle fonti secondarie non usa alcun modello e ha
una precisione attesa del 70-85%, perché esiste un caso legittimo che i metadati
non distinguono. «Non usa un modello» e «non sbaglia» sono due cose diverse.

Codice: `packages/engine/src/publication-gate.ts`. I test che lo verificano:
`packages/engine/test/gate.test.ts`.

---

## Cosa misuriamo oggi

Le pronunce della Corte costituzionale sono importate e misurate. Il comando
`lcnt-engine gold valuta` produce **due numeri**, non uno:

```
Annotazioni:            762
  di cui con atti nel corpus: 83

Recall complessivo:     4.3%  (33/762)
Recall sul corpus:      39.8% (33/83)
```

La differenza non è cosmetica. Il recall complessivo mescola due mancanze che si
riparano in modi opposti:

- **l'atto non ce l'abbiamo.** Il corpus ingerito è una frazione di Normattiva,
  e un'annotazione su una legge che non abbiamo scaricato non dice niente sui
  controlli. Si alza scaricando più corpus.
- **l'atto ce l'abbiamo e non l'abbiamo visto.** Questo misura i controlli, ed è
  il numero che deve salire scrivendone di migliori.

Confonderli produce una cifra che sembra un giudizio sul motore e non lo è.

Resta la generosità dichiarata del criterio: una segnalazione «intercetta»
un'annotazione se tocca almeno un URN di atto in comune. **Il recall qui è un
limite superiore**, non una misura stretta, e va letto come tale.

Le due grandezze restano inoltre asimmetriche per costruzione: le pronunce della
Consulta certificano un tipo di contraddizione — il contrasto con la
Costituzione — che nessuno dei controlli attuali cerca. Che il recall su quella
fonte sia basso è un'informazione sul perimetro dei controlli, non un difetto da
correggere gonfiando i numeri.

## Chi fa le revisioni

Chi legge. La differenza che conta non è il titolo del revisore ma l'incarico
che gli si dà: «controlla se vanno bene» produce approvazioni, «trova tutto
quello che non regge» produce informazione. Ogni scheda è costruita per il
secondo incarico — testi originali, query, criteri di risoluzione tutti in
pagina — e il pulsante «Non è un conflitto» apre una issue senza account.

Un comitato ristretto guarda un campione una volta sola. Una segnalazione
esposta con le sue prove resta contestabile per sempre e da chiunque, compreso
chi quella norma la applica ogni giorno e sulla sua materia ne sa più di
qualunque revisore ingaggiato. È il motivo per cui il progetto è open source, e
non un ripiego in attesa di qualcosa di meglio.

Quante revisioni ha raccolto ogni controllo, e quindi quali hanno una
precisione misurata e quali no, sta nella pagina **Dati** del sito. Finché sono
poche, il sito lo dice.
