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

Serve un **vocabolario controllato** in `data/vocabolari/<dominio>.json`: poche
centinaia di concetti, con i sinonimi che li denotano **in quel dominio**. Senza,
la similarità testuale produce falsi positivi in massa — «impresa» negli appalti
e «impresa» nel fisco sono lo stesso token e due cose diverse.

Il vocabolario è un documento che si legge e si discute, non un artefatto
generato. Il primo, su appalti e contratti pubblici, è in
[`data/vocabolari/appalti.json`](data/vocabolari/appalti.json).

### Stile

- **Italiano** nel codice e nei commenti: è la lingua del dominio, e tradurre
  «stazione appaltante» in inglese per poi ritradurla nella testa a ogni lettura
  è un costo pagato da chi legge.
- I commenti spiegano **perché**, non cosa. Il caso migliore è quello che
  racconta l'errore che quella riga evita: diversi commenti di questo repository
  descrivono segnalazioni false che sono esistite davvero.
- `prettier` prima di committare: `pnpm run format`.

---

## Segnalare un problema di sicurezza

Non aprite una issue pubblica: vedi [SECURITY.md](SECURITY.md).

## Codice di condotta

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licenza dei contributi

Contribuendo accettate che il vostro contributo sia distribuito con licenza
**EUPL 1.2**, la stessa del progetto.
