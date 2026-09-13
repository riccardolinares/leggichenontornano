# ADR 0009 — Il verticale è un elenco di atti, non un elenco di parole

Stato: accettata
Data: 2026-09-13

## Contesto

Il metodo prevede che il layer semantico si attivi **un verticale alla volta**,
con un vocabolario controllato di dominio (ADR 0005). L'implementazione iniziale
prendeva quella frase alla lettera e basta: il verticale _era_ il vocabolario, e
una proposizione entrava nel dominio se una forma del vocabolario compariva nel
testo del comma.

Sul corpus reale non ha funzionato, e il modo in cui ha fallito è istruttivo.

Il controllo di livello 3 (`termini-divergenti`) produceva coppie come:

> Per lo stesso adempimento, Legge 18 aprile 2005, n. 62 dà 30 giorni e Regio
> decreto 30 marzo 1942, n. 327 ne dà 8 … impongono lo stesso obbligo a
> Autorità nazionale anticorruzione.

Il regio decreto 327/1942 è il **codice della navigazione**. Non ha niente a che
vedere con gli appalti, e l'ANAC sarebbe nata sessant'anni dopo.

La prima diagnosi è stata «un sinonimo sbagliato»: `Autorità` era elencata fra i
sinonimi di `anac`. Toglierlo ha ridotto il rumore ma non l'ha eliminato,
perché il problema non era quel sinonimo. Il problema è che **nell'italiano
giuridico quasi nessuna parola di una forma sola appartiene a un dominio solo**:

| forma           | dove compare davvero                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| concessione     | codice dei contratti pubblici, codice della navigazione, concessioni demaniali, concessioni ferroviarie, tasse sulle concessioni governative |
| collaudo        | appalti di lavori e collaudo dei veicoli nel codice della strada                                                                             |
| bando           | appalti, concorsi pubblici, bandi di gara di ogni materia                                                                                    |
| lavori pubblici | un secolo di leggi di conversione, dal 1926 in poi                                                                                           |

Nessuna cura del vocabolario risolve questo. Le forme non sono sbagliate: sono
le forme giuste, e il dominio non è nelle forme.

## Decisione

Il verticale dichiara il proprio **confine per atti**, nel vocabolario stesso:

```json
"corpus": {
  "radici": ["urn:nir:stato:decreto.legislativo:2023-03-31;36", "…"],
  "espansione": ["ATTUA"]
}
```

- `radici` le scrive a mano una persona che conosce la materia. Sono gli atti
  fondativi del dominio, identificati per URN.
- L'espansione è **di profondità uno** e passa solo da `ATTUA`: il regolamento
  di esecuzione di un codice appartiene alla materia.
- L'estrazione deontica legge **solo i commi degli atti del corpus**. Una norma
  fuori dal corpus non produce proposizioni e non entra in alcun confronto.

Il vocabolario continua a servire, ma per quello che sa fare davvero:
distinguere fattispecie **dentro** un dominio già delimitato.

## Cosa è stato escluso, e perché

`RINVIA` non può espandere un verticale: sul corpus reale 190 atti rinviano al
codice dei contratti pubblici e quasi nessuno è un atto di appalti. Citare una
norma non colloca nella materia.

`MODIFICA`, `INTRODUCE`, `ABROGA`, `SOSTITUISCE` nemmeno, per due ragioni
indipendenti:

1. L'atto che modifica un codice è quasi sempre omnibus. Fra i tre atti che
   `INTRODUCE` articoli nel codice dei contratti pubblici ci sono
   «Provvedimenti anticrisi, nonché proroga di termini» e «Proroga di termini
   per l'emanazione di atti di natura regolamentare»: contengono due articoli di
   appalti e trecento di altre materie.
2. La modifica è **già dentro** il testo multivigente della radice (ADR 0007).
   Includere l'atto modificante non aggiunge una norma di appalti: aggiunge
   tutte le sue norme che appalti non sono.

La chiusura transitiva amplifica l'errore. Misurato su questi dati:

| espansione                                  | atti nel verticale | segnalazioni livello 3 |
| ------------------------------------------- | ------------------ | ---------------------- |
| nessun confine (solo vocabolario)           | 8 070              | 210                    |
| MODIFICA+ATTUA+INTRODUCE+ABROGA, transitiva | 131                | 4                      |
| ATTUA, profondità 1                         | 5                  | 2                      |

## Conseguenze

**Il recall del livello 3 è limitato dalle radici dichiarate, ed è un limite
voluto.** Una divergenza fra il codice dei contratti pubblici e la legge
241/1990 sul procedimento amministrativo oggi non viene vista. Preferiamo non
vederla piuttosto che vederla insieme a duecento coppie inventate: la credibilità
è il prodotto.

**Le radici assenti dal corpus scaricato vengono dichiarate, non nascoste.** Se
il corpus non contiene la l. 109/1994, l'estrazione lo scrive e il verticale
copre meno atti. Il numero di atti del verticale compare nel rapporto di ogni
estrazione.

**Un vocabolario senza `corpus.radici` non si carica.** `loadVocabulary` si
rifiuta di aprirlo, con un messaggio che spiega perché. Il difetto descritto qui
è silenzioso per natura: senza questo controllo tornerebbe alla prima aggiunta
di un verticale nuovo.
