# 0018 — Il grafo si può muovere, se si rinuncia a citarlo

- **Stato:** Accettata
- **Data:** 2026-09-13
- **Modifica in parte:** [ADR 0012](0012-il-grafo-si-puo-fare-se-non-si-muove.md),
  che continua a valere per `/grafo`

## Contesto

Due decisioni scritte dicono di no a quello che questa ADR decide di fare, e
vanno nominate per prime.

[ADR 0003](0003-niente-grafo-force-directed.md) escludeva i grafi
force-directed come strumento di navigazione.
[ADR 0012](0012-il-grafo-si-puo-fare-se-non-si-muove.md) ne ha riammesso uno a
`/grafo` con una condizione precisa: **il layout è deterministico e si calcola
sul server**, e nel browser non gira nessuna simulazione. La ragione era ed è
buona: gli URL sono il prodotto ([ADR 0008](0008-url-come-prodotto.md)), e
un'immagine che cambia da sola non si può citare.

Resta però una cosa che la mappa ferma non fa e non può fare: **non si tocca**.
Guardando `/grafo` si vede che esistono dei perni; tirandone uno si sente
quanta parte dell'ordinamento gli sta appesa, e quella è un'informazione che
arriva dal gesto e non dal disegno. La stessa differenza che c'è fra la foto di
una struttura e la struttura.

Non è un argomento abbastanza forte da riscrivere `/grafo`. È abbastanza forte
per una pagina in più, a patto di dire ad alta voce cosa quella pagina non è.

## Decisione

Si aggiunge **`/grafo/vivo`**: lo stesso grafo, con la simulazione a forze di
[`force-graph`](https://github.com/vasturiano/force-graph) che gira **nel
browser**, su canvas.

L'indirizzo sta sotto `/grafo` perché è lo stesso grafo in un'altra forma, non
un'altra mappa: `/mappa` è già la mappa del sito, e un indirizzo di primo
livello avrebbe promesso una terza cosa che non esiste.

Quattro vincoli, che sono il prezzo del permesso.

**1. `/grafo` non si tocca.** ADR 0012 continua a valere lì, riga per riga: il
layout resta calcolato sul server, deterministico, uguale per chiunque. Non c'è
nessun rimando dall'una all'altra che sostituisca la prima con la seconda. Le
due pagine convivono e si citano a vicenda, dicendo ciascuna cosa l'altra fa
meglio.

**2. I dati arrivano dal server già costruiti.** Nodi, archi, gradi e famiglie
di legame vengono da `apps/web/lib/grafo.ts`, lo stesso file che alimenta
`/grafo`. Nel browser non si ricostruisce niente: si calcolano solo le
posizioni, che sono l'unica cosa che quel file produce e che questa pagina
butta via.

**3. Il colore significa quello che significa altrove.** Gli stessi token
`--grafo-*`, la stessa famiglia sullo stesso colore, e il **rosso riservato a
una cosa sola**: il bersaglio non è più in vigore. Due pagine dello stesso sito
che dicono due cose diverse con lo stesso segno sono peggio di una pagina in
meno.

**4. Sotto il disegno resta la tabella, e non è negoziabile.** Un canvas è
invisibile a uno screen reader e non si percorre da tastiera — è il punto 5 di
ADR 0003, che resta valido e non viene toccato da questa decisione. La stessa
informazione sta sotto in forma di elenco: tutte le norme del grafo, quante le
richiamano, quante ne richiamano, in che stato sono, ciascuna con il
collegamento alla sua scheda. Il canvas porta `role="img"` e una descrizione
costruita dai dati, e l'audit axe passa sulla pagina senza disattivare nessuna
regola.

In più, chi ha chiesto meno movimento al sistema operativo
(`prefers-reduced-motion`) trova la simulazione **già ferma nella sua posizione
finale**: gira tutta prima del primo disegno e si spegne al primo fotogramma.
Vede lo stesso risultato degli altri, senza l'agitazione.

## Che cosa si perde

Questa è la parte che vale la pena scrivere per davvero, perché è vera e non si
compensa.

- **Il disegno non è citabile.** Non c'è modo di rimandare qualcuno a «quello
  che si vede a `/grafo/vivo`»: quello che si vede lì non esiste due volte.
- **Due persone che aprono lo stesso link vedono due immagini diverse.** Anche
  la stessa persona, ricaricando. Le posizioni dipendono dalla simulazione, e
  la simulazione dipende da quanti fotogrammi ha disegnato quella macchina, da
  cosa è stato trascinato e da quando la si è guardata.
- **La pagina non può essere la fonte di un numero.** Nessuna cifra si legge
  dal disegno: le cifre stanno nella riga di testo sopra e nelle tabelle sotto,
  che vengono dal dataset. Un disegno che cambia non prova niente, e chi lo
  usasse per dire «si vede che» direbbe una cosa che non ha verificato.
- **Un'immagine catturata da qui non si può discutere.** Per questo la pagina
  non offre nessun esporta-come-immagine: quella funzione sta su `/grafo`, dove
  l'immagine è sempre la stessa. Uno screenshot preso qui è un documento senza
  originale.
- **Costa al client.** Duecentoquattro nodi e millecinquecentottantotto archi
  simulati e ridisegnati a ogni fotogramma sono lavoro vero, su un telefono
  anche caldo. La mappa ferma non costa niente a nessuno.

## Che cosa si è ridotto per reggere il peso, e va detto

Millecinquecentottantotto archi disegnati tutti a piena opacità sono una
feltratura in cui non si distingue niente. **Nessun arco e nessun nodo è
nascosto** — ci sono tutti, e i conteggi della pagina dicono quanti sono — ma i
rinvii, che sono milletrecentododici su millecinquecentottantotto, sono
disegnati molto sottili e quasi trasparenti. Il risultato è che sopra il
tessuto dei rinvii si vedono le altre famiglie e i fili rossi, che è quello che
la pagina deve far vedere.

Il resto del carico si riduce senza togliere informazione: i colori degli archi
sono poche stringhe fisse, così la libreria li disegna in gruppo invece che uno
per uno; gli archi non sono puntabili col mouse, perché dipingerli sulla tela
nascosta del riconoscimento costa quanto disegnarli e quello che si vuole
prendere sono le norme; le etichette compaiono solo per i due buchi, per la
norma sotto il puntatore e per i perni quando ci si è avvicinati abbastanza da
leggerle.

## Conseguenze

- Positiva: il grafo si può interrogare col gesto — tirare un nodo e vedere chi
  viene dietro risponde a «quanto pesa questa legge» meglio di un'immagine
  ferma.
- Positiva: il confronto fra le due pagine dice qualcosa di vero sul progetto.
  La mappa ferma è quella che si cita; questa è quella che si esplora.
- Negativa: due pagine da mantenere sullo stesso dato. Se il modo di costruire
  il grafo cambia, cambia in `lib/grafo.ts` e si riflette su tutte e due — che è
  il motivo per cui quel file non è stato duplicato.
- Negativa: una dipendenza esterna nel pacchetto del browser, fissata a una
  versione esatta nel `package.json`. Se `force-graph` smettesse di essere
  mantenuta, questa pagina è la prima cosa da spegnere, e il sito continuerebbe
  a funzionare senza.
- Negativa: nessun test può verificare che il disegno sia giusto, perché non
  esiste un disegno giusto. I test verificano che la pagina risponda, che il
  canvas dichiari cosa contiene, che la tabella ci sia e che l'audit di
  accessibilità passi. Il confronto fra due caricamenti — quello che difende
  `/grafo` — qui **non si fa**, perché fallirebbe per costruzione.
