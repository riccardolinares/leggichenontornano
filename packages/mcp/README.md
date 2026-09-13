# Le leggi che non tornano, dentro il tuo assistente

Server [MCP](https://modelcontextprotocol.io) che dà a Claude, Codex o qualunque
altro client il corpus normativo, le segnalazioni del progetto e le pronunce
della Corte costituzionale.

**Non serve clonare niente, né installare niente, né configurare un token.** Al
primo avvio il server scarica il dataset pubblico e lo tiene in cache.

---

## Configurazione

Una voce, tre righe, uguale ovunque.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` su macOS,
`%APPDATA%\Claude\claude_desktop_config.json` su Windows.

```json
{
  "mcpServers": {
    "leggichenontornano": {
      "command": "npx",
      "args": ["-y", "@leggichenontornano/mcp"]
    }
  }
}
```

Riavvia Claude Desktop. Gli strumenti compaiono nel menù degli allegati.

### Claude Code

```bash
claude mcp add leggichenontornano -- npx -y @leggichenontornano/mcp
```

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.leggichenontornano]
command = "npx"
args = ["-y", "@leggichenontornano/mcp"]
```

### Qualunque altro client

Il trasporto è **stdio**, il comando è `npx -y @leggichenontornano/mcp`. Non serve altro:
niente porte, niente processi da tenere vivi, niente autenticazione.

### Se hai clonato il repository

```json
{
  "mcpServers": {
    "leggichenontornano": {
      "command": "node",
      "args": ["/percorso/del/clone/packages/mcp/dist/server.js"],
      "env": { "LCNT_SNAPSHOT": "/percorso/del/clone/data/snapshot" }
    }
  }
}
```

Con `LCNT_SNAPSHOT` il server non tocca la rete e legge i dati del tuo
clone, freschi quanto il tuo ultimo `git pull`.

---

## Esempi

Nei client che li supportano compaiono come voci scegliibili. Sono cinque, e
insegnano insieme alla domanda il modo giusto di porla.

| Esempio                          | A cosa serve                                                      |
| -------------------------------- | ----------------------------------------------------------------- |
| `cosa-dice-questa-norma`         | Leggere un articolo a una certa data                              |
| `come-e-cambiato-nel-tempo`      | La storia di un articolo, versione per versione                   |
| `cosa-non-torna-in-questa-norma` | Le segnalazioni su un atto, con la regola che le ha prodotte      |
| `questa-segnalazione-regge`      | Esaminare una segnalazione **per demolirla**, non per confermarla |
| `verifica-prima-di-citare`       | Controllare un'affermazione prima di scriverla da qualche parte   |

### Cose che puoi chiedere, in parole tue

> Cosa dice l'articolo 5 del codice dei contratti pubblici del 2006, e com'è
> cambiato nel tempo?

> Quali norme ancora in vigore rinviano al d.lgs. 163/2006, che è abrogato?

> Fammi vedere la segnalazione `…` per intero: voglio capire se regge. Leggi i
> testi originali, non fidarti del titolo.

> Sto per scrivere che in Italia ci sono 1.512 provvedimenti attuativi mai
> adottati. Regge?

L'ultima è l'esempio più utile del progetto: **non regge**, e il server te lo
dice. Il contatore misura termini scaduti, non attuazioni mancate — la verifica
in Gazzetta Ufficiale non c'è ancora, e `stato_del_progetto` lo dichiara.

---

## Gli strumenti

| Strumento             | Cosa fa                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `cerca_norme`         | Cerca nel testo degli articoli. Da qui si parte quando non si conosce l'URN  |
| `leggi_norma`         | Il testo di un atto a una data; senza data, la versione in vigore oggi       |
| `storia_articolo`     | Tutte le versioni di un articolo, con le rispettive date                     |
| `elenca_segnalazioni` | Le segnalazioni, filtrabili per controllo o per norma                        |
| `leggi_segnalazione`  | Una segnalazione per intero: testi originali, regola, criteri di risoluzione |
| `pronunce_su_norma`   | Le dichiarazioni di illegittimità costituzionale, con le parole della Corte  |
| `stato_del_progetto`  | Cosa il dataset copre, con quale precisione, e cosa il progetto non fa       |

---

## Cosa questo server non fa, e perché

Il progetto esiste perché **una segnalazione falsa su una legge fa più danno di
quanto dieci corrette costruiscano**. Un assistente che riassume è il posto in
cui quel rischio aumenta, non diminuisce: le cautele sono la parte meno
interessante da riassumere, e spariscono per prime.

Per questo il server non espone un'API più comoda. Espone gli stessi dati con le
stesse avvertenze **attaccate al testo**:

- **Nessuno strumento chiede un giudizio.** Non esiste un
  `verifica_se_si_contraddicono`. C'è un test che lo impedisce.
- **Il testo originale viene prima dei campi estratti**, in ogni risposta. Se
  l'errore sta nella nostra lettura della fonte, si vede lì e non altrove.
- **La regola è mostrata in chiaro**, come query. Non c'è una motivazione
  scritta da un modello, né qui né sul sito.
- **I criteri di risoluzione compaiono sempre**, anche quando dicono che nessuno
  si applica: se comparissero a intermittenza, la loro assenza diventerebbe un
  segnale ambiguo.
- **Assenza di segnale non significa norma coerente.** Una ricerca vuota dice
  che il corpus è parziale, non che la norma non esista.
- Ogni risposta porta l'avvertenza di **non ufficialità**: l'unico testo
  ufficiale è quello in _Gazzetta Ufficiale_, che prevale in caso di
  discordanza.

Se il dataset risulta vuoto — rete assente, percorso sbagliato — il server lo
scrive su `stderr` all'avvio invece di rispondere «nessun risultato» a
tutto. Un «non ho trovato niente» detto con sicurezza somiglia a un fatto sulla
legge, e non lo è.

---

## Variabili d'ambiente

Tutte facoltative.

| Variabile          | Effetto                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `LCNT_SNAPSHOT`    | Percorso di un dataset locale. Se c'è, la rete non viene toccata             |
| `LCNT_CACHE`       | Dove tenere il dataset scaricato. Predefinito: `~/.cache/leggichenontornano` |
| `LCNT_DATASET_URL` | Da dove scaricarlo, per usare un mirror o una copia propria                  |

## Licenze

Codice: **EUPL 1.2**. Dati normativi: **CC BY 4.0**, Normattiva. Pronunce:
**CC BY-SA 3.0**, Corte costituzionale.
