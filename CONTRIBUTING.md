# Contribuire

Grazie. Prima di tutto: il contributo più prezioso a questo progetto **non è una
pull request**.

---

## Il contributo che vale di più: dirci che sbagliamo

Ogni scheda del sito ha un pulsante **«Non è un conflitto»**. Apre una issue
pubblica, senza registrazione, con tutti i riferimenti già dentro.

Se siete avvocati, magistrati, funzionari, o semplicemente conoscete bene una
materia, quel pulsante è il modo più utile di aiutarci. Le vostre risposte
alimentano il gold standard e **cambiano la precisione misurata** del controllo
che ha prodotto la segnalazione: possono farlo scendere sotto l'85% e toglierlo
dal sito.

Il pulsante non si chiama «segnala un falso positivo» di proposito. «Non è un
conflitto» è una valutazione giuridica, che un professionista dà volentieri;
l'altra è un bug report, e presuppone che qualcuno lavori gratis per noi.

Quando rispondete, la cosa più utile è dire **quale** delle due cose non torna:

- **i fatti sono giusti, la qualificazione no** — rinvio recettizio, norma
  speciale, delegificazione autorizzata, disciplina transitoria;
- **i fatti sono sbagliati** — abbiamo letto male il testo, o l'abbiamo preso da
  un punto sbagliato della fonte.

Sono due lavori diversi: il primo chiede di raffinare una regola, il secondo di
correggere il parser. Anche una riga basta.

---

## Se volete scrivere codice

### Prima di aprire una pull request

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
pnpm --filter @antinomia/web run build
pnpm run e2e
```

L'ultimo comando include l'audit di accessibilità: una violazione WCAG 2.1 AA
fa fallire la build come una qualunque altra regressione. Non disattivate regole
axe per far passare i test — se una violazione è un falso positivo, va
documentata nel file di test con il motivo.

### Quello che non accettiamo

Non è burocrazia: sono i vincoli che tengono in piedi il progetto.

1. **Nessun percorso di codice che chieda a un modello linguistico se due norme
   si contraddicono.** Il modello estrae campi da un comma alla volta e non vede
   mai due norme insieme. `AnomalyFinding` non ha un campo in cui possa entrare
   una spiegazione generata, e non deve acquisirlo.
2. **Nessuna prosa generata nel sito.** Titoli e spiegazioni in lingua comune
   vengono da template di proprietà del singolo controllo.
3. **Nessuno scraping** del portale di consultazione di Normattiva. Si usano le
   API di export e le collezioni predefinite.
4. **Nessun grafo force-directed** come strumento di navigazione
   ([ADR 0003](docs/adr/0003-niente-grafo-force-directed.md)).
5. **Nessuna funzione di voto** sulle norme o sulle segnalazioni
   ([ADR 0004](docs/adr/0004-niente-voto-cittadino.md)).
6. **Nessuna dipendenza da servizi chiusi** nel percorso principale.

Se pensate che uno di questi vincoli sia sbagliato, la strada è una nuova ADR che
argomenti il contrario, non una pull request che lo aggira.

### Aggiungere un controllo

Un controllo nuovo ha bisogno di:

1. una `CheckDefinition` con la **regola in chiaro**: la stringa che finisce
   nella scheda, e che deve descrivere quello che il codice fa davvero;
2. una funzione `run` **pura** sulla proiezione del corpus — niente query, niente
   scritture: è ciò che permette di provarla su tre atti scritti a mano;
3. una **precisione attesa** dichiarata a priori, da confrontare con quella
   misurata;
4. test che coprano almeno un vero positivo, un caso limite che **non** deve
   scattare, e la stabilità degli identificatori;
5. una riga nel registro (`packages/engine/src/registry.ts`).

Un controllo nuovo **non pubblica** finché non ha 30 revisioni umane e l'85% di
precisione, con l'eccezione dei deterministici di livello 1. È automatico: non
dovete fare niente per ottenerlo, e non potete fare niente per evitarlo.

### Aggiungere un verticale semantico

Un verticale è **un elenco di atti**, non un elenco di parole. Il file
`data/vocabolari/<dominio>.json` contiene entrambe le cose, e la prima è quella
che conta:

```json
{
  "vertical": "appalti",
  "corpus": {
    "radici": ["urn:nir:stato:decreto.legislativo:2023-03-31;36", "…"],
    "espansione": ["ATTUA"]
  },
  "concepts": [ … ]
}
```

**`corpus.radici` è obbligatorio**: `loadVocabulary` si rifiuta di aprire un
vocabolario che non lo dichiara. Non è pignoleria. Nell'italiano giuridico quasi
nessuna parola di una forma sola appartiene a un dominio solo — «concessione»
sta nel codice dei contratti pubblici e in quello della navigazione del 1942,
«collaudo» negli appalti e nel collaudo dei veicoli — e finché il confronto si
attivava su qualunque comma contenente una di quelle forme, produceva duecento
accostamenti fra materie diverse, in silenzio
([ADR 0009](docs/adr/0009-il-verticale-e-un-elenco-di-atti.md)).

L'espansione passa **solo da `ATTUA`, e di un passo**: il regolamento di
esecuzione di un codice appartiene alla materia, l'atto che lo _modifica_ no —
è quasi sempre un omnibus, e la sua modifica sta già dentro il testo
multivigente della radice. `MODIFICA`, `INTRODUCE`, `ABROGA`, `SOSTITUISCE` e
`RINVIA` sono rifiutati dal validatore, ciascuno con il motivo scritto.

Il **vocabolario controllato** serve poi a distinguere fattispecie _dentro_ un
dominio già delimitato: poche centinaia di concetti, con i sinonimi che li
denotano in quella materia. `validaVocabolario` rifiuta le forme troppo
generiche e quelle condivise fra due concetti; `pnpm --filter @antinomia/engine
test` lo verifica su ogni file in `data/vocabolari/`.

Il vocabolario è un documento che si legge e si discute, non un artefatto
generato. Il primo, su appalti e contratti pubblici, è in
[`data/vocabolari/appalti.json`](data/vocabolari/appalti.json).

**Il prezzo è dichiarato**: il recall del livello 3 è limitato dalle radici che
scrivete. Una divergenza verso una norma fuori elenco non la vediamo. Preferiamo
non vederla piuttosto che pubblicarla insieme a duecento coppie inventate.

### Stile

- **Italiano** nel codice e nei commenti: è la lingua del dominio, e tradurre
  «stazione appaltante» in inglese per poi ritradurla nella testa a ogni lettura
  è un costo pagato da chi legge.
- I commenti spiegano **perché**, non cosa. Il caso migliore è quello che
  racconta l'errore che quella riga evita: diversi commenti di questo repository
  descrivono segnalazioni false che sono esistite davvero.
- `prettier` prima di committare: `pnpm run format`.

---

## Aprire un lavoro per qualcun altro

C'è un modulo apposta: [«Un lavoro da fare»](.github/ISSUE_TEMPLATE/lavoro.yml).
È lungo di proposito.

Un lavoro descritto male costa più tempo di quanto ne faccia risparmiare la
fretta di aprirlo: chi lo prende in mano si ferma alla prima ambiguità, e a quel
punto servono due persone invece di una. Le quattro sezioni obbligatorie sono
quelle senza cui **non si può cominciare**:

1. **il problema, non la soluzione** — se scrivi già la soluzione, chi legge non
   può proporne una migliore, e spesso ce n'è una migliore;
2. **come si vede che è fatto** — un risultato osservabile, non un'attività:
   «aggiungere un campo» è un'attività, «aprendo quella pagina si legge la data
   sopra il testo» o c'è o non c'è;
3. **dove mettere le mani** — non deve essere esatto, serve a far partire chi
   legge dal punto giusto invece che dalla ricerca a tappeto;
4. **come si verifica** — i comandi esatti e cosa devono dire. Un lavoro senza
   un modo di verificarlo non è finito, è solo scritto.

Se non sai rispondere a una di esse, è il segnale che il lavoro va discusso
prima in una issue normale.

---

## Le etichette

Stanno in [`.github/labels.yml`](.github/labels.yml), con il comando per
ricrearle. Non è decorazione: il pulsante «Non è un conflitto» costruisce un URL
che precompila anche l'etichetta, e se quella non esiste nel repository GitHub
la scarta in silenzio.

---

## Segnalare un problema di sicurezza

Non aprite una issue pubblica: vedi [SECURITY.md](SECURITY.md).

## Codice di condotta

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licenza dei contributi

Contribuendo accettate che il vostro contributo sia distribuito con licenza
**EUPL 1.2**, la stessa del progetto. Non chiediamo la firma di un CLA: la
licenza basta, e un adempimento in più fra chi vuole aiutare e il progetto è un
adempimento che non ci serve.

## Chi decide

[GOVERNANCE.md](GOVERNANCE.md) dice chi decide cosa, e soprattutto quali
decisioni **nessuno** può prendere — fra queste, aggirare la soglia di
pubblicazione, che non ha un pulsante nemmeno per chi mantiene il progetto.
