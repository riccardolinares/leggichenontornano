# Le leggi che non tornano

[![Verifica](https://github.com/riccardolinares/leggichenontornano/actions/workflows/verifica.yml/badge.svg)](https://github.com/riccardolinares/leggichenontornano/actions/workflows/verifica.yml)
[![Pipeline quotidiana](https://github.com/riccardolinares/leggichenontornano/actions/workflows/pipeline.yml/badge.svg)](https://github.com/riccardolinares/leggichenontornano/actions/workflows/pipeline.yml)
[![Licenza: EUPL 1.2](https://img.shields.io/badge/licenza-EUPL--1.2-blue.svg)](LICENSE)
[![Dati: CC BY 4.0](https://img.shields.io/badge/dati-CC%20BY%204.0-lightgrey.svg)](https://dati.normattiva.it)

Piattaforma open source che rende visibili incongruenze, contraddizioni e aree
grigie della legislazione italiana.

Il sito sta su **[leggichenontornano.it](https://leggichenontornano.it)**. Da
lì: [le segnalazioni](https://leggichenontornano.it),
[i numeri](https://leggichenontornano.it/numeri) con quello che non dicono,
[le norme del corpus](https://leggichenontornano.it/norme),
[le pronunce della Consulta](https://leggichenontornano.it/corte),
[il progetto dentro il tuo assistente](https://leggichenontornano.it/mcp) e
[i dati con la precisione misurata](https://leggichenontornano.it/dati) di ogni
controllo — compresi quelli che non pubblichiamo.

> **Le segnalazioni si controllano in pubblico.** Nessun comitato di esperti
> decide cosa è vero prima di voi: ogni scheda mostra i testi originali, la
> query che l'ha prodotta e i criteri di risoluzione, e ha un pulsante «Non è un
> conflitto» che apre una issue senza bisogno di account. Un controllo pubblica
> solo quando le revisioni registrate lo portano sopra la soglia, e la pagina
> Dati dice in ogni momento quali controlli ci sono arrivati e quali no. È per
> questo che il progetto è open source: la verifica non è una promessa, è una
> cosa che chiunque può fare.

> **La credibilità è il prodotto.** Una segnalazione falsa su una legge distrugge
> più di quanto dieci segnalazioni corrette costruiscano, e il danno è
> permanente.

Da questo principio discende tutto il resto: la soglia di pubblicazione,
l'assenza di modelli linguistici nei verdetti, il fatto che i testi originali
stiano sempre sopra ai campi estratti. Non sono cautele accademiche: sono
l'armatura che serve esattamente nel momento in cui il progetto arriva in prima
pagina.

---

## Su cosa si può contare

Prima di tutto il resto, perché è la parte che qualifica tutto il resto.

- **Ogni segnalazione si può rifare da soli.** La regola che l'ha prodotta è in
  chiaro sulla scheda, il dataset è scaricabile, e chi riesegue la stessa
  interrogazione ottiene le stesse righe.
- **I testi originali stanno sempre in pagina**, citati alla lettera e con la
  loro data di vigenza: se una segnalazione è sbagliata, l'errore si vede nel
  testo e non nel riassunto.
- **Chi confronta è scritto in ogni scheda.** Ai livelli 1-3 il confronto lo fa
  una query su date e relazioni; al livello 4 lo fa un modello, e la scheda lo
  dice con un blocco che si distingue senza doverlo leggere
  ([ADR 0011](docs/adr/0011-il-modello-confronta-dove-la-query-non-arriva.md)).
- **Quando la Corte costituzionale si è pronunciata, lo trovate scritto**, con
  le sue parole e il collegamento al testo integrale. Dichiarare illegittima una
  norma spetta a lei; collegare le sue decisioni al testo che colpiscono è
  quello che facciamo noi.
- **Parliamo di testi, non di partiti.** Niente punteggi di qualità
  legislativa, niente classifiche, nessuna responsabilità attribuita a governi o
  persone: un rinvio a una norma abrogata resta vero qualunque cosa si pensi di
  chi l'ha scritto, ed è per questo che regge.
- **Si contesta con gli argomenti, non con i voti**
  ([ADR 0004](docs/adr/0004-niente-voto-cittadino.md)). Ogni scheda si può
  smontare indicando dove sbaglia, e quella risposta cambia la precisione
  misurata del controllo.
- **Sappiamo sempre dire fin dove siamo arrivati.** La pagina **Dati** elenca
  quali controlli girano, su quanti atti e con quale precisione; il dataset
  porta con sé gli elenchi, e si possono contare.

Quello che trovate qui serve a farsi un'opinione documentata in fretta e con i
testi davanti: questo sito non fornisce consulenza legale.

## La soglia di pubblicazione

Un tipo di controllo viene pubblicato soltanto quando la revisione umana su
campione supera l'**85% di precisione**, con almeno **30 revisioni**. Sotto
soglia le sue segnalazioni restano nella coda interna e non compaiono sul sito.

La regola è **codificata**, non dichiarata:
[`publication-gate.ts`](packages/engine/src/publication-gate.ts) la applica nel
punto di esportazione, e i test in
[`gate.test.ts`](packages/engine/test/gate.test.ts) la verificano. La precisione
corrente di ogni controllo, compresi quelli che non pubblicano e il perché, è
sulla pagina **Dati** del sito.

---

## Com'è fatto

```
Ingestione            API Normattiva open data (Akoma Ntoso, CC BY 4.0)
Normalizzazione       chiave primaria URN:NIR + ELI
Store bitemporale     data di vigenza + data di conoscenza
Grafo relazioni       modifica, abroga, rinvia, attua, deroga, sostituisce
Estrazione semantica  proposizioni deontiche tipizzate (solo verticali attivi)
Motore anomalie       tre livelli, vedi METODO.md
Coda di revisione     human-in-the-loop, metriche di precisione per tipo
API pubblica          scritta prima del frontend, consumata dal frontend
Frontend              sito pubblico, statico dove possibile
Distribuzione         bot quotidiano, dataset release, pagina stampa
```

**Il grafo è il prodotto. Il modello è uno strumento sopra il grafo, mai il
contrario.**

### Pacchetti

| Pacchetto                                    | Cosa fa                                                             |
| -------------------------------------------- | ------------------------------------------------------------------- |
| [`packages/akn-parser`](packages/akn-parser) | URN:NIR, ELI, Akoma Ntoso, multivigenza, lettura delle modifiche    |
| [`packages/corpus`](packages/corpus)         | client Normattiva, ingestione, store bitemporale, grafo, dataset    |
| [`packages/engine`](packages/engine)         | controlli livelli 1-3, cancello di pubblicazione, coda di revisione |
| [`packages/api`](packages/api)               | API pubblica REST, OpenAPI                                          |
| [`packages/mcp`](packages/mcp)               | server MCP: il progetto dentro Claude, Codex e altri assistenti     |
| [`apps/web`](apps/web)                       | il sito, con i test di accessibilità e usabilità                    |
| [`apps/bot`](apps/bot)                       | la segnalazione del giorno su Telegram, Facebook, LinkedIn e X      |

---

## Partire da zero

Servono Node 22 e pnpm 9. PostgreSQL serve solo per la pipeline: **il sito e i
test girano senza**, perché leggono il dataset versionato in `data/snapshot/`.

```bash
pnpm install
pnpm run build

# Il sito, dal dataset già nel repository
pnpm --filter @leggichenontornano/web run build
pnpm --filter @leggichenontornano/web exec next start

# I test: unitari, poi accessibilità e usabilità nel browser
pnpm run test
pnpm --filter @leggichenontornano/web exec playwright install --with-deps chromium
pnpm run e2e
```

### La pipeline completa

```bash
docker compose up -d                      # PostgreSQL 16
cp .env.example .env                      # DATABASE_URL
pnpm --filter @leggichenontornano/corpus exec prisma db push

# Le collezioni disponibili su dati.normattiva.it
node packages/corpus/dist/cli.js collections

# Scarica, ingerisci, esegui i controlli, esporta
node packages/corpus/dist/cli.js fetch "Codici" --formato M
node packages/corpus/dist/cli.js ingest data/corpus/codici-M --collezione "Codici"
node packages/engine/dist/cli.js run
node packages/engine/dist/cli.js metriche
node packages/engine/dist/cli.js esporta --dest data/snapshot --solo-anomalie --campione 20
```

I controlli di livello 3 richiedono un passo in più, il verticale:

```bash
# Estrae le proposizioni deontiche dagli atti del dominio dichiarato nel
# vocabolario. Senza ANTHROPIC_API_KEY usa l'estrattore a regole e funziona
# lo stesso, con recall più basso e dichiarato.
node packages/engine/dist/cli.js estrai --vocabolario data/vocabolari/appalti.json
node packages/engine/dist/cli.js run --verticale appalti
```

Le pronunce della Corte costituzionale e la misura del recall:

```bash
node packages/corpus/dist/cli.js consulta          # archi + gold standard
node packages/corpus/dist/cli.js consulta verifica # accordo con le note di Normattiva
node packages/engine/dist/cli.js gold valuta       # quanto il motore intercetta
```

Il dataset completo, in JSONL e Parquet:

```bash
node packages/engine/dist/cli.js esporta --dest dataset-completo --parquet
```

Nel repository sta la versione **ridotta** — serve a far girare sito e test da
un clone appena fatto. Quella completa è pubblicata come artefatto dalla
pipeline quotidiana.

L'API pubblica si alza con o senza database:

```bash
LCNT_SNAPSHOT=data/snapshot node packages/api/dist/server.js   # dal dataset
DATABASE_URL=... node packages/api/dist/server.js                   # dal database
```

---

## Dove gira il sito

Il deploy è su Vercel, con la regione **`fra1`, Francoforte**, dichiarata in
[`apps/web/vercel.json`](apps/web/vercel.json). Una regione italiana non esiste:
le europee sono Francoforte (`fra1`), Parigi (`cdg1`), Dublino (`dub1`),
Stoccolma (`arn1`) e Londra (`lhr1`), e Francoforte è quella che da qui si
raggiunge in meno tempo. Il file è JSON e non accetta commenti: la spiegazione
sta qui.

La distinzione che conta, perché è quella che di solito si fraintende:

- **Le pagine non passano dalla regione.** Sono generate durante la build e
  servite dalla CDN, dal nodo più vicino a chi legge: chi apre una scheda da
  Palermo non aspetta Francoforte. Vale per quasi tutto il sito — le pagine sono
  `force-static` e anche le anteprime Open Graph sono prodotte in build, perché
  gli elenchi di URN, ECLI e id anomalia vengono dal dataset versionato.
- **La regione decide dove gira il codice calcolato a richiesta**, cioè le
  funzioni serverless. Oggi ce n'è una: `POST /api/segnalazione`, la rotta che
  apre la issue su GitHub quando qualcuno usa il modulo «Qualcosa non torna?».
  Con `fra1` quella richiesta parte da Francoforte e non da Washington. Ci
  finiranno anche le prossime: altre rotte sotto `app/api/`, le server action, o
  un'immagine Open Graph generata al volo per un contenuto che in build non
  esiste ancora.

Senza questa riga la regione predefinita sarebbe negli Stati Uniti, e già oggi
ogni segnalazione inviata dall'Italia attraverserebbe l'Atlantico due volte per
aprire una issue. Dichiararla serve anche a non doverci ripensare ogni volta che
si aggiunge una funzione.

---

## Le fonti

**Normattiva open data** ([dati.normattiva.it](https://dati.normattiva.it)) —
Akoma Ntoso, XML NIR, JSON, URI ELI, con la **multivigenza**: ogni atto conserva
tutte le versioni succedutesi, interrogabili per data. Licenza **CC BY 4.0** dal
1° gennaio 2026.

Usiamo le API di export e le collezioni predefinite previste dal portale, con
rate limiting e cache locale. Non c'è nel nostro codice un percorso che faccia
scraping del sito di consultazione.

**Corte costituzionale open data**
([dati.cortecostituzionale.it](https://dati.cortecostituzionale.it)) — tutte le
pronunce dal 1956, con ECLI nativo. Licenza **CC BY-SA 3.0**.

Una dichiarazione di illegittimità costituzionale è una contraddizione
**certificata dall'ordinamento**: non la troviamo noi, la dichiara l'unico
organo che può farlo. La usiamo per due cose, e restano separate:

- **archi del grafo** `DICHIARA_ILLEGITTIMO`, mostrati nel lettore norma con le
  parole del dispositivo e il collegamento al testo integrale;
- **gold standard**, per misurare quanto il motore intercetta. Una pronuncia non
  è mai insieme input del motore e verità contro cui lo si misura.

Questa fonte dà anche **l'unica precisione che possiamo misurare senza
revisione umana**: Normattiva annota le stesse declaratorie in coda all'articolo
colpito, e le due fonti non derivano l'una dall'altra. Sull'ingestione corrente
l'accordo è **9 su 9** per gli archi ad alta confidenza
(`lcnt-corpus consulta verifica`, e il numero viaggia nel dataset).

Leggiamo il **dispositivo**, cioè la parte in cui la Corte scrive cosa ha
deciso, e ne copiamo gli estremi. Non interpretiamo, non riassumiamo, non
valutiamo: il giudizio l'ha già dato chi poteva darlo. Il parser si rifiuta di
produrre un arco quando la norma è regionale (fuori dal nostro spazio di URN),
quando il dispositivo nomina più atti senza che il primo sia inequivoco, e
quando la declaratoria è parziale — in quel caso l'arco nasce a bassa
confidenza, perché la norma non cade, cambia contenuto.

Altre fonti previste dall'architettura: SPARQL di Camera e Senato — non i dump
RDF, che hanno file mancanti ed errori di parsing — Banca Dati di Merito,
Gazzetta Ufficiale per la verifica degli atti attuativi, EUR-Lex per i rinvii
sovranazionali.

Il corpus di legittimità della Corte di cassazione **non è disponibile in
blocco**: il livello giurisprudenziale è trattato per citazione, si linkano gli
estremi e non si ospita il testo.

### Attribuzione e non ufficialità

> Elaborazione su dati **Normattiva** ([dati.normattiva.it](https://dati.normattiva.it)),
> licenza [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.it).
>
> La banca dati Normattiva **non ha carattere di ufficialità**: l'unico testo
> ufficiale è quello pubblicato sulla _Gazzetta Ufficiale_, che prevale in caso
> di discordanza.
>
> Pronunce: elaborazione su dati **Corte costituzionale**
> ([dati.cortecostituzionale.it](https://dati.cortecostituzionale.it)),
> licenza [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/it/).

Questa avvertenza è su ogni pagina del sito e in due intestazioni HTTP di ogni
risposta dell'API. Non è nel footer in grigio chiaro.

---

## Gli errori che abbiamo trovato leggendo l'output

Gli open data di Normattiva hanno irregolarità che, prese per buone, producono
segnalazioni che **sembrano errori del legislatore e sono errori di marcatura**.
Ne abbiamo trovate sette. Altre sei erano nostre, e sono le più istruttive:
il confronto semantico delimitato dalle parole invece che dagli atti, un «stesso
soggetto» che confrontava concetti trovati in qualunque punto della frase, una
citazione letta dentro il titolo di un altro atto che dichiarava caduta una
legge costituzionale vigente, una data scritta «1° ottobre» che spariva, e un
confine di parola sbagliato che trasformava le declaratorie parziali della Corte
costituzionale in declaratorie totali, e un pezzo del dataset scritto da un
comando diverso da tutti gli altri, che spariva quando lo si esportava altrove.
Tutte e tredici sono venute fuori
eseguendo il motore sul corpus vero e leggendo l'output una riga per volta. Sono
documentate in
[docs/qualita-fonti.md](docs/qualita-fonti.md), con cosa producevano e cosa
facciamo adesso.

Vale la pena leggerlo anche se non vi interessa questo progetto: è la parte
dell'ingegneria che sta fra un dataset pubblico e un'affermazione pubblica.

---

## Decisioni di progetto

Gli [ADR](docs/adr) registrano le decisioni prese e il perché. Le principali:

- [0001](docs/adr/0001-estrazione-piu-query.md) — l'LLM estrae struttura, il codice giudica
- [0002](docs/adr/0002-soglia-di-pubblicazione.md) — soglia di pubblicazione all'85%
- [0003](docs/adr/0003-niente-grafo-force-directed.md) — nessun grafo force-directed
- [0004](docs/adr/0004-niente-voto-cittadino.md) — nessun voto cittadino
- [0005](docs/adr/0005-scala-a-due-layer.md) — due layer con scala diversa
- [0006](docs/adr/0006-postgres-ricorsivo-niente-neo4j.md) — PostgreSQL e recursive CTE
- [0007](docs/adr/0007-store-bitemporale.md) — store bitemporale
- [0008](docs/adr/0008-url-come-prodotto.md) — gli URL sono il prodotto
- [0009](docs/adr/0009-il-verticale-e-un-elenco-di-atti.md) — il verticale è un elenco di atti, non di parole

---

## Usarlo dentro un assistente

C'è un server [MCP](https://modelcontextprotocol.io): dà a Claude, Codex o
qualunque altro client il corpus, le segnalazioni e le pronunce della Consulta.
Non serve clonare né configurare niente — al primo avvio scarica il dataset
pubblico e lo tiene in cache.

```json
{
  "mcpServers": {
    "leggichenontornano": { "command": "npx", "args": ["-y", "@leggichenontornano/mcp"] }
  }
}
```

Sette strumenti e cinque esempi pronti, fra cui _«esamina questa segnalazione
per demolirla»_ e _«sto per scrivere questo numero: regge?»_. Le cautele del
progetto valgono anche lì: nessuno strumento chiede un giudizio, il testo
originale viene prima dei campi estratti, e una ricerca vuota dice che il corpus
è parziale invece di lasciar credere che la norma non esista.

Istruzioni e configurazioni per ogni client: [`packages/mcp`](packages/mcp), o la
pagina [leggichenontornano.it/mcp](https://leggichenontornano.it/mcp) per chi non
apre una repository.

---

## Documenti

|                                                |                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| [METODO.md](METODO.md)                         | Su cosa si può contare, la tassonomia delle anomalie, la soglia di pubblicazione |
| [DESIGN.md](DESIGN.md)                         | Le regole di design, e da quale principio discendono                             |
| [CONTRIBUTING.md](CONTRIBUTING.md)             | Come contribuire, e cosa non accettiamo                                          |
| [GOVERNANCE.md](GOVERNANCE.md)                 | Chi decide cosa, e quali decisioni nessuno può prendere                          |
| [CHANGELOG.md](CHANGELOG.md)                   | Le versioni, e perché il numero di segnalazioni cambia                           |
| [SECURITY.md](SECURITY.md)                     | Come segnalare un problema di sicurezza                                          |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)       | Codice di condotta                                                               |
| [docs/adr](docs/adr)                           | Le decisioni architetturali e il perché                                          |
| [docs/qualita-fonti.md](docs/qualita-fonti.md) | Dodici irregolarità trovate eseguendo il motore sui dati veri                    |
| [docs/gold-standard.md](docs/gold-standard.md) | Come misuriamo, e quanto vale la misura                                          |
| [docs/accessibilita.md](docs/accessibilita.md) | Le scelte di accessibilità e come si verificano                                  |

---

## Contribuire

[CONTRIBUTING.md](CONTRIBUTING.md). In breve: il contributo più prezioso non è
una pull request, è **dirci che una segnalazione è sbagliata**. Ogni scheda ha un
pulsante «Non è un conflitto» che apre una issue senza registrazione, e le
risposte cambiano la precisione misurata del controllo che l'ha prodotta.

Build in public dal primo commit. Per un progetto civico il codice aperto è parte
dell'argomento: _verificate anche noi_.

## Licenze

- **Software:** [EUPL 1.2](LICENSE)
- **Dataset derivato:** CC BY 4.0
- **Dati di origine:** Normattiva, CC BY 4.0

Metadati per il software pubblico: [`publiccode.yml`](publiccode.yml).
