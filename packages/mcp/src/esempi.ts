/**
 * Esempi d'uso, esposti come **prompt** MCP.
 *
 * Non sono documentazione: nei client compaiono come voci scegliibili, quindi
 * sono il modo in cui qualcuno che non ha letto niente scopre cosa può chiedere.
 *
 * Ognuno è scritto per insegnare, insieme alla domanda, il modo giusto di
 * porla: citare l'URN e la data, leggere il testo originale prima della
 * sintesi, non trasformare una segnalazione in un verdetto. Un esempio che
 * mostrasse la scorciatoia insegnerebbe la scorciatoia.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

interface Esempio {
  nome: string;
  descrizione: string;
  argomenti: Record<string, z.ZodString>;
  testo: (a: Record<string, string>) => string;
}

const CHIUSA = [
  '',
  'Nel rispondere:',
  '- cita sempre l’URN e la data di vigenza: la stessa norma dice cose diverse a date diverse;',
  '- riporta il testo originale prima della tua sintesi;',
  '- se un dato manca dal corpus, dillo invece di colmarlo: il corpus è parziale per costruzione.',
].join('\n');

const ESEMPI: Esempio[] = [
  {
    nome: 'cosa-dice-questa-norma',
    descrizione: 'Leggi un articolo a una certa data, con le cautele del caso.',
    argomenti: {
      norma: z.string().describe('L’atto, anche a parole: «codice dei contratti pubblici 2016».'),
      articolo: z.string().describe('Il numero dell’articolo.'),
    },
    testo: (a) =>
      [
        `Voglio sapere cosa dice l’articolo ${a['articolo']} di «${a['norma']}».`,
        '',
        'Usa `cerca_norme` per trovare l’URN esatto, poi `leggi_norma` per il testo.',
        'Se l’atto ha più versioni, dimmi quale stai leggendo e da quando è in vigore;',
        'se l’articolo è cambiato nel tempo, usa `storia_articolo` e dimmelo.',
        CHIUSA,
      ].join('\n'),
  },
  {
    nome: 'cosa-non-torna-in-questa-norma',
    descrizione: 'Le segnalazioni che riguardano un atto, con la regola che le ha prodotte.',
    argomenti: { norma: z.string().describe('L’atto di cui vuoi sapere le segnalazioni.') },
    testo: (a) =>
      [
        `Quali segnalazioni riguardano «${a['norma']}»?`,
        '',
        'Trova l’URN con `cerca_norme`, poi usa `elenca_segnalazioni` e `leggi_segnalazione`.',
        '',
        'Per ciascuna, dimmi: cosa dicono i **testi originali**, quale **regola** l’ha prodotta,',
        'e se uno dei **criteri di risoluzione** potrebbe spiegarla — specialità, posteriorità,',
        'gerarchia. Una segnalazione non è un verdetto: è un indizio prodotto da una query, e i',
        'criteri servono proprio a dire quando non regge.',
        '',
        'Controlla anche con `pronunce_su_norma` se la Corte costituzionale l’ha toccata.',
        CHIUSA,
      ].join('\n'),
  },
  {
    nome: 'verifica-prima-di-citare',
    descrizione: 'Prima di scrivere un numero in un articolo o in un atto, controlla cosa regge.',
    argomenti: { affermazione: z.string().describe('L’affermazione che vuoi verificare.') },
    testo: (a) =>
      [
        `Sto per scrivere questa affermazione: «${a['affermazione']}».`,
        '',
        'Prima chiama `stato_del_progetto`: dice cosa il dataset copre, con quale precisione',
        'misurata, e cosa il progetto dichiara di **non** fare.',
        '',
        'Poi verifica l’affermazione con gli strumenti, e dimmi esplicitamente:',
        '1. cosa i dati **sostengono**, con URN e date;',
        '2. cosa i dati **non** possono sostenere, e perché;',
        '3. se il numero che sto per citare ha un limite dichiarato che va scritto accanto.',
        '',
        'Se l’affermazione non regge, dimmelo chiaramente. È il motivo per cui te lo sto chiedendo.',
        CHIUSA,
      ].join('\n'),
  },
  {
    nome: 'come-e-cambiato-nel-tempo',
    descrizione: 'La storia di un articolo, versione per versione.',
    argomenti: {
      norma: z.string().describe('L’atto.'),
      articolo: z.string().describe('Il numero dell’articolo.'),
    },
    testo: (a) =>
      [
        `Come è cambiato l’articolo ${a['articolo']} di «${a['norma']}» nel tempo?`,
        '',
        'Usa `storia_articolo`. Per ogni versione dimmi da quando era in vigore e **cosa è',
        'cambiato rispetto alla precedente**, non solo cosa diceva.',
        '',
        'Se una versione porta una discordanza di date dichiarata dalla fonte, segnalamela:',
        'è un dato sulla qualità della fonte, non un dettaglio da ignorare.',
        CHIUSA,
      ].join('\n'),
  },
  {
    nome: 'questa-segnalazione-regge',
    descrizione: 'Esamina una segnalazione con l’obiettivo di demolirla, non di confermarla.',
    argomenti: { id: z.string().describe('L’identificatore della segnalazione.') },
    testo: (a) =>
      [
        `Esamina la segnalazione \`${a['id']}\` con l’obiettivo di **demolirla**.`,
        '',
        'L’incarico è «trova tutto quello che non regge», non «controlla se va bene»: il primo',
        'produce informazione, il secondo approvazioni.',
        '',
        'Leggila con `leggi_segnalazione`, poi apri i testi originali degli atti coinvolti con',
        '`leggi_norma` alla data della finestra indicata. Chiediti in particolare:',
        '',
        '- il rinvio è **recettizio** o **formale**? Cambia tutto.',
        '- esiste una **norma speciale** o una disciplina transitoria che risolve il contrasto?',
        '- la lettura del testo è giusta, o l’errore sta nella nostra estrazione?',
        '',
        'Se non regge, dimmi quale delle due cose non torna: i fatti, o la qualificazione.',
        'Sono due lavori diversi — correggere il parser, o raffinare una regola.',
        CHIUSA,
      ].join('\n'),
  },
];

export function registraEsempi(server: McpServer): void {
  for (const esempio of ESEMPI) {
    server.registerPrompt(
      esempio.nome,
      { description: esempio.descrizione, argsSchema: esempio.argomenti },
      (args: Record<string, unknown>) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: esempio.testo(args as Record<string, string>),
            },
          },
        ],
      }),
    );
  }
}

export const NOMI_ESEMPI = ESEMPI.map((e) => e.nome);
