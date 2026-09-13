import { NextResponse, type NextRequest } from 'next/server';

/*
 * I due punti non arrivano mai al routing dei file.
 *
 * Le pronunce stavano su `/corte/ECLI%3AIT%3ACOST%3A2001%3A251`. In locale
 * funzionava — `next start` serviva sia la forma codificata sia quella con i
 * due punti in chiaro — e in produzione rispondevano 404 tutte e cinquantacinque:
 * il livello che serve i file generati non ritrova un percorso che contiene i
 * due punti, codificati o no. Il difetto stava lì, non nella pagina.
 *
 * Lo schema è cambiato e quegli indirizzi non esistono più (ADR 0013), ma
 * restano in giro: erano in sitemap e possono essere stati incollati da
 * qualche parte. Vanno accompagnati al nuovo, e per farlo bisogna prima
 * riuscire a vederli.
 *
 * Il middleware gira **prima** del routing dei file ed è l'unico punto in cui
 * si è certi che quella richiesta passi. Qui non si decide dove mandarla — non
 * si legge il dataset, non si conosce nessuna pronuncia — si toglie di mezzo il
 * carattere che la fa sparire, riscrivendo il percorso in una forma innocua.
 * A risolverla è la pagina, che è l'unico posto che il dataset lo conosce.
 */

const PREFISSO = '/corte/';

export function middleware(request: NextRequest) {
  const percorso = request.nextUrl.pathname;
  if (!percorso.startsWith(PREFISSO)) return NextResponse.next();

  const segmento = percorso.slice(PREFISSO.length);
  if (segmento.length === 0 || segmento.includes('/')) return NextResponse.next();

  let scritto: string;
  try {
    scritto = decodeURIComponent(segmento);
  } catch {
    // Un segmento che non si decodifica non è un indirizzo nostro: lo lasciamo
    // seguire la sua strada e finire sul 404, che è la risposta giusta.
    return NextResponse.next();
  }
  if (!scritto.toLowerCase().startsWith('ecli:')) return NextResponse.next();

  /* La stessa normalizzazione di `ecliNelPercorso`, ricopiata invece che
     importata: il middleware gira sul runtime edge, e tirarci dentro il modulo
     dei testi significherebbe tirarci dentro il parser Akoma Ntoso. Che le due
     forme restino allineate lo verifica il test end-to-end, che chiede proprio
     un vecchio indirizzo e si aspetta il redirect. */
  const url = request.nextUrl.clone();
  url.pathname = `${PREFISSO}${scritto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: '/corte/:segmento*' };
