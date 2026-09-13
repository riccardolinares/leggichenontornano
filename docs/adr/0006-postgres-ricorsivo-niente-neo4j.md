# 0006 — Il grafo sta in PostgreSQL, attraversato con recursive CTE

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

"Grafo delle relazioni" suggerisce un database a grafo. L'introduzione di un
secondo motore di persistenza va però giustificata con un carico che il primo non
regge.

## Decisione

Un solo PostgreSQL, con Prisma per lo schema e le migrazioni. Le relazioni stanno
in una tabella `Relation` tipizzata e datata; gli attraversamenti sono `WITH
RECURSIVE` scritti a mano in `packages/corpus/src/store/graph-queries.ts`. Niente
Neo4j all'inizio.

## Motivazione

- Le query che servono hanno profondità limitata: catene di abrogazione e
  modifica, ego-network a profondità 1-2. Non sono ricerche di cammini arbitrari
  su miliardi di archi.
- Il filtro determinante è **temporale** (finestre di vigenza intersecanti), e i
  database a grafo non lo gestiscono meglio di un indice B-tree su due colonne di
  date.
- Un solo motore significa un solo backup, una sola migrazione, un solo
  `docker compose up` per chi vuole riprodurre i risultati. Per un progetto
  civico la riproducibilità da parte di terzi è parte dell'argomento.

## Conseguenze

- Positiva: `docker compose up` + `pnpm pipeline` riproduce il dataset.
- Negativa: alcune query di attraversamento sono SQL verboso. Mitigato
  incapsulandole in funzioni con test propri.
- Revisione prevista: se l'ego-network a profondità 2 su hub come la l. 241/1990
  supera i 200 ms in produzione, si valuta una materializzazione, non un secondo
  database.
