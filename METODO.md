# Metodo

> La credibilità è il prodotto. Una segnalazione falsa su una legge distrugge più
> di quanto dieci segnalazioni corrette costruiscano, e il danno è permanente.

Questo documento descrive come una segnalazione nasce, come viene verificata e a
quali condizioni viene pubblicata. È vincolante: il codice lo implementa, la coda
di revisione lo applica, il sito lo mostra.

---

## 1. Cosa questo progetto non fa

Prima di tutto il resto, perché è la parte che qualifica tutto il resto.

- **Non dà consulenza legale.** Nessuna segnalazione è un parere.
- **Non dichiara illegittima o incostituzionale alcuna norma.** L'unico soggetto
  che può farlo è la Corte costituzionale. Quando una pronuncia esiste, la
  citiamo; non ne produciamo di nuove.
- **Non usa un modello linguistico per decidere se due norme si contraddicono.**
  Il modello estrae struttura, il codice giudica. Vedi §4.
- **Non assegna punteggi di qualità legislativa**, non produce classifiche
  politiche, non attribuisce responsabilità a partiti, governi o singoli.
- **Non raccoglie voti dei cittadini.** Trasformerebbe un osservatore in un
  attore politico e renderebbe ogni segnalazione contestabile per motivi
  estranei ai dati.
- **Non tratta l'assenza di segnale come una promessa.** Che una norma non
  compaia in questo sito non significa che sia coerente: significa che i
  controlli attivi non hanno trovato nulla. L'interfaccia lo dice a chiare
  lettere.

## 2. L'unità di valore è la singola anomalia

Il prodotto non è la piattaforma: è la singola anomalia. Un oggetto
autoconsistente, condivisibile, verificabile, con prove tracciabili. Ogni
anomalia ha:

- un identificatore stabile e un URL citabile, incollabile in una memoria
  difensiva;
- i testi originali delle norme coinvolte, mostrati **sopra** ai campi estratti;
- la regola che l'ha generata, mostrata in chiaro come query, non parafrasata in
  prosa;
- le finestre di vigenza delle norme coinvolte e la loro intersezione;
- la riga "possibile risoluzione", che compare **sempre**, anche quando dice che
  nessun criterio classico (specialità, posteriorità, gerarchia) si applica;
- un pulsante "Non è un conflitto" che apre una issue pubblica.

## 3. Tassonomia dei controlli

| Livello | Tipo                   | Metodo                                                     | Precisione attesa |
| ------- | ---------------------- | ---------------------------------------------------------- | ----------------- |
| 1       | Antinomia formale      | Attraversamento del grafo, zero AI                          | ~100%             |
| 1       | Rinvio non attuato     | Grafo + verifica di pubblicazione in Gazzetta Ufficiale     | ~100%             |
| 2       | Gerarchia e competenza | Regole su metadati di fonte + giurisprudenza costituzionale | 70-85%            |
| 3       | Antinomia sostanziale  | Estrazione deontica + query                                 | 50-80%            |
| 3       | Area grigia            | Estrazione definizioni + segnali giurisprudenziali esterni  | variabile         |

**Si ottimizza per precisione, non per recall.** Un controllo che trova poco ed è
sempre giusto vale più di un controllo che trova molto e sbaglia una volta su
cinque.

## 4. Il metodo per il layer semantico: estrazione, poi query

Il modo sbagliato: dare due testi a un modello e chiedergli se si contraddicono.
Output plausibile, non verificabile, non riproducibile, accuratezza non
misurabile.

Il modo implementato: **il modello estrae struttura, una query trova la
contraddizione.**

Per ogni comma si estrae una proposizione normalizzata con questi campi:

- soggetto / fattispecie (chi, in quali circostanze)
- modalità deontica (obbligo, divieto, permesso, potere, onere)
- oggetto della condotta
- termine, se presente
- conseguenza o sanzione
- condizioni ed eccezioni
- ambito di applicazione
- URN, comma, finestra di vigenza

A questo punto la contraddizione non è un giudizio, è un `JOIN`:

```
stessa modalità deontica
∧ stesso soggetto (via vocabolario controllato)
∧ fattispecie sovrapposta
∧ finestre di vigenza intersecanti
∧ valore divergente
```

Tre conseguenze, tutte volute:

1. **È riproducibile.** Stessa estrazione, stessa query, stesso risultato.
2. **L'errore del modello resta confinato all'estrazione**, che si valida a
   campione con una metrica onesta, invece di diffondersi in un verdetto opaco.
3. **La segnalazione è ispezionabile.** Mostriamo le due proposizioni con i loro
   URN: chiunque può dirci se abbiamo sbagliato l'estrazione o se il conflitto è
   reale. Sono due errori diversi e vanno distinti.

### 4.1 Il filtro temporale non è opzionale

Due norme mai vigenti contemporaneamente non sono in contraddizione. Senza date
di vigenza sulle proposizioni questa categoria di falsi positivi domina l'output.
Il motore scarta ogni coppia la cui intersezione di vigenza è vuota, **prima** di
qualunque altro confronto.

### 4.2 Matching della fattispecie

Embedding come **richiamo**, per generare candidati. Vocabolario controllato come
**filtro**, per decidere. Mai embedding da soli: «impresa» negli appalti e
«impresa» nel fisco sono lo stesso token e due cose diverse.

Per questo il layer semantico si attiva **un verticale alla volta**, ognuno con
il suo vocabolario di poche centinaia di concetti (`data/vocabolari/`). Il layer
deterministico, al contrario, gira su tutto il corpus fin dall'inizio.

## 5. Validazione e gold standard

Servono metriche reali, non impressioni. Quattro fonti pubbliche di anomalie già
annotate da giuristi:

1. **Pareri del Consiglio di Stato in sede consultiva** sugli schemi di decreto:
   indicano esplicitamente incoerenze, rinvii che non tornano, definizioni
   divergenti. È di fatto un dataset annotato da magistrati.
2. **Sentenze di illegittimità costituzionale**: contraddizioni certificate
   dall'ordinamento.
3. **Rimessioni alle Sezioni Unite**: se la Cassazione dichiara un contrasto,
   l'ambiguità esiste per definizione.
4. **Circolari interpretative** di ministeri e Agenzia delle Entrate: segnalano
   dove la pubblica amministrazione ha dovuto chiarire perché il testo non
   bastava.

## 6. Soglia di pubblicazione: 85%

> Un tipo di controllo viene pubblicato soltanto quando la revisione umana su
> campione supera l'**85% di precisione**. Sotto soglia, le sue segnalazioni
> restano nella coda interna e non compaiono sul sito pubblico.

Questa regola è codificata, non dichiarata: `packages/engine` calcola la
precisione per tipo di controllo a partire dalle revisioni umane registrate e il
gate `publicationGate` esclude dall'esportazione pubblica ogni anomalia il cui
tipo non ha superato la soglia. Il sito mostra la precisione corrente di ogni
tipo nella pagina **Dati**, compresi i tipi sotto soglia e il perché non sono
pubblicati.

La dimensione minima del campione è 30 revisioni per tipo; sotto quella soglia un
tipo è `non misurato` e resta non pubblicato, perché una precisione del 100% su
tre casi non è una precisione.

Prima del lancio pubblico, il primo lotto di segnalazioni va **demolito**, non
validato, da due o tre giuristi esterni. Si pubblica ciò che sopravvive.

## 7. Uso delle fonti

- Attribuzione **CC BY 4.0 a Normattiva** visibile su ogni pagina che mostra
  testo normativo, non nascosta nel footer in grigio chiaro.
- **Disclaimer di non ufficialità** su ogni pagina che mostra testo normativo: la
  banca dati Normattiva non ha carattere di ufficialità; l'unico testo ufficiale
  è quello pubblicato sulla Gazzetta Ufficiale, che prevale in caso di
  discordanza.
- **Nessun harvesting aggressivo**: si usano le API di export e le collezioni
  predefinite previste da Normattiva, con rate limiting e cache locale. Il client
  in `packages/corpus` non ha un percorso di codice che faccia scraping HTML del
  portale di consultazione.
- Il corpus di legittimità della Corte di cassazione **non è disponibile in
  bulk**: il layer giurisprudenziale di legittimità è trattato come
  *citation-based*, si linkano gli estremi e non si ospita il corpus.
