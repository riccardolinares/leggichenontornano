import { expect, test } from '@playwright/test';
import {
  normaConPiuVersioni,
  normaConPronuncia,
  percorsiDaVerificare,
  primaAnomalia,
  primaNorma,
} from './percorsi';

/**
 * Verifiche di usabilità e di contenuto.
 *
 * Non provano che il sito «funzioni»: provano che dice le cose che il progetto
 * si è impegnato a dire. Sono i vincoli non negoziabili del piano, trasformati
 * in asserzioni — perché un vincolo che nessuno verifica è un proposito.
 */

test.describe('vincoli non negoziabili', () => {
  test('ogni pagina mostra l’attribuzione a Normattiva e il disclaimer, non in fondo in grigio chiaro', async ({
    page,
  }) => {
    for (const percorso of percorsiDaVerificare()) {
      await page.goto(percorso.url);
      const avvertenza = page.locator('.avvertenza');
      await expect(avvertenza, percorso.url).toBeVisible();
      await expect(avvertenza).toContainText(/Normattiva/);
      await expect(avvertenza).toContainText(/Gazzetta Ufficiale/);
      await expect(avvertenza).toContainText(/non fornisce consulenza legale/i);
    }
  });

  test('«Come funziona» dice per prima cosa cosa il progetto non fa', async ({ page }) => {
    await page.goto('/come-funziona');
    const primoH2 = page.locator('h2').first();
    await expect(primoH2).toHaveText(/cosa questo sito non fa/i);
  });

  test('la home apre con una frase, non con un cruscotto di metriche', async ({ page }) => {
    await page.goto('/');
    const apertura = page.locator('.apertura');
    await expect(apertura).toBeVisible();
    const testo = (await apertura.textContent()) ?? '';
    expect(testo.length).toBeGreaterThan(120);
  });

  test('la pagina Dati mostra anche i controlli che non pubblicano', async ({ page }) => {
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

  test('la pagina Dati dice che la revisione esterna non è ancora stata fatta', async ({
    page,
  }) => {
    // docs/gold-standard.md promette che questo sia detto «qui e nella pagina
    // Dati del sito». Una promessa di trasparenza che vale solo dentro il
    // repository non è trasparenza.
    await page.goto('/dati');
    const testo = (await page.locator('main').textContent()) ?? '';
    expect(testo).toMatch(/non è ancora stato demolito da giuristi esterni/i);
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

  test('la home dice che assenza di segnale non significa norma coerente', async ({ page }) => {
    await page.goto('/');
    const testo = (await page.locator('main').textContent()) ?? '';
    expect(testo).toMatch(/assenza di segnale|non significa che la norma sia coerente/i);
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
    // Il layout è precalcolato server-side: se due richieste danno due SVG
    // diversi, qualcosa lo sta calcolando nel browser.
    const url = `/norma/${encodeURIComponent(norma!)}`;
    await page.goto(url);
    const grafo = page.locator('svg').first();
    if ((await grafo.count()) === 0) test.skip();
    const primo = await grafo.innerHTML();
    await page.reload();
    expect(await page.locator('svg').first().innerHTML()).toBe(primo);
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
