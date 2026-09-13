# 0013 — L'indirizzo di una pronuncia si legge a voce

- **Stato:** Accettata
- **Data:** 2026-09-13
- **Rapporto con altre ADR:** modifica la [0008](0008-url-come-prodotto.md)
  limitatamente all'indirizzo delle decisioni della Corte costituzionale. Tutto
  il resto della 0008 resta in vigore, l'URN:NIR compreso.

## Contesto

La 0008 stabilisce che l'identificatore di un contenuto sta in chiaro nel suo
indirizzo, e per le decisioni della Corte costituzionale ha assegnato quel ruolo
all'ECLI. Il risultato era questo:

```
/corte/ECLI%3AIT%3ACOST%3A2026%3A121
```

Due difetti, uno di forma e uno di sostanza.

Quello di forma esisteva dal primo giorno: **quell'indirizzo non si legge al
telefono.** La 0008 si giustifica dicendo che l'artefatto utile è un link da
incollare in una memoria difensiva o in un articolo; un indirizzo che chi lo
riceve non sa ripetere, e chi lo legge in una nota non sa riconoscere, quel
lavoro non lo fa. L'ECLI è l'identificatore giusto per una macchina, ed è il
motivo per cui era stato scelto — ma la 0008 parla di persone.

Quello di sostanza si è visto in produzione: **tutte e cinquantacinque le
pagine rispondevano 404.** In locale funzionavano, la build produceva i file
giusti, la sitemap le pubblicava. Il livello che serve le pagine generate non
ritrova un percorso che contiene i due punti — codificati o no — e l'errore
compariva solo sul sito pubblicato. Nessun test lo vedeva: quelli che c'erano
giravano in locale, dove quei percorsi funzionavano.

I due difetti hanno la stessa radice. L'ECLI nell'indirizzo obbliga a
codificarlo, e un indirizzo codificato è insieme illeggibile per una persona e
fragile lungo la catena che lo serve.

## Decisione

L'indirizzo di una decisione della Corte è la sua citazione, scritta come la si
dice:

```
/corte/sentenza-121-2026        Sentenza n. 121/2026
/corte/ordinanza-45-2019        Ordinanza n. 45/2019
```

Tipo, numero, anno: minuscole, cifre e trattini, niente altro. È l'ordine con
cui la decisione si cita e si cerca — «sentenza 121 del 2026» — e si detta al
telefono senza spiegare niente.

Regole che ne discendono:

- **Lo slug si deriva dal dato, in un posto solo.** `slugPronuncia` in
  `apps/web/lib/testo.ts`, e la sua inversa `pronunciaDaSlug`. Nessuno scrive
  un indirizzo di pronuncia a mano, la sitemap compresa: quando la sitemap si
  costruiva l'URL da sola, ha continuato a pubblicare per mesi cinquantacinque
  indirizzi che non rispondevano.
- **L'univocità è verificata, non assunta.** Numero, anno e tipologia
  identificano oggi una decisione sola in tutto il dataset, ed è un test a
  dirlo. Se due decisioni si chiamassero allo stesso modo, entrambe prendono in
  coda il proprio ECLI: due indirizzi brutti sono un problema minore di due
  pronunce allo stesso indirizzo.
- **L'ECLI resta nel dato e resta scritto in pagina.** È l'identificatore con
  cui la decisione va citata verso una macchina, è la chiave degli archi
  `DICHIARA_ILLEGITTIMO` nel grafo, ed è l'unica cosa che non cambia. Cambia
  solo l'indirizzo.
- **I vecchi indirizzi rispondono, in modo permanente.** Erano in sitemap e
  possono essere stati condivisi: un URL pubblicato non si rompe due volte.
- **Il test che conta è che ogni pronuncia del dataset abbia una pagina
  raggiungibile**, non che lo slug sia quello che ci aspettiamo. E un test con
  un'espressione regolare vieta i caratteri codificati in quegli indirizzi, così
  che nessuno possa reintrodurre la causa senza accorgersene.

## Come rispondono i vecchi indirizzi

Il redirect **non** è una regola in `next.config.mjs`. Due motivi, entrambi
pratici: in quelle regole i due punti introducono un parametro, quindi un ECLI
non è nemmeno esprimibile come sorgente senza travestimenti; e soprattutto il
confronto avverrebbe sullo stesso percorso che il livello di routing non sa già
maneggiare — si chiederebbe alla cosa rotta di riparare sé stessa.

Rispondono invece in due passi:

1. un middleware, che gira **prima** del routing dei file ed è l'unico punto in
   cui si è certi che quella richiesta passi, riscrive il percorso in una forma
   senza due punti (`/corte/ecli-it-cost-2026-121`). Non decide dove mandarla:
   non legge il dataset e non conosce nessuna pronuncia;
2. la pagina della decisione, che il dataset lo conosce, riconosce quella forma
   e reindirizza in modo permanente allo slug.

## Conseguenze

- Positiva: l'indirizzo si legge, si detta e si riconosce dentro una nota a piè
  di pagina. È quello che la 0008 chiedeva e che l'ECLI non poteva dare.
- Positiva: nessun percorso del sito contiene più un ECLI codificato, e il
  difetto che ha tenuto giù cinquantacinque pagine non ha più dove annidarsi.
- Negativa: l'indirizzo non contiene più l'identificatore ufficiale della
  decisione. Accettato: l'ECLI è in pagina, nel dataset e nell'API, cioè nei
  posti in cui serve a una macchina.
- Negativa: la tabella degli URL pubblici cambia una riga, e i vecchi indirizzi
  vanno mantenuti finché qualcuno li usa. È il costo che la 0008 aveva già
  previsto quando ha scritto che un URL pubblicato non si rimuove.
- Da fare: gli URN nel lettore norma (`/norma/urn%3Anir%3A…`) hanno la stessa
  forma codificata. Qui non li tocchiamo — l'URN è la chiave primaria del
  corpus e la 0008 su quello non cambia — ma il difetto va sorvegliato.
