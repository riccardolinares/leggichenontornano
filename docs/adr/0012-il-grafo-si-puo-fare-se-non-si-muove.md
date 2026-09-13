# 0012 — Il grafo si può fare, se non si muove

- **Stato:** Accettata
- **Data:** 2026-09-13
- **Modifica:** [ADR 0003](0003-niente-grafo-force-directed.md)

## Contesto

[ADR 0003](0003-niente-grafo-force-directed.md) escludeva i grafi
force-directed. Rileggendola, le ragioni erano due e non hanno lo stesso peso.

La prima è tecnica e vera: **una simulazione che gira nel browser produce un
disegno diverso a ogni caricamento**. Su un sito il cui prodotto sono gli URL
citabili ([ADR 0008](0008-url-come-prodotto.md)), un'immagine che cambia da sola
è un problema serio: non si può citare, non si può discutere, e due persone che
guardano lo stesso link vedono due cose diverse.

La seconda è un giudizio estetico travestito da principio: che un grafo denso
sia «una nuvola che non dice niente». Spesso è vero. Non è una legge di natura —
dipende da cosa il colore sta segnando.

Nel frattempo il dataset ha reso disponibile una cosa che chiede di essere
guardata invece che letta: **centoventi leggi in vigore che puntano a due testi
cancellati**. In tabella sono due righe con dei numeri accanto. In un disegno
sono due buchi neri con un centinaio di fili che ci finiscono dentro, e si
capisce in un secondo.

## Decisione

Il grafo si fa, a `/grafo`, con quattro vincoli che rispondono all'obiezione
vera di ADR 0003.

**1. Il layout è deterministico e si calcola sul server.** La simulazione a
forze gira in `apps/web/lib/grafo.ts` con un generatore pseudocasuale **con
seme**, un numero **fisso** di passi e un raffreddamento lineare. Non si ferma
«quando è abbastanza stabile», perché quella condizione dipende da quanto è
veloce la macchina. Nel browser arrivano coordinate già calcolate: stesso
dataset, stesso disegno, per chiunque e per sempre.

**2. Nel browser non gira nessuna simulazione.** Il componente disegna, filtra
ed evidenzia. I filtri nascondono nodi e archi senza ricalcolare le posizioni:
chi filtra mantiene la mappa mentale che si era fatto.

**3. Il colore non è decorazione.** Il rosso segna una cosa sola — i
collegamenti verso norme che non esistono più, e i nodi che li tirano. È
l'informazione per cui la pagina esiste, ed è l'unica che il disegno deve
trasmettere senza parole.

**4. Sotto il disegno ci sono i numeri.** Una tabella con le norme cancellate e
quante norme vive le richiamano ancora. Non è un ripiego per l'accessibilità: un
grafo fa vedere la **forma** di un problema, e le cifre esatte bisogna comunque
poterle leggere e citare.

Inoltre la pagina **non sta nel menù**, solo nel piede: è una cosa da guardare,
non un passaggio del percorso di chi sta cercando una norma.

## Cosa non cambia di ADR 0003

Resta vietato il grafo force-directed **simulato nel client** come modo di
esplorare il corpus: la pagina del lettore norma continua a mostrare l'ego
network come diagramma con posizioni calcolate, e non diventerà una nuvola
trascinabile. La differenza è che lì il grafo serve a rispondere a una domanda
precisa su una norma, e per quello un diagramma stabile è semplicemente
migliore.

## Conseguenze

- Positiva: il progetto ottiene l'unica immagine che riassume in un secondo cosa
  fa, ed è condivisibile come immagine — che è il modo in cui la maggior parte
  delle persone la vedrà.
- Positiva: il disegno è citabile come una pagina, perché non cambia.
- Negativa: il layout si ricalcola a ogni build. Con centocinquanta nodi costa
  frazioni di secondo; se il corpus crescesse di un ordine di grandezza andrebbe
  ripensato — e a quel punto anche il disegno andrebbe ripensato, perché una
  nuvola di millecinquecento nodi torna a essere la nuvola che ADR 0003 temeva.
- Negativa: una pagina che si condivide come immagine circola **senza il suo
  contesto**. Per questo l'immagine esportata porta lo sfondo, i colori risolti
  e la legenda implicita del rosso, e il link finisce negli appunti insieme al
  file.
