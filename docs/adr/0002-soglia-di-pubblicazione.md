# 0002 — Soglia di pubblicazione all'85% di precisione

- **Stato:** Accettata
- **Data:** 2026-09-12

## Contesto

Il danno di una segnalazione falsa su una legge è asimmetrico e permanente:
distrugge più di quanto dieci segnalazioni corrette costruiscano. Serve una
regola che valga *prima* che il progetto arrivi in prima pagina, non dopo.

## Decisione

Un tipo di controllo viene pubblicato solo quando la revisione umana su campione
supera l'**85% di precisione**, con un campione di almeno **30 revisioni**. Sotto
soglia, o sotto la dimensione minima di campione, il tipo resta in coda interna e
le sue segnalazioni non compaiono sul sito pubblico né nel dataset pubblicato.

La regola è codificata in `packages/engine/src/publication-gate.ts` e applicata
nel punto di esportazione, non lasciata alla disciplina di chi pubblica. La
precisione corrente per tipo è esposta dall'API e mostrata nella pagina **Dati**,
inclusi i tipi sotto soglia con la motivazione della loro esclusione.

## Conseguenze

- Positiva: la soglia mostrata è un elemento di credibilità, non una limitazione.
  Dichiarare pubblicamente cosa non pubblichiamo è la parte che regge l'esame di
  un giurista ostile.
- Positiva: allinea gli incentivi. Per pubblicare un controllo nuovo bisogna
  misurarlo, non convincersene.
- Negativa: all'avvio il sito mostra solo controlli di livello 1. Accettato: è il
  livello con precisione attesa vicina al 100% ed è anche quello con gli esempi
  più indifendibili.
- Negativa: serve infrastruttura di revisione umana dal primo giorno. Accettato:
  è `packages/engine/src/review/`.
