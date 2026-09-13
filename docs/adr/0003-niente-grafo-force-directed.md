# 0003 — Nessun grafo force-directed come navigazione

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

La visualizzazione attesa per un grafo di relazioni normative è la rete
force-directed. È anche la scelta sbagliata, per cinque ragioni indipendenti che
si sommano.

## Decisione

Nessun layout a forze come strumento di navigazione. Al suo posto:

- **ego-network a profondità 1-2** con layout deterministico precalcolato
  server-side e persistito;
- **DAG a strati con il tempo sull'asse x** (`dagre` / `elkjs`), anch'esso
  precalcolato;
- se serve la vista d'insieme, si genera come **poster statico periodico**, non
  come applicazione interattiva.

## Motivazioni

1. Le reti di citazioni normative sono scale-free: collassano attorno a pochi hub
   (il codice civile, la legge 241/1990) e la vista diventa una palla di lana.
2. Il layout a forze non è deterministico: due caricamenti danno due immagini
   diverse, e questo rompe la citabilità — che per questo progetto è il prodotto
   (ADR 0008).
3. Le relazioni sono **tipizzate e datate** (modifica, abroga, rinvia, attua,
   deroga, dichiara illegittimo). Un layout a forze mostra prossimità non
   orientata: butta via esattamente l'informazione che conta.
4. Le anomalie sono **percorsi**, non nodi. Un percorso si legge come una
   sequenza, non come una nuvola.
5. Un canvas è invisibile agli screen reader. Per un progetto civico con utenti
   potenziali nella pubblica amministrazione, l'accessibilità non è negoziabile
   (ADR: vedi requisito WCAG 2.1 AA in `docs/accessibilita.md`).

## Conseguenze

- Positiva: ogni vista del grafo ha un URL stabile e un equivalente testuale
  (una tabella di relazioni con `<caption>`), leggibile da tastiera e da screen
  reader.
- Positiva: il layout, essendo precalcolato, non costa nulla al client.
- Negativa: niente esplorazione libera "a spasso nel grafo". Accettato: non era
  un caso d'uso, era un'estetica.
