# 0015 — Niente database in produzione, finché i dati non cambiano da soli

- **Stato:** Accettata
- **Data:** 2026-09-13

## Contesto

La domanda arriva ogni volta che il progetto cresce: **serve un PostgreSQL
gestito, tipo Supabase?** È ragionevole chiederselo, perché il progetto _un_
PostgreSQL ce l'ha già — `packages/corpus` ci gira sopra con Prisma, e lo schema
ha quindici modelli.

La risposta dipende da una distinzione che di solito si dà per scontata: **dove
gira quel database**.

Oggi gira solo durante l'ingestione e l'analisi, cioè in `pnpm run ingest` sulla
macchina di chi sviluppa e nel job «Ingestione e motore su PostgreSQL» della CI,
che se lo tira su come servizio e lo butta via alla fine. Il risultato non resta
nel database: viene **esportato in `data/snapshot/`**, quattordici megabyte fra
JSONL e JSON, e committato nella repo. Il sito legge quello (`LCNT_SNAPSHOT` in
`apps/web/lib/dataset.ts`), genera le pagine in build, e in produzione non apre
nessuna connessione.

In produzione, quindi, **un database non c'è**. E le cose che una piattaforma
civica di solito ci mette dentro, qui stanno altrove di proposito:

- le segnalazioni di chi trova un errore diventano **issue pubbliche su GitHub**
  (`/api/segnalazione`), dove chiunque le vede e le può discutere;
- il registro dei consumi dei modelli è un **file append-only nella repo**;
- le revisioni umane che alzano la precisione entrano dal gold standard,
  versionato;
- il voto cittadino non esiste, e [ADR 0004](0004-niente-voto-cittadino.md) dice
  perché.

## Decisione

**Nessun database gestito in produzione.** I dati del progetto sono file
versionati; PostgreSQL resta uno strumento di lavorazione, non un pezzo
dell'infrastruttura pubblica.

Vale anche per i dati nuovi: le verifiche in Gazzetta Ufficiale e il registro
dei consumi si scrivono come file nella repo, non come righe in un servizio.

## Motivazioni

1. **In un progetto che chiede di essere contestato, la diffabilità batte la
   query.** Se una verifica in Gazzetta cambia esito, il `git log` dice quando è
   cambiata, per quale commit e per mano di chi. La stessa riga in un database
   gestito cambia e basta. Per questo progetto è una differenza sostanziale, non
   una preferenza.
2. **Quattordici megabyte non sono un problema di scala**, sono un file. Il
   collo di bottiglia della build non è la lettura del dataset.
3. **Un servizio esterno è una dipendenza che può morire.** Chi clona la repo
   oggi ha tutto: dati, storia, licenze. Con un database gestito avrebbe il
   codice e una connessione che non funziona.
4. **Costa zero e non chiede a nessuno i propri dati.** Un progetto che dichiara
   di non tracciare nessuno ha un argomento più forte se non ha nemmeno un posto
   in cui mettere quello che raccoglierebbe.

## Dove questa scelta costa qualcosa, e lo dico qui perché non si scopra dopo

Il limite di frequenza di `/api/segnalazione` è una `Map` in memoria
(`apps/web/app/api/segnalazione/route.ts`). Su funzioni serverless ogni istanza
ha la sua, quindi **il limite è più debole di quanto sembri**: tiene contro
l'invio ripetuto di una persona, non contro un abuso distribuito. Se e quando
servirà davvero, la risposta non è un PostgreSQL — è un contatore condiviso (KV,
Redis gestito), che è un'altra cosa e va deciso a parte.

## Quando questa decisione va riaperta

Basta uno di questi, e allora serve un archivio scrivibile a runtime:

- qualcosa che gli utenti scrivono e rileggono **dentro il sito** (commenti sotto
  una segnalazione, revisioni inserite dal browser, ricerche salvate, account);
- stato per singolo utente, che oggi non esiste perché non c'è login;
- un corpus che cresca al punto da non stare più in una repo — indicativamente
  quando lo snapshot supera qualche centinaio di megabyte o la build non regge
  il tempo di un deploy;
- dati che devono cambiare **fra due build**, senza che nessuno faccia un commit.

Finché nessuna di queste è vera, aggiungere un database gestito significa
aggiungere un punto di rottura, un costo mensile e una cosa da amministrare, in
cambio di niente.

## Conseguenze

- Positiva: la produzione non ha stato, quindi non ha backup da fare, migrazioni
  da rincorrere, né un fornitore da cui dipendere.
- Positiva: ogni dato pubblicato ha una storia in git, ed è contestabile
  indicando una riga e un commit.
- Negativa: qualunque funzione che richieda scrittura a runtime è **fuori
  portata finché questa ADR non viene sostituita**. È un vincolo vero, ed è
  voluto: obbliga a chiedersi se quella funzione serva davvero.
- Negativa: il limite di frequenza resta approssimativo, come scritto sopra.
