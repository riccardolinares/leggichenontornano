# Metodo

> La credibilità è il prodotto. Una segnalazione falsa su una legge distrugge più
> di quanto dieci segnalazioni corrette costruiscano, e il danno è permanente.

Questo documento descrive come una segnalazione nasce, come viene verificata e a
quali condizioni viene pubblicata. È vincolante: il codice lo implementa, la coda
di revisione lo applica, il sito lo mostra.

---

## 1. Su cosa si può contare

Prima di tutto il resto, perché è la parte che qualifica tutto il resto.

- **Ogni segnalazione si può rifare da soli.** Regola in chiaro sulla scheda,
  dataset scaricabile, stesse righe a ogni riesecuzione.
- **I testi originali stanno sempre in pagina**, alla lettera e con la loro data
  di vigenza.
- **Chi ha fatto il confronto è scritto in ogni scheda.** Ai livelli 1-3 una
  query su date e relazioni; al livello 4 un modello, dichiarato come tale con
  la sua confidenza e le citazioni che il codice ha verificato (§4 e ADR 0011).
- **Le pronunce della Corte sono riportate con le sue parole.** Dichiarare
  illegittima una norma spetta a lei; collegare le sue decisioni al testo che
  colpiscono è quello che facciamo noi.
- **Parliamo di testi, non di partiti.** Nessun punteggio di qualità
  legislativa, nessuna classifica, nessuna responsabilità attribuita a governi o
  persone.
- **Si contesta con gli argomenti, non con i voti.** Ogni scheda si smonta
  indicando dove sbaglia, e quella risposta cambia la precisione misurata.
- **Sappiamo sempre dire fin dove siamo arrivati**, e l'interfaccia lo dice a
  chiare lettere: quali controlli girano, su quanti atti, con quale precisione.

Questo sito non fornisce consulenza legale.

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

| Livello | Tipo                   | Metodo                                                      | Precisione attesa |
| ------- | ---------------------- | ----------------------------------------------------------- | ----------------- |
| 1       | Antinomia formale      | Attraversamento del grafo, zero AI                          | ~100%             |
| 1       | Rinvio non attuato     | Grafo + verifica in Gazzetta Ufficiale, mandato per mandato | ~100%             |
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

### 4.3 Il verticale è un elenco di atti

Il vocabolario da solo non basta a delimitare un dominio, e averlo creduto ha
prodotto duecento segnalazioni sbagliate prima che ce ne accorgessimo. Il motivo
è che nell'italiano giuridico quasi nessuna parola di una forma sola appartiene
a un dominio solo: «concessione» sta nel codice dei contratti pubblici e nel
codice della navigazione, «collaudo» negli appalti e nel collaudo dei veicoli,
«lavori pubblici» in un secolo di leggi di conversione. Attivare il confronto su
qualunque comma che contenga una di quelle forme significa confrontare norme di
materie diverse, in silenzio.

Ogni verticale dichiara quindi il proprio confine **per atti**, con gli URN delle
norme fondative del dominio, e l'estrazione legge solo i commi di quegli atti.
Il confine si allarga di un passo verso i regolamenti che _attuano_ quelle norme,
e non oltre: un atto che _modifica_ un codice è quasi sempre un omnibus, e la sua
modifica sta già dentro il testo multivigente del codice.

Il prezzo è dichiarato: **il recall del livello 3 è limitato dalle radici
dichiarate.** Una divergenza fra il codice dei contratti pubblici e la legge sul
procedimento amministrativo oggi non la vediamo. Preferiamo non vederla piuttosto
che vederla insieme a duecento coppie inventate.

Vedi [ADR 0009](docs/adr/0009-il-verticale-e-un-elenco-di-atti.md).

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

La seconda è integrata: gli open data della Corte costituzionale contengono
tutte le pronunce dal 1956 con ECLI nativo, e dal dispositivo — la parte in cui
la Corte scrive cosa ha deciso — si leggono gli estremi delle norme dichiarate
illegittime. Il parser copia il riferimento e non interpreta niente: il giudizio
l'ha già dato l'unico organo che poteva.

La misura si legge in **due numeri**, perché due mancanze diverse si riparano in
modi diversi: quante annotazioni il motore intercetta _in assoluto_, e quante ne
intercetta _fra quelle i cui atti abbiamo davvero scaricato_. Il primo si alza
ampliando il corpus, il secondo scrivendo controlli migliori. Vedi
[docs/gold-standard.md](docs/gold-standard.md).

## 5.1 La verifica in Gazzetta Ufficiale

Il contatore nazionale dice una cifra grande — i giorni trascorsi dalla scadenza
dei termini che le leggi si sono date per i propri decreti attuativi — e accanto
una frase piccola: misura **termini scaduti, non attuazioni mancate**. Sappiamo
che una data è passata; se il decreto sia poi arrivato è un'altra domanda.

Per rispondere bisogna andare a guardare in Gazzetta Ufficiale, un mandato per
volta. Il modulo che lo fa (`packages/corpus/src/gazzetta`) restituisce sempre
uno di tre esiti, mai due:

- **`adottato`** — c'è un provvedimento del tipo previsto dal mandato, e nel suo
  titolo o nel suo preambolo si legge la citazione di quel comma. Si registrano
  gli estremi (data, numero di Gazzetta, link) e la **frase letterale** su cui la
  corrispondenza si basa.
- **`non-adottato`** — nell'intervallo fra l'entrata in vigore dell'atto e oggi,
  nessun atto della Serie Generale cita quell'atto: né per esteso né in forma
  abbreviata. È l'unico esito che autorizza una segnalazione pubblica.
- **`non-verificabile`** — tutto il resto: il mandato che dice «con decreto»
  senza dire chi lo adotta, l'atto senza estremi citabili, la ricerca che
  restituisce troppo o troppo poco, il portale che non risponde.

`non-verificabile` non è un fallimento da nascondere: è l'esito onesto quando non
si sa, e il sistema lo preferisce sempre al tirare a indovinare. Le sue righe
stanno nel dataset pubblico come le altre — sapere dove la verifica non arriva è
un'informazione, e tenerla fuori farebbe sembrare la copertura migliore di com'è.

Il cancello lavora sul **singolo mandato**, non sull'atto: una legge può
prevedere dieci decreti, nove arrivati e uno no, e un cancello per atto
pubblicherebbe nove segnalazioni false. Vedi
[ADR 0013](docs/adr/0013-la-verifica-in-gazzetta.md) per il perché di ogni
scelta, compresa quella che tiene la copertura bassa a lungo.

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

Le revisioni vengono da chi legge, non da un comitato. Ogni scheda è costruita
per essere **demolita**, non ammirata: i testi originali, la query che l'ha
prodotta e i criteri di risoluzione stanno tutti in pagina, e il pulsante «Non è
un conflitto» apre una issue senza bisogno di un account. Si pubblica ciò che
sopravvive, e la pagina Dati dice a che punto è ogni controllo.

Questo non è un ripiego in attesa di esperti: è il motivo per cui il progetto è
open source. Un comitato ristretto vede una volta sola un campione, mentre una
segnalazione esposta con le sue prove resta contestabile per sempre, da
chiunque, compreso chi quella norma la applica tutti i giorni — che sulla sua
materia ne sa più di qualunque revisore ingaggiato.

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
  _citation-based_, si linkano gli estremi e non si ospita il corpus.
