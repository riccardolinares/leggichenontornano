# Architecture Decision Records

Ogni file registra una decisione presa, il contesto in cui è stata presa e le
conseguenze che ne discendono. Le decisioni non si cancellano: si sostituiscono
con una nuova ADR che dichiara superata la precedente.

Formato: [MADR](https://adr.github.io/madr/) semplificato.

| N.                                                            | Titolo                                                     | Stato     |
| ------------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| [0001](0001-estrazione-piu-query.md)                          | L'LLM estrae struttura, il codice giudica                  | Accettata |
| [0002](0002-soglia-di-pubblicazione.md)                       | Soglia di pubblicazione all'85% di precisione              | Accettata |
| [0003](0003-niente-grafo-force-directed.md)                   | Nessun grafo force-directed come navigazione               | Accettata |
| [0004](0004-niente-voto-cittadino.md)                         | Nessuna funzione di voto cittadino nella prima fase        | Accettata |
| [0005](0005-scala-a-due-layer.md)                             | Due layer con scala diversa                                | Accettata |
| [0006](0006-postgres-ricorsivo-niente-neo4j.md)               | Il grafo sta in PostgreSQL, attraversato con recursive CTE | Accettata |
| [0007](0007-store-bitemporale.md)                             | Store bitemporale: vigenza e conoscenza                    | Accettata |
| [0008](0008-url-come-prodotto.md)                             | Gli URL sono il prodotto                                   | Accettata |
| [0009](0009-il-verticale-e-un-elenco-di-atti.md)              | Il verticale è un elenco di atti, non di parole            | Accettata |
| [0010](0010-il-modello-scrive-attorno-ai-fatti.md)            | Un modello scrive il blog, e non decide niente             | Accettata |
| [0011](0011-il-modello-confronta-dove-la-query-non-arriva.md) | Il modello confronta, dove la query non arriva             | Accettata |
| [0012](0012-il-grafo-si-puo-fare-se-non-si-muove.md)          | Il grafo si può fare, se non si muove                      | Accettata |
| [0013](0013-la-verifica-in-gazzetta.md)                       | Come si verifica in Gazzetta Ufficiale                     | Accettata |
