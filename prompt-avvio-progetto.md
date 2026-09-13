# Documento di avvio — "Le leggi che non tornano"

> La specifica da cui il repository è stato costruito: contesto, vincoli, architettura, fonti dati verificate e ordine di lavoro.
>
> Resta qui come riferimento contro cui misurare quello che c'è. Dove l'implementazione si è discostata, la ragione è scritta in una [ADR](docs/adr) — non nel silenzio.

---

## Contesto e obiettivo

Stiamo costruendo una piattaforma open source che rende visibili le incongruenze, le contraddizioni e le aree grigie della legislazione italiana.

**Nome di lavoro pubblico:** Le leggi che non tornano (dominio candidato `leggichenontornano.it`)
**Nome** per repository, API e pacchetti: `leggichenontornano`
**Licenza:** EUPL 1.2
**Obiettivo:** progetto civico, non commerciale. Deve parlare al grande pubblico, fare notizia e reggere l'esame di un giurista ostile.

L'unità di valore del prodotto non è la piattaforma, è **la singola anomalia**: un oggetto autoconsistente, condivisibile, verificabile, con prove tracciabili.

## Principio fondativo

> La credibilità è il prodotto. Una segnalazione falsa su una legge distrugge più di quanto dieci segnalazioni corrette costruiscano, e il danno è permanente.

Da questo discendono tutti i vincoli sotto. Non sono cautele accademiche: sono l'armatura che serve esattamente nel momento in cui il progetto arriva in prima pagina.

## Non-goals espliciti

- Nessuna consulenza legale, nessuna dichiarazione automatica di illegittimità o incostituzionalità.
- **Nessun LLM che giudica se due norme si contraddicono.** Il modello estrae struttura, il codice giudica. Vedi "Metodo" sotto.
- Nessun punteggio di "qualità legislativa", nessun ranking politico, nessuna attribuzione di responsabilità a partiti o singoli.
- Nessuna funzione di voto cittadino nella prima fase. Trasforma il progetto da osservatore a attore politico e rende ogni segnalazione contestabile per motivi estranei ai dati. Eventualmente come progetto gemello, dopo che il motore è consolidato.
- Assenza di segnale ≠ norma coerente. Va detto esplicitamente nell'interfaccia.

---

## Fonti dati

### Disponibili e da integrare

**Normattiva open data** — `dati.normattiva.it`. Portale aperto dal 2026, dati in **CC BY 4.0 dal 1° gennaio 2026**. Espone API REST (sincrone e asincrone), bulk download, collezioni preconfezionate e collezioni dinamiche su criteri utente. Formati: Akoma Ntoso, XML NIR, HTML, JSON, URI ELI. Fornisce la **multivigenza**: ogni atto conserva tutte le versioni succedutesi, interrogabili per data (esempio: la l. 241/1990 ha oltre sessanta versioni). Specifiche API: `dati.normattiva.it/assets/come_fare_per/API_Normattiva_OpenData.pdf`. Esiste un SDK Python non ufficiale (`normattiva-sdk` su PyPI) da valutare come riferimento di implementazione, non come dipendenza.

**Corte costituzionale** — open data ufficiale, tutte le decisioni dal 1956, ECLI nativo. Fondamentale: le pronunce di illegittimità sono contraddizioni certificate dall'ordinamento.

**Camera e Senato** — `dati.camera.it` e `dati.senato.it`, linked open data in CC BY-SA, con dataset sullo stato dell'iter degli atti. **Attenzione pratica:** i dump RDF hanno file mancanti ed errori di parsing; usare l'endpoint SPARQL, non i dump.

**Banca Dati di Merito** (Ministero della Giustizia) — provvedimenti civili dal Sistema Informatico del Settore Civile dal 01/01/2016, anonimizzati. Esclude famiglia, minori e stato della persona.

**Gazzetta Ufficiale** — per la verifica di pubblicazione degli atti attuativi.

**EUR-Lex / CELLAR** — API e SPARQL, per la normativa UE e i rinvii sovranazionali.

### Non disponibili — progettare assumendo la lacuna

**Cassazione.** Il corpus di legittimità non è disponibile in bulk né per finalità di addestramento. SentenzeWeb è liberamente consultabile ma copre gli ultimi cinque anni ed è consultazione, non dataset. Il layer giurisprudenziale di legittimità va trattato come **citation-based**: si linkano gli estremi, non si ospita il corpus.

### Obblighi

- Attribuzione CC BY 4.0 a Normattiva, visibile, non nascosta nel footer in grigio chiaro.
- Disclaimer di non ufficialità su ogni pagina che mostra testo normativo: la banca dati Normattiva non ha carattere di ufficialità, l'unico testo ufficiale è quello pubblicato in Gazzetta Ufficiale, che prevale in caso di discordanza.
- Rispettare i termini di Normattiva sull'harvesting massivo: usare le API di export e le collezioni previste, non scraping aggressivo.

---

## Strategia di scala

Due layer con scala diversa. Questo è deliberato, non un compromesso.

**Layer deterministico — corpus completo.** Ingestione di tutto il corpus statale disponibile, costruzione del grafo delle relazioni, rilevamento delle anomalie formali. Scala bene perché è lavoro di pipeline su metadati e riferimenti. Deve girare su tutto fin dall'inizio.

**Layer semantico — verticali progressivi.** L'estrazione delle proposizioni deontiche dipende da un vocabolario controllato di dominio per stabilire che due norme parlano della stessa fattispecie. Senza quel vocabolario la similarità testuale produce falsi positivi in massa ("impresa" negli appalti e "impresa" nel fisco sono lo stesso token e cose diverse). Si attiva un dominio alla volta, con il suo vocabolario di poche centinaia di concetti. Primo verticale suggerito: trasparenza e anticorruzione, oppure appalti.

---

## Architettura

```
Ingestione            → API Normattiva, SPARQL Camera/Senato, open data Consulta,
                        Banca Dati Merito, EUR-Lex
Normalizzazione       → Akoma Ntoso; chiave primaria URN:NIR + ELI
Store bitemporale     → data di vigenza + data di conoscenza (non solo versioning)
Grafo relazioni       → modifica, abroga, rinvia, attua, dichiara illegittimo,
                        deroga, sostituisce
Estrazione semantica  → proposizioni deontiche tipizzate (solo sui verticali attivi)
Motore anomalie       → tre livelli, vedi tassonomia
Coda di revisione     → human-in-the-loop, con metriche di precisione per tipo
API pubblica          → prima del frontend; il frontend ne è il primo consumatore
Frontend              → sito pubblico
Distribuzione         → bot quotidiano, dataset release, pagina stampa
```

Il grafo è il prodotto. L'LLM è uno strumento sopra il grafo, mai il contrario.

---

## Tassonomia delle anomalie

| Livello | Tipo                   | Esempio                                                                                                                      | Metodo                                                     | Precisione attesa                  |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| 1       | Antinomia formale      | Modifica a un articolo già abrogato; rinvio a un comma soppresso; norma dichiarata incostituzionale ancora nel testo vigente | Attraversamento del grafo, zero AI                         | ~100%                              |
| 1       | Rinvio non attuato     | Decreto attuativo mai emanato, termine scaduto                                                                               | Grafo + verifica in GU                                     | ~100%                              |
| 2       | Gerarchia e competenza | Fonte secondaria che deroga a fonte primaria; norma regionale su materia esclusiva statale                                   | Regole su metadati + giurisprudenza Consulta come verità   | 70-85%                             |
| 3       | Antinomia sostanziale  | Stesso adempimento con termini diversi; sanzioni incoerenti per fattispecie analoghe                                         | Estrazione + query                                         | 50-80%                             |
| 3       | Area grigia            | Termine indeterminato senza definizione legale; concetto con significati divergenti                                          | Estrazione definizioni + segnali giurisprudenziali esterni | Alta se ancorata a segnali esterni |

**Ottimizzare per precisione, non per recall.**

---

## Metodo per il layer semantico

Il modo sbagliato: dare due testi a un LLM e chiedere se si contraddicono. Output plausibile, non verificabile, non riproducibile, accuratezza non misurabile.

Il modo da implementare: **l'LLM estrae struttura, una query trova la contraddizione.**

Per ogni comma si estrae una proposizione normalizzata:

- soggetto / fattispecie (chi, in quali circostanze)
- modalità deontica (obbligo, divieto, permesso, potere, onere)
- oggetto della condotta
- termine, se presente
- conseguenza o sanzione
- condizioni ed eccezioni
- ambito di applicazione
- URN, comma, finestra di vigenza

A questo punto la contraddizione è un `JOIN`, non un giudizio:

```
stessa modalità ∧ stesso soggetto ∧ fattispecie sovrapposta
∧ vigenze intersecanti ∧ valore divergente
```

Conseguenze da preservare in tutto il design: è riproducibile; l'errore del modello resta confinato all'estrazione, che si valida a campione con una metrica onesta; la segnalazione è ispezionabile, perché mostri le due proposizioni con i loro URN e chiunque può dirti se hai sbagliato l'estrazione o se il conflitto è reale.

**Il filtro temporale non è opzionale.** Due norme mai vigenti contemporaneamente non sono in contraddizione. Senza date di vigenza sulle proposizioni, questa categoria di falsi positivi domina l'output.

**Matching della fattispecie:** embedding come richiamo per generare candidati, vocabolario controllato come filtro. Mai embedding da soli.

---

## Validazione: gold standard

Servono metriche reali, non impressioni. Quattro fonti pubbliche di anomalie già annotate da giuristi:

1. **Pareri del Consiglio di Stato in sede consultiva** sugli schemi di decreto. Indicano esplicitamente incoerenze, rinvii che non tornano, definizioni divergenti. È di fatto un dataset annotato da magistrati.
2. **Sentenze di illegittimità costituzionale.** Contraddizioni certificate dall'ordinamento.
3. **Rimessioni alle Sezioni Unite.** Aree grigie certificate: se la Cassazione dichiara un contrasto, l'ambiguità esiste per definizione.
4. **Circolari interpretative** di ministeri e Agenzia delle Entrate. Segnalano dove la PA ha dovuto chiarire perché il testo non bastava.

**Soglia di pubblicazione:** un tipo di controllo si pubblica solo quando la revisione umana su campione supera l'**85% di precisione**. Sotto soglia resta in coda interna. La regola va scritta nel README e mostrata nel sito: è un elemento di credibilità, non una limitazione.

Le revisioni non vengono da un comitato: vengono da chi legge. Ogni scheda espone i testi originali, la query e i criteri di risoluzione, e chiede apertamente di essere **demolita** — il pulsante «Non è un conflitto» apre una issue senza account. Si pubblica ciò che sopravvive, e la pagina Dati dice a che punto è ogni controllo.

---

## Frontend

### Struttura

- **Home** — indice delle segnalazioni. Titolo di ogni anomalia scritto come frase leggibile ad alta voce, non come categoria tecnica. Sotto ogni titolo un paragrafo "cosa succede in pratica" in lingua comune, prima di qualsiasi riferimento normativo. Filtri per tipo.
- **Scheda anomalia** — la pagina che gira. Deve essere autoconsistente per chi arriva da un link. Ordine: spiegazione in lingua comune → i due testi originali affiancati con i campi estratti → barra delle finestre di vigenza con l'intersezione evidenziata → "C'è una spiegazione?" con i criteri di risoluzione applicabili (specialità, posteriorità, gerarchia) → dettaglio tecnico in accordion con la query in chiaro → strumenti di condivisione.
- **Lettore norma** — testo con timeline multivigenza, anomalie come annotazioni a margine. Modalità confronto come parametro dello stesso URL, non pagina separata.
- **Come funziona** — dire per prima cosa cosa il progetto _non_ fa.
- **Dati** — download, licenze, metriche di precisione per tipo.

### Regole non negoziabili

- **Gli URL sono il prodotto.** Schema stabile e citabile: `/norma/urn:nir:...~art3?v=2013-04-20`. Deve poter essere incollato in una memoria difensiva.
- **Il testo originale sta sempre sopra i campi estratti.** L'utente verifica l'estrazione prima di valutare il verdetto.
- **La regola è mostrata in chiaro**, come query. Nessuna spiegazione in prosa generata dal modello.
- **La riga "possibile risoluzione" compare su ogni scheda**, anche quando dice che nessun criterio si applica. Se comparisse a intermittenza, la sua assenza diventerebbe un segnale ambiguo.
- **"Non è un conflitto"** invece di "segnala falso positivo". È una valutazione giuridica che un professionista dà volentieri; l'altra è un bug report che presuppone lavoro gratuito. Le risposte alimentano il gold standard. Apre una issue su GitHub via API, senza login.
- **Anteprima Open Graph generata automaticamente** per ogni anomalia, con titolo e numero chiave. È la feature con il rapporto impatto/sforzo più alto del progetto: decide se il contenuto circola su WhatsApp e X.
- **Nessun grafo force-directed come navigazione.** Le reti di citazioni normative sono scale-free e collassano attorno agli hub; il layout non è deterministico e rompe la citabilità degli URL; le relazioni sono tipizzate e datate mentre un layout a forze mostra prossimità non orientata; le anomalie sono percorsi, non nodi; e un canvas è invisibile agli screen reader. Al suo posto: ego-network a profondità 1-2 con layout deterministico precalcolato server-side, e DAG a strati con il tempo sull'asse x (`dagre` o `elkjs`). Se serve la vista d'insieme, generarla come poster statico periodico, non come app.
- **Accessibilità WCAG obbligatoria.** Progetto civico, potenziali utenti PA.

### Direzione visiva

Carta grigio-fredda, inchiostro verdastro quasi nero, verderame come unico colore interattivo, ocra per le aree grigie, rosso ossido spento per le antinomie. Riferimento agli archivi e al bronzo, non alla palette terracotta ormai onnipresente. Tipografia: un serif per il testo normativo, un grottesco per l'interfaccia (candidati: Newsreader + Archivo). Il testo di legge deve leggersi come un documento, l'interfaccia come segnaletica. Nessun cruscotto: la home apre con una frase che dice cosa contiene il sito, non con un indovinello o una griglia di metriche.

---

## Distribuzione

- **Bot quotidiano** su Telegram, Facebook, LinkedIn e X, alimentato dalla pipeline via GitHub Action. Una segnalazione al giorno. La costanza batte il picco: un account che pubblica una cosa verificabile ogni giorno per sei mesi diventa una fonte che i giornalisti seguono.
- **Contatore nazionale** deterministico e crescente (es. giorni di ritardo accumulati dai decreti mai emanati), esposto con un referente concreto e non come indovinello.
- **Pagina stampa**: dataset scaricabile, grafici incorporabili, contatti, frase citabile.
- **Lancio**: non lanciare la piattaforma, lanciare un caso. Scegliere l'anomalia più indifendibile e pubblicarla singolarmente, con il sito dietro come prova che non è isolata.
- **Build in public dal primo commit**, non dopo. Per un progetto civico il codice aperto è parte dell'argomento: "verificate anche me".

---

## Stack e struttura repo

**Stack:** TypeScript ovunque. Next.js App Router con generazione statica sul corpus indicizzato e ISR per il resto. PostgreSQL con Prisma; il grafo si attraversa con recursive CTE, niente Neo4j all'inizio. Ricerca: full-text Postgres con dizionario italiano, poi Meilisearch o Typesense. Layout dei grafi: `dagre` / `elkjs`, precalcolato e persistito. Nessuna dipendenza da servizi chiusi.

**Monorepo, pacchetti separati fin dal giorno uno** (è ciò che rende il progetto riusabile invece che clonabile):

```
packages/
  akn-parser/        parser e normalizzatore Akoma Ntoso + URN:NIR/ELI
  corpus/            ingestione, store bitemporale, grafo relazioni
  engine/            motore anomalie (livelli 1-3) + estrazione deontica
  api/               API pubblica REST
apps/
  web/               sito pubblico
  bot/               pubblicazione quotidiana
data/                vocabolari controllati per verticale
docs/                ADR, metodo, metriche
```

**Alla radice:** `publiccode.yml` (standard di metadati per il software pubblico, indicizzato dal crawler di Developers Italia), `LICENSE` EUPL 1.2, `CONTRIBUTING.md`, `METODO.md` con la soglia di pubblicazione.

**Sostenibilità:** GitHub Action schedulata che riscarica il delta, rigenera il dataset, riesegue i controlli e apre una PR con il diff. Dataset derivato pubblicato come release artifact in JSONL e Parquet. Serve perché i progetti civici open source non muoiono per mancanza di stelle, muoiono quando il dataset smette di aggiornarsi e nessuno se ne accorge per otto mesi.

---

## Ordine di lavoro

1. Scaffold del monorepo, licenza, `publiccode.yml`, ADR iniziali, README con il metodo e la soglia di precisione. Repository pubblica dal primo commit.
2. `akn-parser` + `corpus`: ingestione da API Normattiva, normalizzazione, store bitemporale. Test su un sottoinsieme, poi corpus completo.
3. Grafo delle relazioni e anomalie di livello 1 su tutto il corpus. Prime metriche.
4. API pubblica e dataset release automatizzata.
5. Frontend: scheda anomalia e indice. Immagini Open Graph. Lettore norma.
6. Gold standard e misurazione. Nessuna pubblicazione sopra il livello 1 finché non si supera l'85%.
7. Primo verticale semantico: vocabolario controllato, estrazione deontica, anomalie di livello 3.
8. Bot quotidiano e pagina stampa.
9. Apertura delle segnalazioni alla revisione pubblica, poi lancio con un caso singolo.

---

## Prima azione richiesta

Crea la struttura della repository, i file di governance, gli ADR iniziali che registrano le decisioni prese sopra (metodo estrazione-più-query, soglia di pubblicazione, esclusione del grafo force-directed, esclusione del voto cittadino, strategia di scala a due layer), e uno scheletro funzionante di `akn-parser` che risolva un URN:NIR e restituisca il testo di un articolo a una data.
