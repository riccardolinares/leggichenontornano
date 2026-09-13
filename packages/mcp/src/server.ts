#!/usr/bin/env node
/**
 * Il server MCP, su trasporto stdio.
 *
 * stdio e non HTTP perché è l'unico trasporto che tutti i client supportano
 * allo stesso modo e che non chiede a nessuno di aprire una porta, gestire un
 * processo o incollare un token. Il criterio di questo file è che la
 * configurazione stia in tre righe di JSON e non richieda altro.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registraEsempi } from './esempi.js';
import { apriSorgente, datasetVuoto } from './sorgente.js';
import {
  cercaNorme,
  elencaSegnalazioni,
  leggiNorma,
  leggiSegnalazione,
  pronunceSuNorma,
  statoDelProgetto,
  storiaArticolo,
} from './strumenti.js';

/** Gli strumenti, elencati anche qui perché il README non diverga dal codice. */
export const STRUMENTI = [
  'cerca_norme',
  'leggi_norma',
  'storia_articolo',
  'elenca_segnalazioni',
  'leggi_segnalazione',
  'pronunce_su_norma',
  'stato_del_progetto',
] as const;

export async function creaServer(): Promise<McpServer> {
  const { reader, provenienza } = await apriSorgente();

  const server = new McpServer(
    { name: 'antinomia', version: '0.1.0' },
    {
      instructions: [
        'Questo server dà accesso al corpus normativo e alle segnalazioni di «Le leggi che non',
        'tornano». Tre regole per usarlo bene:',
        '',
        '1. **Cita sempre l’URN e la data di vigenza.** La stessa norma dice cose diverse a date',
        '   diverse: «l’art. 3 della legge X» senza una data è un riferimento ambiguo.',
        '2. **Riporta il testo originale prima della sintesi.** Se una segnalazione è sbagliata,',
        '   l’errore si vede nel testo, non nel riassunto.',
        '3. **Non presentare una segnalazione come un verdetto.** Sono indizi prodotti da una',
        '   query, con una precisione misurata che `stato_del_progetto` dichiara. Assenza di',
        '   segnale non significa norma coerente.',
        '',
        'Il corpus è parziale per costruzione e i dati non hanno carattere di ufficialità:',
        'l’unico testo ufficiale è quello in Gazzetta Ufficiale.',
      ].join('\n'),
    },
  );

  if (datasetVuoto(reader)) {
    // Partire in silenzio su un dataset vuoto è il guasto peggiore: l'assistente
    // riceverebbe «nessun risultato» e lo riferirebbe come un fatto sulla legge.
    process.stderr.write(
      `[antinomia] ATTENZIONE: dataset vuoto (${provenienza}).\n` +
        '[antinomia] Ogni risposta dirà «nessun risultato», e non sarebbe un fatto sulla legge.\n' +
        '[antinomia] Controlla la rete, oppure indica un dataset locale con ANTINOMIA_SNAPSHOT.\n',
    );
  } else {
    process.stderr.write(`[antinomia] ${reader.data.acts.length} atti — ${provenienza}\n`);
  }

  server.registerTool(
    'cerca_norme',
    {
      description:
        'Cerca nel testo degli articoli del corpus. Da qui si parte quando non si conosce l’URN.',
      inputSchema: {
        query: z.string().describe('Parole da cercare nel testo degli articoli.'),
        limite: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Quanti risultati. Predefinito 10.'),
      },
    },
    (args) => cercaNorme(reader, args),
  );

  server.registerTool(
    'leggi_norma',
    {
      description:
        'Il testo di un atto a una data. Senza data si legge la versione in vigore oggi.',
      inputSchema: {
        urn: z
          .string()
          .describe('URN:NIR dell’atto, es. urn:nir:stato:decreto.legislativo:2016-04-18;50'),
        data: z.string().optional().describe('Data di vigenza in formato AAAA-MM-GG.'),
        articolo: z
          .string()
          .optional()
          .describe('Numero di un singolo articolo, es. 3 oppure 3-bis.'),
      },
    },
    (args) => leggiNorma(reader, args),
  );

  server.registerTool(
    'storia_articolo',
    {
      description:
        'Come un articolo è cambiato nel tempo: tutte le versioni con le rispettive date.',
      inputSchema: {
        urn: z.string().describe('URN:NIR dell’atto.'),
        articolo: z.string().describe('Numero dell’articolo.'),
      },
    },
    (args) => storiaArticolo(reader, args),
  );

  server.registerTool(
    'elenca_segnalazioni',
    {
      description: 'Le segnalazioni del progetto, filtrabili per controllo o per norma coinvolta.',
      inputSchema: {
        controllo: z
          .string()
          .optional()
          .describe('Identificatore del controllo, es. rinvio-ad-atto-abrogato'),
        urn: z.string().optional().describe('Solo le segnalazioni che coinvolgono questo atto.'),
        includiNonPubblicate: z
          .boolean()
          .optional()
          .describe(
            'Include anche la coda interna: controlli senza precisione misurata. Predefinito false.',
          ),
        limite: z.number().int().min(1).max(100).optional(),
      },
    },
    (args) => elencaSegnalazioni(reader, args),
  );

  server.registerTool(
    'leggi_segnalazione',
    {
      description:
        'Una segnalazione per intero: testi originali, regola che l’ha prodotta, criteri di risoluzione.',
      inputSchema: { id: z.string().describe('Identificatore della segnalazione.') },
    },
    (args) => leggiSegnalazione(reader, args),
  );

  server.registerTool(
    'pronunce_su_norma',
    {
      description:
        'Le dichiarazioni di illegittimità costituzionale che colpiscono un atto, con le parole della Corte.',
      inputSchema: { urn: z.string().describe('URN:NIR dell’atto.') },
    },
    (args) => pronunceSuNorma(reader, args),
  );

  server.registerTool(
    'stato_del_progetto',
    {
      description:
        'Cosa il dataset copre, con quale precisione misurata, e cosa il progetto dichiara di non ' +
        'fare. Utile prima di citare qualunque numero.',
      inputSchema: {},
    },
    () => statoDelProgetto(reader, provenienza),
  );

  // Gli esempi: nei client compaiono come voci scegliibili, ed è il modo in cui
  // chi non ha letto niente scopre cosa può chiedere.
  registraEsempi(server);

  return server;
}

async function main(): Promise<void> {
  const server = await creaServer();
  await server.connect(new StdioServerTransport());
}

// Solo quando eseguito come programma, non quando importato dai test.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*?(?=\/[^/]+$)/, ''))) {
  main().catch((errore: unknown) => {
    process.stderr.write(`[antinomia] avvio fallito: ${(errore as Error).message}\n`);
    process.exit(1);
  });
}
