## Cosa cambia

<!-- Una o due frasi. Il «perché» sta sotto. -->

## Perché

<!-- Il caso reale che questa modifica risolve. Se è un difetto che produceva
     una segnalazione falsa, scrivete quale: sono i commenti più utili del
     repository. -->

## Verifica

```bash
pnpm run build && pnpm run typecheck && pnpm run test
pnpm --filter @leggichenontornano/web run build && pnpm run e2e
```

- [ ] I test passano, audit di accessibilità compreso
- [ ] Nessuna regola axe disattivata (se una violazione è un falso positivo, è documentata nel test con il motivo)
- [ ] `pnpm run format`

## Se tocca un controllo

- [ ] La **regola in chiaro** nella `CheckDefinition` descrive quello che il codice fa davvero
- [ ] Test per un vero positivo, per un caso limite che **non** deve scattare, e per la stabilità degli identificatori
- [ ] Precisione attesa dichiarata a priori
- [ ] Registrato in `packages/engine/src/registry.ts`

## Se cambia il numero di segnalazioni

Scrivete il prima e il dopo, e **perché il dopo è più giusto**. Un calo non è
una regressione: sul corpus reale le segnalazioni sono passate da 238 a 103
mentre la qualità saliva, un difetto della fonte alla volta.

|                 | prima | dopo |
| --------------- | ----- | ---- |
| pubblicate      |       |      |
| in coda interna |       |      |

## Vincoli

Nessuno di questi è burocrazia: sono le decisioni che tengono in piedi il
progetto, e si cambiano con una nuova ADR, non con una PR che le aggira.

- [ ] Nessun percorso di codice chiede a un modello se due norme si contraddicono
- [ ] Nessuna prosa generata da un modello finisce nel sito
- [ ] Nessuno scraping del portale di consultazione di Normattiva
- [ ] Nessun grafo force-directed, nessuna funzione di voto
- [ ] Nessuna dipendenza da servizi chiusi nel percorso principale
