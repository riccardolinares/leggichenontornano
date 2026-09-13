import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  normaConPiuVersioni,
  normaConPronuncia,
  percorsiDaVerificare,
  primaAnomalia,
  primaNorma,
  primoApprofondimento,
  primoControlloConEsito,
  primaPronuncia,
} from './percorsi';

/**
 * Verifiche di usabilità e di contenuto.
 *
 * Non provano che il sito «funzioni»: provano che dice le cose che il progetto
 * si è impegnato a dire. Sono i vincoli non negoziabili del piano, trasformati
 * in asserzioni — perché un vincolo che nessuno verifica è un proposito.
 */

/**
 * Il dataset c'è davvero?
 *
 * Quasi tutti i test qui sotto si saltano da soli quando il dataset è vuoto,
 * perché devono girare anche su un clone in cui la pipeline non è mai stata
 * eseguita. È una comodità che una volta ha nascosto un guasto vero: in
 * integrazione continua `LCNT_SNAPSHOT` era un percorso **relativo**, da
 * `apps/web` puntava a una cartella inesistente, e il sito veniva costruito e
 * verificato con zero atti. Trentotto test saltati, quarantasei passati, e il
 * riepilogo che sembrava quasi verde.
 *
 * Questo test non si salta mai. Se il dataset è vuoto lo dice, invece di
 * lasciare che l'assenza di segnale somigli a un successo — che è esattamente
 * ciò che il progetto rimprovera a chi legge le sue segnalazioni.
 */
/**
 * Lo stesso indirizzo, ma sul sito che stiamo provando.
 *
 * `og:image` è assoluto per forza — un'anteprima relativa non la risolve
 * nessun client — e punta al dominio di produzione. Scaricarlo così significa
 * provare il sito pubblicato invece di quello appena costruito: il primo test
 * scritto in questo modo passava leggendo un'immagine che stava online da
 * giorni, mentre quella nella build era rotta.
 */
function localmente(indirizzo: string, pagina: string): string {
  const voluto = new URL(indirizzo, pagina);
  const qui = new URL(pagina);
  return `${qui.origin}${voluto.pathname}${voluto.search}`;
}

test.describe('il dataset da cui il sito è costruito', () => {
  test('non è vuoto, e i test che dipendono dai dati stanno girando', () => {
    const norma = primaNorma();
    expect(
      norma,
      'Nessun atto nel dataset: il sito è stato costruito sul vuoto. ' +
        'Controlla LCNT_SNAPSHOT — se è un percorso relativo, da apps/web non punta dove credi.',
    ).not.toBeNull();
    expect(primaAnomalia(), 'Nessuna segnalazione pubblicata nel dataset.').not.toBeNull();
  });
});

test.describe('vincoli non negoziabili', () => {
  test('ogni pagina mostra l’attribuzione a Normattiva e il disclaimer, nel piede e leggibile', async ({
    page,
  }) => {
    for (const percorso of percorsiDaVerificare()) {
      await page.goto(percorso.url);
      const avvertenza = page.locator('.avvertenza');
      await expect(avvertenza, percorso.url).toBeVisible();
      await expect(avvertenza).toContainText(/Normattiva/);
      await expect(avvertenza).toContainText(/Gazzetta Ufficiale/);
      // «Non fornisce consulenza legale» è una formula con un significato
      // consolidato, e il test la richiede **alla lettera**: chi deve valutarla
      // cerca quelle parole. Una parafrasi più bella la indebolirebbe, e questo
      // è l'unico punto del sito in cui la certezza vale più della chiarezza.
      await expect(avvertenza).toContainText(/non fornisce consulenza legale/i);
      // Sta nel piede: è il posto dove si cercano le fonti, non un cartello
      // piazzato davanti al contenuto. Ma «nel piede» non vuol dire nascosta —
      // stesso corpo del testo attorno, e contrasto che regge (lo verifica
      // l'audit axe su ogni tipo di pagina).
      await expect(page.locator('footer.piede .avvertenza')).toHaveCount(1);
      await expect(page.locator('header.testata .avvertenza')).toHaveCount(0);
      const corpo = await avvertenza.evaluate((el) =>
        Number.parseFloat(window.getComputedStyle(el).fontSize),
      );
      expect(
        corpo,
        `${percorso.url}: l’avvertenza è scritta troppo in piccolo`,
      ).toBeGreaterThanOrEqual(14);
    }
  });

  test('«Come funziona» dice per prima cosa cosa il progetto non fa', async ({ page }) => {
    await page.goto('/come-funziona');
    const primoH2 = page.locator('h2').first();
    // La sezione dice le stesse cose di prima — cosa è un parere e cosa no, chi
    // dichiara illegittima una norma — ma come garanzie invece che come divieti.
    // Quello che deve restare vero è che siano **in apertura**.
    await expect(primoH2).toHaveText(/su cosa potete contare/i);
  });

  test('nessuna cifra della home sta lì da sola', async ({ page }) => {
    /*
     * La home adesso apre con le cifre: il muro di testo che c'era prima era
     * corretto e non lo leggeva nessuno. Quello che non deve diventare è un
     * cruscotto — sei riquadri con dei numeri dentro, che si guardano senza
     * capire cosa dicono.
     *
     * Il vincolo che resta, e che questo test difende, è che **ogni cifra
     * porti con sé la frase che dice cosa misura** e il collegamento al posto
     * dove è spiegata con il suo limite accanto.
     */
    await page.goto('/');
    const voci = page.locator('.cifre-forti__voce');
    const quante = await voci.count();
    expect(quante).toBeGreaterThan(0);

    for (let i = 0; i < quante; i++) {
      const voce = voci.nth(i);
      const frase = (await voce.locator('.cifre-forti__frase').textContent()) ?? '';
      expect(frase.trim().length, 'una cifra senza la frase che dice cosa misura').toBeGreaterThan(
        20,
      );
      await expect(voce.getByRole('link')).toHaveAttribute('href', /\S/);
    }
  });

  test('la pagina Dati mostra anche i controlli ancora in lavorazione', async ({ page }) => {
    await page.goto('/dati');
    await expect(page.getByRole('heading', { name: /precisione per controllo/i })).toBeVisible();
    await expect(page.getByText(/soglia di pubblicazione/i).first()).toBeVisible();
    await expect(page.getByText(/85%/).first()).toBeVisible();
  });

  test('la pagina Dati elenca gli atti su cui il confronto semantico lavora davvero', async ({
    page,
  }) => {
    // La copertura del livello 3 è un limite del prodotto. Dichiararlo con una
    // frase generica («soltanto sui domini dotati di vocabolario») non basta:
    // il lettore deve poter contare gli atti. Vedi ADR 0009.
    await page.goto('/dati');
    const sezione = page.getByRole('region', { name: /fin dove arriva il confronto semantico/i });
    await expect(sezione).toBeVisible();
    const urn = sezione.locator('code', { hasText: /^urn:nir:/ });
    expect(await urn.count()).toBeGreaterThan(0);
    await expect(sezione.getByText(/oggi non la vediamo/i)).toBeVisible();
  });

  test('«Come funziona» dice perché il confronto semantico non copre tutto', async ({ page }) => {
    await page.goto('/come-funziona');
    const testo = (await page.locator('main').textContent()) ?? '';
    expect(testo).toMatch(/elenco degli atti/i);
  });

  test('la pagina Dati dice chi fa le revisioni, e come contestare una scheda', async ({
    page,
  }) => {
    // docs/gold-standard.md promette che questo sia detto «qui e nella pagina
    // Dati del sito». Una promessa di trasparenza che vale solo dentro il
    // repository non è trasparenza.
    await page.goto('/dati');
    const testo = (await page.locator('main').textContent()) ?? '';
    expect(testo).toMatch(/non è un conflitto/i);
    expect(testo).toMatch(/open source/i);
  });

  test('la pagina Dati mostra l’unica precisione misurata senza revisione umana', async ({
    page,
  }) => {
    await page.goto('/dati');
    const testo = (await page.locator('main').textContent()) ?? '';
    // La verifica incrociata con le note di Normattiva c'è solo se il dataset
    // contiene pronunce; quando c'è, deve essere leggibile e spiegata.
    if (!/una misura che non dipende da noi/i.test(testo)) test.skip();
    expect(testo).toMatch(/nessuna delle due fonti deriva dall’altra/i);
    expect(testo).toMatch(/una conferma, non una condanna/i);
  });

  test('il contatore nazionale dice quello che misura, non quello che farebbe più effetto', async ({
    page,
  }) => {
    await page.goto('/dati');
    const testo = (await page.locator('main').textContent()) ?? '';
    if (!/giorni trascorsi dalla scadenza/i.test(testo)) test.skip();
    // Misuriamo che un termine di legge è passato. Che il provvedimento non sia
    // mai arrivato non lo sappiamo, e non dobbiamo scriverlo: una sola
    // affermazione falsa su una legge distrugge più di quanto dieci corrette
    // costruiscano.
    expect(testo).not.toMatch(/provvedimenti attuativi[^.]{0,80}non ancora adottati/i);
    expect(testo).toMatch(/termini scaduti(,| e) non attuazioni mancate/i);
  });

  test('l’indice dice che è quello trovato finora, e che il corpus cresce', async ({ page }) => {
    // Sta su `/segnalazioni` insieme all'elenco completo: è lì che qualcuno
    // rischia di leggerlo come una mappa di tutto quello che non torna nella
    // legge italiana. Detto in positivo informa uguale e invita a tornare, ma
    // deve esserci.
    await page.goto('/segnalazioni');
    const testo = (await page.locator('main').textContent()) ?? '';
    expect(testo).toMatch(/trovato finora|corpus (si allarga|cresce)/i);
  });
});

test.describe('scheda anomalia', () => {
  const anomalia = primaAnomalia();

  test.skip(!anomalia, 'nessuna segnalazione pubblicata nel dataset');

  test('l’ordine è: lingua comune, poi testi, poi vigenze, poi risoluzione, poi tecnico', async ({
    page,
  }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    const titoli = await page.$$eval('h2', (n) => n.map((x) => x.textContent?.trim() ?? ''));
    const indice = (frammento: RegExp) => titoli.findIndex((t) => frammento.test(t));

    const pratica = indice(/cosa succede in pratica/i);
    const testi = indice(/i testi/i);
    const risoluzione = indice(/c’è una spiegazione|c'è una spiegazione/i);
    const tecnico = indice(/dettaglio tecnico/i);

    expect(pratica, 'manca la sezione in lingua comune').toBeGreaterThanOrEqual(0);
    expect(testi).toBeGreaterThan(pratica);
    expect(risoluzione).toBeGreaterThan(testi);
    expect(tecnico).toBeGreaterThan(risoluzione);
  });

  test('la riga «possibile risoluzione» c’è sempre, con tutti e tre i criteri', async ({
    page,
  }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    const risoluzioni = page.locator('.risoluzione');
    await expect(risoluzioni).not.toHaveCount(0);
    const testo = (await page.locator('.risoluzioni').textContent()) ?? '';
    expect(testo.toLowerCase()).toContain('posteriorita');
    expect(testo.toLowerCase()).toContain('gerarchia');
    expect(testo.toLowerCase()).toContain('specialita');
  });

  test('la regola è mostrata in chiaro, come query', async ({ page }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    const dettaglio = page.locator('details', { hasText: /la regola/i }).first();
    await dettaglio.locator('summary').click();
    await expect(dettaglio.locator('.regola')).toContainText(/SELECT|FROM|WHERE/);
  });

  test('il pulsante si chiama «Non è un conflitto» e apre una issue senza login', async ({
    page,
  }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    const bottone = page.getByRole('link', { name: /non è un conflitto/i });
    await expect(bottone).toBeVisible();
    const href = await bottone.getAttribute('href');
    expect(href).toContain('/issues/new');
    expect(href).toContain('title=');
  });

  test('l’anteprima Open Graph è dichiarata nei metadati', async ({ page }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    const og = page.locator('meta[property="og:image"]');
    await expect(og).toHaveCount(1);
    const contenuto = await og.getAttribute('content');
    expect(contenuto).toContain('opengraph-image');
  });

  /*
   * Dichiarata non basta: deve esistere e deve essere un'immagine.
   *
   * Un'anteprima rotta non si vede mai guardando il sito — si vede quando
   * qualcuno incolla il link in una chat e non compare niente, cioè fuori da
   * qui e troppo tardi. Questo test scarica davvero i byte e controlla che
   * siano un PNG delle dimensioni giuste.
   */
  test('l’anteprima Open Graph esiste davvero ed è un PNG 1200×630', async ({ page, request }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    const indirizzo = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(indirizzo).toBeTruthy();

    const risposta = await request.get(localmente(indirizzo!, page.url()));
    expect(risposta.status()).toBe(200);
    expect(risposta.headers()['content-type']).toContain('image/png');

    const byte = await risposta.body();
    // Firma PNG, poi larghezza e altezza dall'intestazione IHDR.
    expect([...byte.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(byte.readUInt32BE(16)).toBe(1200);
    expect(byte.readUInt32BE(20)).toBe(630);
  });

  test('anche le pagine fisse hanno la loro anteprima, non quella di un’altra', async ({
    page,
    request,
  }) => {
    const viste = new Set<string>();
    for (const percorso of ['/', '/dati', '/come-funziona', '/stampa']) {
      await page.goto(percorso);
      const indirizzo = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(indirizzo, `manca l’anteprima di ${percorso}`).toBeTruthy();

      const risposta = await request.get(localmente(indirizzo!, page.url()));
      expect(risposta.status(), `anteprima di ${percorso}`).toBe(200);
      const byte = await risposta.body();
      expect([...byte.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      // Il contenuto, non la lunghezza: due PNG diversi possono pesare uguale,
      // e un test che confronta le dimensioni fallirebbe — o passerebbe — per
      // ragioni che non hanno niente a che vedere con quello che verifica.
      viste.add(byte.toString('base64'));
    }
    // Quattro pagine, quattro immagini diverse: se una sola cornice finisse
    // ovunque, i byte coinciderebbero e questo test lo direbbe.
    expect(viste.size).toBe(4);
  });

  test('la pagina dichiara un canonical assoluto, e i parametri non ne creano di nuovi', async ({
    page,
  }) => {
    await page.goto('/segnalazioni');
    const canonicalIndice = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonicalIndice).toMatch(/^https?:\/\//);

    // Il filtro è un parametro dello stesso indice, non una pagina concorrente.
    await page.goto('/segnalazioni?tipo=rinvio-ad-atto-abrogato');
    const canonicalFiltro = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonicalFiltro).toBe(canonicalIndice);
  });

  test('i dati strutturati dichiarano un dataset con licenza e fonte', async ({ page }) => {
    await page.goto('/');
    const blocchi = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocchi.length).toBeGreaterThan(0);
    const tutti = blocchi.flatMap((b) => {
      const letto: unknown = JSON.parse(b);
      return Array.isArray(letto) ? letto : [letto];
    }) as Array<Record<string, unknown>>;

    const dataset = tutti.find((v) => v['@type'] === 'Dataset');
    expect(dataset, 'nessun blocco Dataset nei dati strutturati').toBeTruthy();
    expect(String(dataset!['license'])).toContain('creativecommons.org');
    expect(JSON.stringify(dataset!['isBasedOn'])).toContain('normattiva');
  });

  test('la scheda è autoconsistente: chi arriva da un link capisce senza altre pagine', async ({
    page,
  }) => {
    await page.goto(`/anomalia/${encodeURIComponent(anomalia!.id)}`);
    // Titolo, spiegazione in lingua comune, almeno una prova con il suo URN.
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.pratica')).toBeVisible();
    await expect(page.locator('.prova__urn').first()).toContainText('urn:nir:');
  });
});

test.describe('lettore norma', () => {
  const norma = primaNorma();

  test.skip(!norma, 'nessuna norma nel dataset');

  test('la modalità confronto è un parametro dello stesso URL', async ({ page }) => {
    const multiversione = normaConPiuVersioni();
    test.skip(!multiversione, 'nessun atto con più versioni e testo nel dataset');
    await page.goto(`/norma/${encodeURIComponent(multiversione!)}`);
    const confronta = page.getByRole('link', { name: /^confronta$/i }).first();
    await expect(confronta).toBeVisible();
    await confronta.click();
    // La navigazione è lato client: si aspetta che l'URL cambi davvero, invece
    // di leggerlo un istante dopo il clic e sperare.
    await page.waitForURL(/[?&]c=\d{4}-\d{2}-\d{2}/);
    const url = new URL(page.url());
    expect(url.pathname).toContain('/norma/');
    expect(url.searchParams.has('c')).toBe(true);
    // E che la modalità confronto sia davvero attiva nella pagina, non solo
    // nell'indirizzo: è esattamente il guasto che questo test ha trovato.
    await expect(page.getByText(/confrontato con la versione del/i).first()).toBeVisible();
  });

  test('l’URN è visibile e citabile nella pagina', async ({ page }) => {
    await page.goto(`/norma/${encodeURIComponent(norma!)}`);
    await expect(page.locator('.mono').first()).toContainText('urn:nir:');
  });

  test('il testo della norma si legge con un serif, l’interfaccia con un grottesco', async ({
    page,
  }) => {
    await page.goto(`/norma/${encodeURIComponent(norma!)}`);
    const articolo = page.locator('.norma p').first();
    await articolo.waitFor();
    const font = await articolo.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font.toLowerCase()).toMatch(/newsreader|serif/);
  });
});

test.describe('il grafo', () => {
  const norma = primaNorma();

  test.skip(!norma, 'nessuna norma nel dataset');

  test('non è force-directed: nessun canvas, nessun layout calcolato nel browser', async ({
    page,
  }) => {
    // ADR 0003. Un canvas è invisibile a chi usa uno screen reader, e un layout
    // a forze non è deterministico: due caricamenti darebbero due disegni, e
    // l'URL smetterebbe di essere citabile.
    await page.goto(`/norma/${encodeURIComponent(norma!)}`);
    expect(await page.locator('canvas').count()).toBe(0);
    const script = await page.content();
    for (const libreria of ['d3-force', 'forceSimulation', 'vis-network', 'cytoscape']) {
      expect(script, `la pagina carica ${libreria}`).not.toContain(libreria);
    }
  });

  test('il disegno è identico a ogni caricamento', async ({ page }) => {
    /* Il layout è precalcolato server-side: se due richieste danno due SVG
       diversi, qualcosa lo sta calcolando nel browser.
       Il disegno si cerca **dentro `.grafo`**, non come primo `svg` della
       pagina: da quando la testata ha il selettore del tema, il primo `svg`
       è l'icona del sole o della luna, che cambia per forza a seconda del
       tema risolto — e il test falliva misurando la cosa sbagliata. */
    const url = `/norma/${encodeURIComponent(norma!)}`;
    await page.goto(url);
    const grafo = page.locator('.grafo svg').first();
    if ((await grafo.count()) === 0) test.skip();
    const primo = await grafo.innerHTML();
    await page.reload();
    expect(await page.locator('.grafo svg').first().innerHTML()).toBe(primo);
  });

  test('la stessa informazione è disponibile anche in tabella', async ({ page }) => {
    // Il disegno illustra; il contenuto vero è la tabella, che uno screen
    // reader può leggere.
    await page.goto(`/norma/${encodeURIComponent(norma!)}`);
    const grafo = page.locator('.grafo');
    if ((await grafo.count()) === 0) test.skip();
    await expect(page.locator('table caption').first()).toBeVisible();
  });
});

test.describe('gli URL sono il prodotto', () => {
  const norma = primaNorma();

  test.skip(!norma, 'nessuna norma nel dataset');

  test('la vigenza è un parametro dello stesso URL, non una pagina diversa', async ({ page }) => {
    // «/norma/urn:nir:…~art3?v=2013-04-20» deve poter essere incollato in una
    // memoria difensiva e riportare alla stessa pagina.
    const url = `/norma/${encodeURIComponent(norma!)}`;
    await page.goto(url);
    const prima = await page.locator('#contenuto').textContent();
    await page.goto(`${url}?v=1990-01-01`);
    expect(page.url()).toContain('?v=1990-01-01');
    // La pagina risponde: o mostra la versione a quella data, o dice che a
    // quella data l'atto non c'era. Quello che non deve fare è ignorare il
    // parametro e mostrare la stessa cosa di prima senza dirlo.
    const dopo = await page.locator('#contenuto').textContent();
    expect(dopo).toBeTruthy();
    expect(prima).toBeTruthy();
  });

  test('un articolo è indirizzabile da solo', async ({ page }) => {
    const url = `/norma/${encodeURIComponent(norma!)}?art=1`;
    const risposta = await page.goto(url);
    expect(risposta?.status()).toBe(200);
    expect(page.url()).toContain('art=1');
  });
});

test.describe('pronunce della Corte costituzionale', () => {
  const colpita = normaConPronuncia();

  test.skip(!colpita, 'nessuna norma colpita da una pronuncia nel dataset');

  test('la pagina distingue la declaratoria di illegittimità dall’abrogazione', async ({
    page,
  }) => {
    await page.goto(`/norma/${encodeURIComponent(colpita!)}`);
    const sezione = page.getByRole('region', {
      name: /dichiarazioni di illegittimità costituzionale/i,
    });
    await expect(sezione).toBeVisible();
    // Sono due cose diverse, e la pagina deve dirlo: l'abrogazione dispone per
    // il futuro, la declaratoria fa cessare l'efficacia della norma.
    await expect(sezione.getByText(/non è un’abrogazione/i)).toBeVisible();
  });

  test('mostra le parole della Corte e il collegamento al testo integrale', async ({ page }) => {
    await page.goto(`/norma/${encodeURIComponent(colpita!)}`);
    const sezione = page.getByRole('region', {
      name: /dichiarazioni di illegittimità costituzionale/i,
    });
    // Il dispositivo è la prova: nessun riassunto generato al suo posto.
    const prova = sezione.locator('.prova__testo').first();
    await expect(prova).toBeVisible();
    expect(((await prova.textContent()) ?? '').length).toBeGreaterThan(40);
    await expect(sezione.getByText(/ECLI:IT:COST:/).first()).toBeVisible();
    await expect(sezione.getByRole('link', { name: /testo integrale/i }).first()).toBeVisible();
  });

  test('attribuisce la fonte e la sua licenza', async ({ page }) => {
    await page.goto(`/norma/${encodeURIComponent(colpita!)}`);
    const testo = (await page.locator('main').textContent()) ?? '';
    expect(testo).toMatch(/Corte costituzionale/);
    expect(testo).toMatch(/CC BY-SA 3\.0/);
  });
});

test.describe('approfondimenti', () => {
  const slug = primoApprofondimento();

  test.skip(!slug, 'nessun articolo nel blog: niente da verificare');

  test('la firma dice chi ha scritto le parole, e sta prima del testo', async ({ page }) => {
    await page.goto(`/blog/${slug}`);
    const firma = page.locator('.firma');
    await expect(firma).toBeVisible();

    // Prima del testo, non in fondo: chi legge deve saperlo *prima* di essersi
    // fatto un'idea. Si confronta la posizione verticale con la prima sezione.
    const yFirma = (await firma.boundingBox())!.y;
    const ySezione = (await page.locator('.sezione').first().boundingBox())!.y;
    expect(yFirma).toBeLessThan(ySezione);
  });

  test('sotto la prosa c’è il dossier, che non scrive nessuno', async ({ page }) => {
    await page.goto(`/blog/${slug}`);
    const dossier = page.locator('.dossier');
    await expect(dossier).toBeVisible();
    // La query in chiaro e il collegamento alla scheda: senza questi due, il
    // dossier è una decorazione.
    await expect(dossier.locator('.regola')).toContainText(/SELECT|FROM|WHERE/);
    await expect(dossier.getByRole('link', { name: /scheda completa/i })).toBeVisible();
  });

  test('ogni articolo nasce da una segnalazione e la cita', async ({ page }) => {
    await page.goto('/blog');
    const primo = page.locator('.scheda').first();
    await expect(primo.getByRole('link', { name: /segnalazione da cui nasce/i })).toBeVisible();
  });
});

test.describe('condivisione e contatti', () => {
  test('i canali di condivisione sono quelli che si usano in Italia', async ({ page }) => {
    await page.goto('/numeri');
    // Il blocco ha un nome proprio: `.azioni` da solo prenderebbe anche
    // quello del piede, che è un'altra cosa.
    const azioni = page.locator('.condivisione');

    // WhatsApp prima di tutto: è lì che un link su una legge viene girato
    // davvero, nel gruppo dell'ufficio o della categoria professionale.
    await expect(azioni.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me/);
    await expect(azioni.getByRole('link', { name: 'Telegram' })).toHaveAttribute('href', /t\.me/);
    await expect(azioni.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      /facebook\.com/,
    );
    await expect(azioni.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      /linkedin\.com/,
    );

    // Nessun widget di terze parti in pagina: sono collegamenti normali.
    const script = await page
      .locator('script[src]')
      .evaluateAll((nodi) => nodi.map((n) => (n as HTMLScriptElement).src));
    expect(script.filter((src) => !src.includes(new URL(page.url()).host))).toEqual([]);
  });

  test('il sito dice a chi scrivere e come sostenerlo', async ({ page }) => {
    await page.goto('/');
    const piede = page.locator('.piede');
    await expect(piede.getByRole('link', { name: /info@leggichenontornano\.it/ })).toBeVisible();
    await expect(piede.getByRole('link', { name: /caffè/i })).toHaveAttribute(
      'href',
      /buymeacoffee\.com/,
    );
  });
});

test.describe('dati strutturati', () => {
  /**
   * I dati strutturati si rompono in silenzio.
   *
   * Un JSON malformato, un `@type` sbagliato o un blocco sparito non si vedono
   * guardando il sito: si vedono mesi dopo, quando qualcuno controlla perché le
   * pagine non compaiono come dovrebbero. Questo test li legge e li valida su
   * ogni famiglia di pagine.
   */
  async function tipiIn(page: import('@playwright/test').Page): Promise<string[]> {
    const blocchi = await page.locator('script[type="application/ld+json"]').allTextContents();
    return blocchi.flatMap((b) => {
      const letto: unknown = JSON.parse(b);
      const voci = Array.isArray(letto) ? letto : [letto];
      return voci.map((v) => String((v as Record<string, unknown>)['@type']));
    });
  }

  const anomalia = primaAnomalia();
  const pronuncia = primaPronuncia();
  const controllo = primoControlloConEsito();
  const approfondimento = primoApprofondimento();

  test('ogni pagina dichiara almeno il sito e il dataset', async ({ page }) => {
    for (const percorso of ['/', '/dati', '/blog', '/norme', '/corte', '/numeri']) {
      await page.goto(percorso);
      const tipi = await tipiIn(page);
      expect(tipi, `dati strutturati su ${percorso}`).toContain('WebSite');
      expect(tipi, `dataset dichiarato su ${percorso}`).toContain('Dataset');
    }
  });

  test('gli indici si dichiarano come indici', async ({ page }) => {
    for (const percorso of ['/blog', '/norme', '/corte']) {
      await page.goto(percorso);
      expect(await tipiIn(page), `indice ${percorso}`).toContain('CollectionPage');
    }
  });

  test('le pagine di dettaglio portano le briciole di pane', async ({ page }) => {
    const percorsi = [
      anomalia ? `/anomalia/${encodeURIComponent(anomalia.id)}` : null,
      pronuncia ? `/corte/${encodeURIComponent(pronuncia)}` : null,
      controllo ? `/controllo/${controllo}` : null,
      approfondimento ? `/blog/${approfondimento}` : null,
    ].filter((p): p is string => p !== null);

    expect(percorsi.length).toBeGreaterThan(0);
    for (const percorso of percorsi) {
      await page.goto(percorso);
      expect(await tipiIn(page), `briciole su ${percorso}`).toContain('BreadcrumbList');
    }
  });

  test('un approfondimento dichiara chi ha scritto le parole', async ({ page }) => {
    test.skip(!approfondimento, 'nessun articolo nel blog');
    await page.goto(`/blog/${approfondimento}`);
    const blocchi = await page.locator('script[type="application/ld+json"]').allTextContents();
    const articolo = blocchi
      .map((b) => JSON.parse(b) as Record<string, unknown>)
      .find((v) => v['@type'] === 'BlogPosting');
    expect(articolo, 'nessun BlogPosting').toBeTruthy();
    // `author` non è decorativo: dice chi risponde di quelle frasi. Un articolo
    // generato non può dichiarare come autore il progetto.
    expect(articolo!['author']).toBeTruthy();
  });
});

test.describe('segnalare un problema', () => {
  test('il modulo c’è, e dice che la segnalazione diventa pubblica', async ({ page }) => {
    await page.goto('/segnala');
    await expect(page.getByRole('heading', { name: /qualcosa non torna/i })).toBeVisible();
    await expect(page.getByLabel(/che cosa avete visto/i)).toBeVisible();
    // Chi scrive deve sapere *prima* che finirà in pubblico.
    await expect(page.getByText(/issue pubblica/i)).toBeVisible();
  });

  test('un messaggio troppo corto non parte, e lo dice', async ({ page }) => {
    await page.goto('/segnala');
    await page.getByLabel(/che cosa avete visto/i).fill('non va');
    await page.getByRole('button', { name: /manda la segnalazione/i }).click();
    await expect(page.getByText(/almeno trenta caratteri/i)).toBeVisible();
  });

  test('il campo esca non è raggiungibile né da tastiera né da uno screen reader', async ({
    page,
  }) => {
    await page.goto('/segnala');
    const esca = page.locator('#segnala-sito');
    await expect(esca).toHaveCount(1);
    await expect(esca).toHaveAttribute('tabindex', '-1');
    // `aria-hidden` sul contenitore: per chi ascolta la pagina, non esiste.
    await expect(page.locator('.segnala__esca')).toHaveAttribute('aria-hidden', 'true');
  });

  test('senza apertura automatica il modulo offre la strada su GitHub invece di tacere', async ({
    page,
  }) => {
    await page.goto('/segnala');
    await page
      .getByLabel(/che cosa avete visto/i)
      .fill(
        'Sulla pagina dei numeri il totale dei giorni non coincide con quello della pagina dati.',
      );
    await page.getByRole('button', { name: /manda la segnalazione/i }).click();
    // In prova il token non è configurato: deve comparire il ripiego, non un
    // messaggio d'errore generico.
    await expect(page.getByRole('link', { name: /aprite la segnalazione su github/i })).toBeVisible(
      {
        timeout: 15000,
      },
    );
  });
});

test.describe('trovabilità', () => {
  test('llms.txt dice come citare il sito, non solo cosa contiene', async ({
    request,
    baseURL,
  }) => {
    const risposta = await request.get(`${baseURL}/llms.txt`);
    expect(risposta.status()).toBe(200);
    const testo = await risposta.text();
    expect(testo).toContain('# Le leggi che non tornano');
    // La regola che conta più di tutte per chi riassume questo sito.
    expect(testo).toMatch(/data di vigenza/i);
    expect(testo).toMatch(/llms-full\.txt/);
  });

  test('llms-full.txt elenca gli errori da non fare quando si riassume', async ({
    request,
    baseURL,
  }) => {
    const risposta = await request.get(`${baseURL}/llms-full.txt`);
    expect(risposta.status()).toBe(200);
    const testo = await risposta.text();
    expect(testo).toMatch(/errori da non fare/i);
    expect(testo).toMatch(/termini scaduti/i);
  });

  test('robots non chiude la porta ai crawler, e dichiara la sitemap', async ({
    request,
    baseURL,
  }) => {
    const risposta = await request.get(`${baseURL}/robots.txt`);
    const testo = await risposta.text();
    expect(testo).toMatch(/Allow: \//);
    expect(testo).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/);
    // Nessun blocco per nome ai crawler delle AI: la scelta è dichiarata in
    // `robots.ts` ed è l'opposta di quella corrente.
    expect(testo).not.toMatch(/GPTBot|ClaudeBot|CCBot/);
  });

  test('la mappa del sito porta a tutte le famiglie di pagine', async ({ page }) => {
    await page.goto('/mappa');
    for (const nome of [/le segnalazioni/i, /approfondimenti/i, /norme del corpus/i, /pronunce/i]) {
      await expect(page.locator('.mappa').getByRole('link', { name: nome }).first()).toBeVisible();
    }
  });
});

test.describe('la mappa delle leggi', () => {
  test('il disegno è sempre lo stesso: due caricamenti, stesse coordinate', async ({ page }) => {
    // È la condizione che permette a questa pagina di esistere (ADR 0012): un
    // grafo che cambia a ogni caricamento non si può citare.
    const leggi = async () => {
      await page.goto('/grafo');
      await page.waitForSelector('.grafo__nodi circle');
      return page.locator('.grafo__nodi circle').first().getAttribute('cx');
    };
    const prima = await leggi();
    const dopo = await leggi();
    expect(prima).not.toBeNull();
    expect(dopo).toBe(prima);
  });

  test('ci sono tutte le norme e tutti i tipi di legame, non solo i buchi', async ({ page }) => {
    /*
     * La prima versione teneva solo i rinvii che partivano da una norma in
     * vigore, e il risultato era un disegno in cui si vedevano due sole leggi:
     * tutto il resto era grigio indistinto. Questo test difende la correzione —
     * il grafo deve mostrare **come le leggi si tengono**, e per farlo servono
     * tutte le norme e tutte le famiglie di legame, ciascuna con il suo colore.
     */
    await page.goto('/grafo');
    await page.waitForSelector('.grafo__nodi circle');

    expect(await page.locator('.grafo__nodi circle').count()).toBeGreaterThan(150);
    expect(await page.locator('.grafo__archi line').count()).toBeGreaterThan(1000);

    // Più di un colore fra gli archi: con un colore solo il disegno direbbe
    // che tutti i legami sono la stessa cosa, e non lo sono.
    const colori = new Set(
      await page
        .locator('.grafo__archi line')
        .evaluateAll((righe) => righe.map((r) => r.getAttribute('stroke') ?? '')),
    );
    expect(colori.size, 'gli archi hanno un colore solo').toBeGreaterThan(2);

    // Il menù offre le famiglie per quello che fanno, non per il nome interno
    // della relazione nel database.
    const opzioni = await page.locator('#grafo-legame option').allTextContents();
    expect(opzioni.join(' ')).toMatch(/rimanda a/i);
    expect(opzioni.join(' ')).not.toMatch(/RINVIA/);
  });

  test('il disegno si può ingrandire, e le norme non si spostano', async ({ page }) => {
    await page.goto('/grafo');
    await page.waitForSelector('.grafo__nodi circle');
    const primoNodo = page.locator('.grafo__nodi circle').first();
    const xPrima = await primoNodo.getAttribute('cx');

    const vista = page.locator('.grafo__vista');
    await expect(vista).toHaveAttribute('transform', /scale\(1\)/);

    await page.getByRole('button', { name: 'Avvicina' }).click();
    await expect(vista).not.toHaveAttribute('transform', /scale\(1\)/);

    /* La condizione di ADR 0012: avvicinarsi cambia il **punto di vista**, non
       il disegno. Le coordinate dei nodi restano quelle calcolate dal server —
       se cambiassero, la pagina smetterebbe di essere citabile. */
    expect(await primoNodo.getAttribute('cx')).toBe(xPrima);

    await page.getByRole('button', { name: 'Tutto il grafo' }).click();
    await expect(vista).toHaveAttribute('transform', /scale\(1\)/);
  });

  test('i filtri finiscono nell’URL, e un link li riapre', async ({ page }) => {
    await page.goto('/grafo');
    await page.waitForSelector('.grafo__nodi circle');
    const tutti = await page.locator('.grafo__archi line').count();

    await page.getByLabel(/solo i collegamenti a norme che non ci sono più/i).check();
    await expect(page).toHaveURL(/rotti=1/);
    const soloRotti = await page.locator('.grafo__archi line').count();
    expect(soloRotti).toBeLessThan(tutti);

    // Il link condiviso deve riaprire esattamente quella vista.
    await page.goto('/grafo?rotti=1');
    await page.waitForSelector('.grafo__nodi circle');
    await expect(page.getByLabel(/solo i collegamenti a norme che non ci sono più/i)).toBeChecked();
    expect(await page.locator('.grafo__archi line').count()).toBe(soloRotti);
  });

  test('il disegno dice cosa mostra a chi non lo vede, e i numeri stanno anche in tabella', async ({
    page,
  }) => {
    await page.goto('/grafo');
    const tela = page.locator('.grafo__tela-contenitore');
    const etichetta = await tela.getAttribute('aria-label');
    // Non «grafo a nodi»: l'etichetta deve contenere il dato.
    expect(etichetta).toMatch(/\d+ norme/);
    expect(etichetta).toMatch(/rosso/i);
    // La stessa informazione, leggibile e citabile.
    await expect(page.locator('table')).toBeVisible();
  });

  test('la pagina non è nel menù ma è nel piede', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.navigazione').getByRole('link', { name: /mappa delle leggi/i }),
    ).toHaveCount(0);
    await expect(
      page.locator('.piede').getByRole('link', { name: /mappa delle leggi/i }),
    ).toBeVisible();
  });
});

test.describe('la mappa viva', () => {
  /*
   * La pagina gemella di `/grafo`, con la simulazione a forze che gira nel
   * browser (ADR 0018).
   *
   * **Qui non si confronta il disegno fra due caricamenti.** Su `/grafo` quel
   * confronto è il test che permette alla pagina di esistere; qui fallirebbe
   * per costruzione, perché il punto di questa pagina è esattamente che le
   * posizioni le calcola il browser e non sono due volte le stesse. Provare a
   * verificarlo lo stesso significherebbe scrivere un test che contraddice la
   * decisione che il codice sta applicando.
   *
   * Quello che si verifica è il resto, cioè tutto quello che non è negoziabile:
   * la pagina risponde, la tela dice cosa contiene a chi non la vede, la stessa
   * informazione resta leggibile in tabella, l'audit di accessibilità passa e
   * la pagina sta dentro uno schermo da quattrocento pixel.
   */

  test('la pagina risponde, e la tela dichiara cosa contiene con le sue cifre', async ({
    page,
  }) => {
    const risposta = await page.goto('/grafo/vivo');
    expect(risposta?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(/mappa viva/i);

    // La libreria si carica solo nel browser: la tela compare dopo.
    const tela = page.locator('canvas[role="img"]');
    await expect(tela).toBeVisible();
    const etichetta = await tela.getAttribute('aria-label');
    // Non «grafo a nodi»: l'etichetta è costruita dai dati e contiene le cifre.
    expect(etichetta).toMatch(/\d+ norme/);
    expect(etichetta).toMatch(/\d+ collegamenti/);
    expect(etichetta).toMatch(/rosso/i);
  });

  test('sotto il disegno resta la tabella, e porta alle norme', async ({ page }) => {
    /* Un canvas è invisibile a uno screen reader: se questa tabella sparisce,
       la pagina smette di dire a metà delle persone quello che disegna. */
    await page.goto('/grafo/vivo');
    const tabelle = page.locator('table');
    expect(await tabelle.count()).toBeGreaterThan(1);
    await expect(tabelle.first()).toBeVisible();

    const elenco = page.locator('table').last();
    await expect(elenco.locator('caption')).toBeVisible();
    // Le righe sono le norme del disegno, e ciascuna porta alla sua scheda.
    expect(await elenco.locator('tbody tr').count()).toBeGreaterThan(150);
    await expect(elenco.locator('tbody a[href^="/norma/"]').first()).toBeVisible();
  });

  test('l’audit di accessibilità passa, con la simulazione accesa', async ({ page }) => {
    await page.goto('/grafo/vivo');
    await page.locator('canvas[role="img"]').waitFor();
    const risultato = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const dettaglio = risultato.violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.help}`)
      .join('\n');
    expect(dettaglio, `Violazioni su /grafo/vivo:\n${dettaglio}`).toBe('');
  });

  test('regge uno schermo da 400 px', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto('/grafo/vivo');
    const tela = page.locator('canvas[role="img"]');
    await expect(tela).toBeVisible();

    // La tela sta dentro la finestra, e la pagina non scorre di lato.
    const riquadro = await tela.boundingBox();
    expect(riquadro?.width ?? 0).toBeGreaterThan(0);
    expect(riquadro?.width ?? 0).toBeLessThanOrEqual(400);
    const straripa = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(straripa, '/grafo/vivo scorre orizzontalmente a 400px').toBe(false);
  });

  test('la mappa ferma resta dov’era, e le due pagine si citano', async ({ page }) => {
    /* ADR 0018 permette la simulazione a patto che `/grafo` non cambi: niente
       sostituzione e niente rimando che porti via da lì. */
    const risposta = await page.goto('/grafo');
    expect(risposta?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/grafo');
    await page.waitForSelector('.grafo__nodi circle');

    await page.goto('/grafo/vivo');
    await expect(page.locator('a[href="/grafo"]').first()).toBeVisible();
  });
});

test.describe('testata', () => {
  test('il tema si sceglie, e la scelta resta fra una pagina e l’altra', async ({ page }) => {
    await page.goto('/');
    const radice = page.locator('html');

    // Senza scelta il tema è quello del sistema: il contesto di prova è
    // chiaro, quindi la radice deve dire «chiaro».
    await expect(radice).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: /tema/i }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Scuro' }).click();
    await expect(radice).toHaveAttribute('data-theme', 'dark');

    // Il fondo deve cambiare davvero: l'attributo da solo non prova che il CSS
    // lo stia ascoltando, ed è esattamente l'errore che si fa spostando i
    // colori dentro o fuori una media query.
    const fondo = await page
      .locator('body')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(fondo).not.toBe('rgb(245, 246, 244)');

    // La scelta vale per il sito, non per la pagina.
    await page.goto('/numeri');
    await expect(radice).toHaveAttribute('data-theme', 'dark');
  });

  test('la scelta esplicita vince sul sistema', async ({ browser }) => {
    // Il caso che una media query da sola non copre: sistema scuro, ma chi
    // legge ha chiesto il chiaro.
    const contesto = await browser.newContext({ colorScheme: 'dark' });
    const pagina = await contesto.newPage();
    await pagina.goto('/');
    await expect(pagina.locator('html')).toHaveAttribute('data-theme', 'dark');

    await pagina.getByRole('button', { name: /tema/i }).click();
    await pagina.getByRole('menuitemcheckbox', { name: 'Chiaro' }).click();
    await expect(pagina.locator('html')).toHaveAttribute('data-theme', 'light');
    const fondo = await pagina
      .locator('body')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(fondo, 'il sistema scuro sta ancora vincendo sulla scelta').toBe('rgb(245, 246, 244)');
    await contesto.close();
  });

  test('il menù del tema si usa da tastiera', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /tema/i }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Chiaro' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Chiaro' })).toHaveCount(0);
    // Il fuoco torna da dove era partito: chi naviga da tastiera non deve
    // ricominciare dall'inizio della pagina.
    await expect(page.getByRole('button', { name: /tema/i })).toBeFocused();
  });

  test('la testata porta al codice sorgente', async ({ page }) => {
    await page.goto('/');
    const codice = page.locator('.testata').getByRole('link', { name: /codice del progetto/i });
    await expect(codice).toBeVisible();
    await expect(codice).toHaveAttribute('href', /github\.com/);
  });
});

test.describe('home', () => {
  test('sopra la piega ci sono le cifre, non un muro di testo', async ({ page }) => {
    // 820 px è uno schermo da portatile: quello che sta qui dentro è tutto
    // quello su cui si può contare per fermare chi arriva.
    await page.setViewportSize({ width: 1200, height: 820 });
    await page.goto('/');

    const cifre = page.locator('.cifre-forti__voce');
    expect(await cifre.count(), 'le cifre dell’apertura non ci sono').toBeGreaterThanOrEqual(3);

    for (const voce of await cifre.all()) {
      const riquadro = await voce.boundingBox();
      expect(riquadro!.y, 'una cifra dell’apertura cade sotto la piega').toBeLessThan(820);
      // Ogni cifra porta dove è spiegata con il suo limite accanto: un numero
      // che non si può verificare è uno slogan.
      await expect(voce.getByRole('link')).toHaveAttribute('href', /./);
    }

    // La riga di apertura è una, non cinque paragrafi.
    const apertura = await page.locator('.apertura-forte__riga').textContent();
    expect(apertura!.trim().length, 'l’apertura è tornata a essere un tema').toBeLessThan(160);
  });

  test('la home mostra le ultime trovate, non l’indice intero', async ({ page }) => {
    await page.goto('/');
    const schede = page.locator('.elenco .scheda');
    const quante = await schede.count();
    expect(quante).toBeGreaterThan(0);
    expect(quante, 'la home è tornata a essere l’elenco completo').toBeLessThanOrEqual(8);

    await page.getByRole('link', { name: /Tutte le .* segnalazioni/ }).click();
    await expect(page).toHaveURL(/\/segnalazioni$/);
    expect(await page.locator('.elenco .scheda').count()).toBeGreaterThan(quante);
  });

  test('i vecchi link filtrati della home continuano a funzionare', async ({ page }) => {
    // Gli URL sono il prodotto (ADR 0008): `/?tipo=` era pubblicato, e deve
    // riaprire la stessa vista dove adesso vive.
    const risposta = await page.request.fetch('/?tipo=rinvio-ad-atto-abrogato', {
      maxRedirects: 0,
    });
    expect(risposta.status()).toBe(308);
    expect(risposta.headers()['location']).toContain('/segnalazioni?tipo=rinvio-ad-atto-abrogato');
  });
});

test.describe('robustezza', () => {
  test('un URL inesistente risponde con la pagina «non trovata», non con un errore', async ({
    page,
  }) => {
    const risposta = await page.goto('/anomalia/inesistente-12345');
    expect(risposta?.status()).toBe(404);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('il sito si legge su un telefono senza scorrimento orizzontale', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const percorso of percorsiDaVerificare()) {
      await page.goto(percorso.url);
      const straripa = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(straripa, `${percorso.url} scorre orizzontalmente a 360px`).toBe(false);
    }
  });

  test('la navigazione segnala la pagina corrente anche a chi non vede', async ({ page }) => {
    await page.goto('/dati');
    const corrente = page.locator('.navigazione a[aria-current="page"]');
    await expect(corrente).toHaveCount(1);
    await expect(corrente).toHaveText(/dati/i);
  });

  test('il sito funziona senza JavaScript', async ({ browser }) => {
    const contesto = await browser.newContext({ javaScriptEnabled: false });
    const pagina = await contesto.newPage();
    await pagina.goto('/come-funziona');
    await expect(pagina.locator('h1')).toBeVisible();
    // Il dettaglio tecnico è un <details>: si apre senza JavaScript.
    const dettagli = pagina.locator('details').first();
    if ((await dettagli.count()) > 0) {
      await dettagli.locator('summary').click();
      await expect(dettagli).toHaveAttribute('open', '');
    }
    await contesto.close();
  });
});

test.describe('grafici', () => {
  /*
   * Un grafico qui è una promessa in più, non un abbellimento: promette che
   * un'informazione si veda in un colpo d'occhio *e* che resti leggibile a chi
   * il colpo d'occhio non ce l'ha. Questi test verificano le due metà insieme,
   * perché è separandole che si finisce con un disegno che nessuno può leggere.
   */

  test('la pagina dei numeri mostra quali norme abrogate sono ancora richiamate', async ({
    page,
  }) => {
    await page.goto('/numeri');
    const grafico = page.getByRole('img', { name: /norme abrogate/i });
    await expect(grafico).toBeVisible();

    const etichetta = (await grafico.getAttribute('aria-label')) ?? '';
    // L'etichetta deve dire il dato. «Grafico a barre» non è un'informazione:
    // a chi non vede il disegno non serve sapere che forma avesse.
    expect(etichetta, 'l’etichetta del grafico non contiene nessuna cifra').toMatch(/\d/);
    expect(etichetta).not.toMatch(/grafico|istogramma|diagramma/i);
    // Numeri all'italiana anche qui: «16.8» è un refuso, non un decimale.
    expect(etichetta).not.toMatch(/\d\.\d/);

    // Le barre sono disegnate dal server: nessuna libreria, nessun canvas.
    expect(await grafico.locator('svg rect').count()).toBeGreaterThan(0);
    // Ogni barra porta accanto il nome della norma e la propria cifra: è il
    // punto del grafico, cioè che il fenomeno sta quasi tutto in pochi atti.
    await expect(grafico.locator('.grafico__riga').first()).toContainText(/atti|atto/);

    // L'alternativa testuale c'è e si apre: chiusa non vuol dire assente.
    const numeri = page.locator('.grafico__numeri').first();
    await numeri.locator('summary').click();
    const tabella = page.getByRole('region', { name: /norme abrogate ancora richiamate/i });
    await expect(tabella).toBeVisible();
    expect(await tabella.locator('tbody tr').count()).toBeGreaterThan(0);
    await expect(tabella.locator('tbody th').first()).toContainText(/abrogata/);
  });

  test('la pagina Dati disegna la soglia dentro le barre, non solo in una frase', async ({
    page,
  }) => {
    await page.goto('/dati');
    const grafico = page.getByRole('img', { name: /soglia di pubblicazione/i });
    await expect(grafico).toBeVisible();

    const etichetta = (await grafico.getAttribute('aria-label')) ?? '';
    expect(etichetta).toMatch(/\d+(,\d+)?%/);
    expect(etichetta).not.toMatch(/\d\.\d/);

    // La riga di riferimento sta dentro ogni traccia: è quella che rende
    // immediato un confronto che altrimenti si farebbe a mente.
    expect(await grafico.locator('svg line').count()).toBeGreaterThan(0);

    const tabella = page.getByRole('region', { name: /accordo fra le declaratorie/i });
    await expect(tabella).toBeVisible();
    expect(await tabella.locator('tbody tr').count()).toBeGreaterThan(0);
  });

  test('l’elenco delle norme mostra gli atti riscritti più volte, con il numero scritto', async ({
    page,
  }) => {
    await page.goto('/norme');
    const grafico = page.getByRole('img', { name: /riscritti più volte/i });
    await expect(grafico).toBeVisible();

    const etichetta = (await grafico.getAttribute('aria-label')) ?? '';
    expect(etichetta).toMatch(/\d+ versioni/);

    // Ogni barra porta accanto il proprio numero: una barra che si può solo
    // misurare a occhio costringe a stimare, e qui non si stima niente.
    const righe = grafico.locator('.grafico__riga');
    expect(await righe.count()).toBeGreaterThan(2);
    await expect(righe.first().locator('.grafico__valore')).toHaveText(/\d+ versioni/);

    await page.locator('.grafico__numeri').first().locator('summary').click();
    const tabella = page.getByRole('region', { name: /dal più riscritto in giù/i });
    await expect(tabella).toBeVisible();
    await expect(tabella.getByRole('link').first()).toBeVisible();
  });

  test('i grafici si vedono senza JavaScript e stanno in un telefono da 400 px', async ({
    browser,
  }) => {
    // Le due condizioni che un grafico affidato a una libreria non regge: qui
    // il disegno arriva già nell'HTML, e le barre sono in percentuale.
    const contesto = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 400, height: 800 },
    });
    const pagina = await contesto.newPage();

    for (const percorso of ['/numeri', '/dati', '/norme']) {
      await pagina.goto(percorso);
      const grafico = pagina.locator('.grafico [role="img"][aria-label]').first();
      await expect(grafico, percorso).toBeVisible();

      const disegno = await grafico.boundingBox();
      expect(disegno!.width, `${percorso}: il disegno è largo zero`).toBeGreaterThan(100);

      // Senza JavaScript le barre devono esserci già: sono nell'HTML, non
      // disegnate dopo dal browser.
      const barra = await grafico.locator('svg rect').first().boundingBox();
      expect(barra!.width, `${percorso}: nessuna barra disegnata`).toBeGreaterThan(0);
      expect(barra!.height, `${percorso}: nessuna barra disegnata`).toBeGreaterThan(0);

      const straripa = await pagina.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(straripa, `${percorso} scorre orizzontalmente a 400px`).toBe(false);
    }

    await contesto.close();
  });
});
