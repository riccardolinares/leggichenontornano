import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/segnalazione/route';

/**
 * La segnalazione non si perde mai.
 *
 * È il vincolo per cui questo modulo esiste: chi trova un errore nel sito non
 * deve sapere cos'è una issue per segnalarlo, e non deve nemmeno trovarsi
 * davanti a un muro se qualcosa dalla nostra parte non funziona. Quando
 * l'apertura automatica non è disponibile — per qualunque motivo — la risposta
 * deve dirlo con un codice che il modulo riconosce, così ripiega sulla strada
 * di GitHub con il testo già dentro.
 *
 * Il caso del limite di frequenza era un vicolo cieco vero: la rotta
 * rispondeva «riprovate fra poco» e il modulo mostrava quella frase e basta.
 * Chi aveva appena scritto tre righe su una legge sbagliata le perdeva.
 */

function invio(corpo: Record<string, unknown>, ip: string): Request {
  return new Request('http://127.0.0.1/api/segnalazione', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify(corpo),
  });
}

const SEGNALAZIONE = {
  tipo: 'dato-sbagliato',
  messaggio: 'La data di abrogazione indicata su questa scheda non corrisponde alla Gazzetta.',
  pagina: '/anomalia/qualcosa',
};

describe('rotta della segnalazione', () => {
  it('senza token dice che l’apertura automatica non è configurata', async () => {
    const risposta = await POST(invio(SEGNALAZIONE, '10.0.0.1'));
    expect(risposta.status).toBe(503);
    expect(await risposta.json()).toMatchObject({
      errore: 'apertura-automatica-non-configurata',
    });
  });

  it('oltre il limite offre comunque la strada su GitHub, non un muro', async () => {
    // Un indirizzo diverso dagli altri test: il limite è per indirizzo, e due
    // test che se lo dividono si fanno fallire a vicenda a seconda dell'ordine.
    const ip = '10.0.0.2';
    for (let i = 0; i < 3; i++) await POST(invio(SEGNALAZIONE, ip));

    const risposta = await POST(invio(SEGNALAZIONE, ip));
    expect(risposta.status).toBe(429);
    const dati = (await risposta.json()) as { errore?: string; motivo?: string };
    /* Il codice è quello che il modulo riconosce per ripiegare. Se qualcuno lo
       cambia in un messaggio discorsivo, il ripiego smette di scattare e il
       guasto non si vede: la rotta risponde, il modulo mostra una frase, e la
       segnalazione sparisce. */
    expect(dati.errore).toBe('apertura-automatica-non-disponibile');
    // Il motivo resta distinguibile: è la stessa situazione per chi segnala,
    // non per chi legge i log.
    expect(dati.motivo).toBe('troppe-richieste');
  });

  it('l’esca compilata riceve una risposta gentile e non apre niente', async () => {
    const risposta = await POST(
      invio(
        { ...SEGNALAZIONE, sitoWeb: 'http://qualcosa', messaggio: SEGNALAZIONE.messaggio },
        '10.0.0.3',
      ),
    );
    expect(risposta.status).toBe(200);
    expect(await risposta.json()).toMatchObject({ esito: 'ricevuta' });
  });
});
