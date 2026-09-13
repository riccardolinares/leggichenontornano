/**
 * I criteri classici di risoluzione delle antinomie.
 *
 * *Lex specialis derogat generali*, *lex posterior derogat priori*, *lex
 * superior derogat inferiori*. Non sono automatismi: sono criteri che un
 * giurista applica valutando. Qui si dice soltanto se il criterio **è
 * astrattamente applicabile** ai due atti coinvolti, e lo si dice con parole
 * caute.
 *
 * La riga compare su ogni scheda, sempre, anche quando dice che nessun criterio
 * si applica: se comparisse a intermittenza, la sua assenza diventerebbe un
 * segnale ambiguo e il lettore inizierebbe a leggerci dentro una conclusione che
 * non abbiamo tratto.
 */
import type { ActView } from './corpus-view.js';
import type { Resolution } from './types.js';

/**
 * Calcola le tre righe di possibile risoluzione per una coppia di atti.
 * `a` è l'atto che si trova nella posizione problematica, `b` l'altro.
 */
export function resolutionsFor(a: ActView | null, b: ActView | null): Resolution[] {
  return [posteriorita(a, b), gerarchia(a, b), specialita(a, b)];
}

function posteriorita(a: ActView | null, b: ActView | null): Resolution {
  const da = a?.publicationDate ?? a?.inForceFrom ?? null;
  const db = b?.publicationDate ?? b?.inForceFrom ?? null;
  if (!da || !db) {
    return {
      criterion: 'posteriorita',
      status: 'da-valutare',
      explanation:
        'Non conosciamo con certezza la data di entrambi gli atti, quindi non possiamo dire quale sia posteriore.',
    };
  }
  if (da === db) {
    return {
      criterion: 'posteriorita',
      status: 'non-si-applica',
      explanation: 'I due atti portano la stessa data: il criterio cronologico non li distingue.',
    };
  }
  const [later, earlier] = da > db ? [a, b] : [b, a];
  return {
    criterion: 'posteriorita',
    status: 'si-applica',
    explanation: `Il criterio cronologico è astrattamente invocabile: ${shortLabel(later)} è posteriore a ${shortLabel(earlier)}. Se i due atti hanno pari rango e pari grado di specialità, di regola prevale il posteriore.`,
  };
}

function gerarchia(a: ActView | null, b: ActView | null): Resolution {
  if (!a || !b || a.sourceRank === 0 || b.sourceRank === 0) {
    return {
      criterion: 'gerarchia',
      status: 'da-valutare',
      explanation: 'Non abbiamo classificato con certezza il rango di entrambe le fonti.',
    };
  }
  if (a.sourceRank === b.sourceRank) {
    return {
      criterion: 'gerarchia',
      status: 'non-si-applica',
      explanation: 'Le due fonti hanno lo stesso rango: il criterio gerarchico non li distingue.',
    };
  }
  const [higher, lower] = a.sourceRank < b.sourceRank ? [a, b] : [b, a];
  return {
    criterion: 'gerarchia',
    status: 'si-applica',
    explanation: `Il criterio gerarchico è astrattamente invocabile: ${shortLabel(higher)} è fonte di rango superiore rispetto a ${shortLabel(lower)}.`,
  };
}

/**
 * La specialità non è deducibile dai metadati: dipende dal rapporto fra le
 * fattispecie, che è esattamente ciò che un giurista valuta. Diciamo che è da
 * valutare, e diciamo perché — è più utile di un verdetto inventato.
 */
function specialita(a: ActView | null, b: ActView | null): Resolution {
  return {
    criterion: 'specialita',
    status: 'da-valutare',
    explanation:
      a && b
        ? 'La specialità dipende dal rapporto fra le fattispecie disciplinate, che non ricaviamo dai metadati: va valutata leggendo le due norme.'
        : 'Non abbiamo entrambi gli atti nel corpus, quindi non possiamo nemmeno impostare il confronto.',
  };
}

/**
 * Riga da mostrare quando nessun criterio si applica. Serve una riga esplicita:
 * l'assenza di righe non deve poter essere letta come «non c'è problema».
 */
export function noResolution(reason: string): Resolution {
  return { criterion: 'nessuno', status: 'non-si-applica', explanation: reason };
}

function shortLabel(act: ActView | null): string {
  if (!act) return 'l’altro atto';
  const type = (act.actType ?? 'atto').replace(/_/g, ' ');
  const date = act.publicationDate ?? act.inForceFrom ?? '';
  const year = date.slice(0, 4);
  const number = act.urn.split(';')[1] ?? '';
  return year ? `${type} n. ${number} del ${year}` : `${type} n. ${number}`;
}
