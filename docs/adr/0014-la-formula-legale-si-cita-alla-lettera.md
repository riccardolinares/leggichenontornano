# 0014 — La formula legale si cita alla lettera

- **Stato:** Accettata
- **Data:** 2026-09-13
- **Limita:** la regola «dire in positivo» introdotta nella riscrittura dei
  limiti

## Contesto

Il progetto ha una regola di scrittura che funziona: **un limite si dice dal
lato di quello che chi legge può farci**. «Non ha carattere di ufficialità»
diventa «il testo che fa fede resta quello pubblicato sulla _Gazzetta
Ufficiale_», e la seconda versione la capisce anche chi non sa cosa voglia dire
«carattere di ufficialità».

Applicando la regola senza guardare cosa stava riscrivendo, «questo sito non
fornisce consulenza legale» era diventato «il parere legale lo dà chi ha titolo
per darlo». La frase è migliore come italiano. È peggiore come frase.

## Decisione

Le formule con un significato giuridico consolidato si riportano **alla
lettera**. Per questo sito, oggi, è una sola: _questo sito non fornisce
consulenza legale_.

Non è una deroga generale alla regola di scrittura. Tutto il resto — le
avvertenze sulle fonti, i limiti dei controlli, i «cosa non dice» accanto a ogni
numero — continua a scriversi in positivo. Qui la deroga vale perché la frase
non serve a farsi capire da chi legge il sito: serve a essere riconosciuta da
chi la cerca.

Il test e2e la richiede alla lettera, con il motivo scritto accanto. È l'unico
modo perché non venga riscritta di nuovo fra sei mesi da qualcuno che la trova
brutta — e avrà ragione, e sbaglierà lo stesso.

## Motivazioni

1. **Chi valuta quella frase cerca quelle parole.** Un ordine professionale, un
   ufficio legale, un giudice non leggono il sito per farsi un'opinione sul suo
   stile: verificano che una dichiarazione ci sia. Una parafrasi costringe a
   interpretare, e l'interpretazione è esattamente ciò che la formula serve a
   evitare.
2. **La formula è già in giro nel dataset.** `DISCLAIMER` in
   `packages/corpus/src/snapshot/types.ts` e l'avvertenza del server MCP la
   riportano da sempre in quella forma. Il sito era l'unico posto che diceva
   un'altra cosa.
3. **Il costo è una riga meno elegante**, e l'eleganza qui non è il valore da
   massimizzare.

## Dove sta

Nel **piede**, non sopra la prima riga di testo. Era una striscia grigia fra la
testata e il titolo: la prima cosa che leggeva chi arrivava, e quindi la prima
che smetteva di leggere dopo tre pagine — mentre si mangiava lo spazio sopra la
piega, che è l'unico in cui il sito può dire cosa ha trovato. Nel piede sta dove
si cercano le fonti, sempre nello stesso punto, e compare su ogni pagina.

«Nel piede» non vuol dire nascosta: stesso corpo del testo attorno (minimo 14
px, verificato dal test), contrasto verificato dall'audit axe su ogni tipo di
pagina, e nessun `details` da aprire.

## Conseguenze

- Positiva: la dichiarazione è dove la cerca chi deve valutarla, e nella forma
  in cui la cerca.
- Positiva: sopra la piega c'è quello che il sito ha trovato, che è il motivo
  per cui esiste.
- Negativa: una frase al negativo in mezzo a un testo scritto al positivo stona,
  e stonerà per sempre. Accettato.
