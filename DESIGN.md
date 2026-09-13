# Regole di design

Questo documento esiste perché le decisioni visive di questo progetto non sono
gusto: discendono tutte da una cosa sola, e senza scriverla ogni modifica
ricomincia da capo la stessa discussione.

> **La credibilità è il prodotto.** Una segnalazione falsa su una legge
> distrugge più di quanto dieci segnalazioni corrette costruiscano, e il danno è
> permanente.

Da qui in poi, ogni regola è una conseguenza di quella frase. Dove una regola
ammette eccezioni, l'eccezione è scritta accanto: una regola senza eccezioni
dichiarate è una regola che verrà aggirata in silenzio.

---

## 1. Il testo di legge non è contenuto del sito

Il testo normativo citato è **prova**, non materiale editoriale. Si legge come
un documento, non come un post.

- Testo normativo in **serif** (Newsreader). Interfaccia in **grottesco**
  (Archivo). La distinzione non è decorativa: dice al lettore quali parole sono
  della legge e quali sono nostre.
- Le citazioni sono **letterali**. Non si accorciano nel mezzo, non si
  parafrasano, non si «puliscono». Se una citazione è troppo lunga si taglia
  dalla fine e si segna il taglio.
- **Niente prosa generata da un modello** che assomigli a testo normativo o a un
  verdetto. Quello che compare nel sito o è testo citato alla lettera, o è un
  campo del dataset, o è un template scritto a mano nel repository.

## 2. Ogni numero porta con sé il suo limite

Un numero condiviso viaggia **senza la sua pagina**: finisce in una chat, in una
slide, in un titolo. Quello che gli sta attorno deve reggere da solo.

- Ogni cifra pubblicata è **calcolata dal dataset** al momento della
  generazione. Nessuna cifra scritta a mano: il giorno che il corpus cambia, una
  cifra a mano diventa falsa senza che nessuno se ne accorga.
- Accanto alla cifra sta **cosa non dice**, nello stesso blocco e nello stesso
  corpo di testo. Non in nota, non in grigio più chiaro, non più piccolo:
  rimpicciolire la riserva è il modo tipografico di dire che conta meno.
- Le date di riferimento vengono dal dataset (`knownAt` del manifest), non
  dall'orologio della build. Due ricostruzioni dello stesso dataset devono dare
  le stesse cifre.
- Formato italiano: virgola decimale, separatore delle migliaia solo da cinque
  cifre in su (`1512`, ma `21.546`). Si usa `Intl.NumberFormat('it-IT')`, non si
  formatta a mano.

## 3. I numeri stanno dentro le frasi — di regola

Un numero dentro una frase si **legge**; una griglia di metriche si **guarda**.
Una pagina che apre con sei riquadri non dice cosa contiene il sito, dice
«guarda quanti dati abbiamo».

**La prima eccezione, dichiarata:** la griglia (`.griglia-cifre`) è la forma
giusta quando le cifre sono **omogenee e destinate al confronto** — stessa
unità, stesso significato — e il lettore le sta scorrendo per trovarne una, non
per capire cosa dicono.

**La seconda, che è l'apertura della home** (`.cifre-forti`). La regola qui ha
dovuto cedere a un fatto: la home apriva con una frase e quattro paragrafi, era
scritta bene, e chi arrivava non la leggeva. Su un sito che parla di leggi
nessuno concede sei righe di fiducia prima di sapere se c'è qualcosa di grosso.

Quello che resta, e che è il vincolo vero, è che **una cifra non sta mai da
sola**: sotto ogni numero c'è la riga che dice cosa misura, e il numero è un
collegamento al posto dove è spiegato con il suo limite accanto. Un numero
isolato è uno slogan; un numero che porta alla propria smentita possibile è
un'affermazione. Lo verifica un test, non la buona volontà.

Le cifre dell'apertura sono **quattro**, non sei: alla quinta non se ne ricorda
nessuna.

Il criterio pratico: _se togliendo la griglia il testo resta comprensibile, la
griglia era decorazione. Se il lettore deve confrontare la prima cifra con la
quinta, la griglia sta facendo il suo lavoro._

La griglia resta comunque sobria — nessun riquadro, nessuna ombra, una riga di
separazione — perché una griglia con la cornice diventa un cruscotto, e un
cruscotto promette un'analisi che qui non c'è.

## 4. Accessibilità: è un test che fallisce, non un proposito

Gli utenti potenziali stanno nella pubblica amministrazione. Una violazione WCAG
2.1 AA è un difetto come un altro e blocca la build.

- Contrasto: **4,5:1** per il testo, **3:1** per gli elementi non testuali.
  Nessuna eccezione, nemmeno per il testo «secondario».
- Ogni regola di axe è attiva. Se una violazione è un falso positivo si
  documenta in `e2e/accessibilita.spec.ts` con il motivo — non si silenzia.
- Quello che si vede deve essere anche annunciato: `aria-current` sulla pagina
  corrente, `role="status"` sulle conferme, `<caption>` e `<th>` su ogni tabella.
- Una zona che scorre riceve il fuoco (`tabIndex`) e un nome accessibile.
  Altrimenti da tastiera è irraggiungibile.
- Il sito funziona **senza JavaScript**. Il JavaScript aggiunge comodità, non
  contenuto.

## 5. Niente di terze parti nelle pagine

Nessun widget, nessun font remoto oltre a quelli serviti da noi, nessun
tracciante, nessun bottone social ufficiale. Caricare codice di qualcun altro su
una pagina che dice quali leggi una persona sta leggendo è una riga da non
superare. La condivisione sono collegamenti normali, e il foglio di sistema del
telefono dove c'è.

## 6. I colori dicono una cosa sola ciascuno

| Colore                  | Significato                                   |
| ----------------------- | --------------------------------------------- |
| verderame `--verderame` | l'unico colore interattivo: è un collegamento |
| ossido `--ossido`       | antinomia, gravità alta, cifra che fa notizia |
| ocra `--ocra`           | area grigia, riserva, limite dichiarato       |
| inchiostro              | testo                                         |

Un colore che significa due cose non significa niente. In particolare: il
verderame non si usa per decorare, e l'ossido non si usa per «dare enfasi».

## 7. Gli URL sono il prodotto

Chi usa questo sito incolla link in una memoria, in una determina, in un
articolo. Lo schema degli URL è API pubblica: vedi
[ADR 0008](docs/adr/0008-url-come-prodotto.md). In breve: l'URN in chiaro, i
parametri non creano pagine nuove, il canonical punta sempre alla pagina senza
parametri, e un URL pubblicato non si rimuove.

## 8. Le anteprime social

Sono la prima — e spesso l'unica — cosa che qualcuno vede: arrivano in una chat
dentro una conversazione che parla d'altro, e hanno due secondi e un pollice.

- **Una cosa sola per immagine**: una cifra e una frase che dice di cosa è la
  cifra. Il resto sta nella pagina.
- **Fondo scuro.** Le anteprime scorrono dentro interfacce chiare: un fondo
  inchiostro si stacca, un fondo carta si confonde con la chat.
- Generate dal codice, mai file statici: un'immagine versionata invecchia in
  silenzio il giorno che la palette cambia.
- L'attribuzione in basso dice la **fonte giusta**: Normattiva CC BY 4.0 per il
  corpus, Corte costituzionale CC BY-SA 3.0 per le decisioni. Attribuire una
  sentenza alla banca dati sbagliata è un errore di licenza, non di stile.
- Regola sulla tentazione: l'anteprima è il punto in cui esagerare rende di più.
  È anche il punto in cui l'esagerazione è più difficile da correggere, perché
  viaggia. «Giorni di ritardo» e non «provvedimenti mai adottati».

## 9. Come si scrive

- **In italiano**, anche nel codice: nomi di funzione, commenti, messaggi.
- **Si dà del tu.** Il sito lo legge una persona alla volta, e il voi la mette
  in mezzo a una folla che non c'è. Vale per le pagine, per i moduli, per i
  messaggi di errore, per i modelli di issue e per questi documenti. Fanno
  eccezione le citazioni alla lettera — testi di legge, dispositivi della
  Corte, licenze — che si riportano come sono. Un test end-to-end scorre le
  pagine e fallisce se ci trova le forme del voi.
- **Un limite si dice dal lato di quello che si può fare.** Il perimetro non
  cambia, cambia da che parte è detto: «la formula esatta è Y» al posto di «non
  scrivere X», «su cosa puoi contare» al posto di «cosa non facciamo». Un
  elenco di divieti insegna a diffidare prima ancora di aver letto qualcosa, e
  non dice mai a cosa serve quello che si sta guardando.
- I commenti dicono **perché**, non cosa. Un commento che ripete la riga sotto è
  rumore; un commento che spiega quale guasto quella riga previene è
  documentazione.
- Niente esclamativi, niente maiuscolette per enfasi, niente emoji
  nell'interfaccia.
- Quando il progetto non sa una cosa, lo scrive. «Non lo sappiamo» è una risposta
  che si può pubblicare; una risposta approssimata non lo è.

---

## Quando una regola va cambiata

Non con una pull request che la aggira: con una **ADR** in `docs/adr/` che
argomenti il contrario e che resti leggibile fra due anni. Le regole di questo
file valgono finché non c'è un documento che spiega perché non valgono più.
