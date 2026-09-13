import { NextResponse } from 'next/server';
import { REPO_URL } from '@/lib/dataset';

/**
 * Riceve una segnalazione dal modulo del sito e apre una issue.
 *
 * Il punto è che **chi segnala non deve avere un account GitHub**. Chiedere a
 * un funzionario che ha notato un dato sbagliato di registrarsi su una
 * piattaforma per dircelo significa non riceverlo, quel dato.
 *
 * Il token sta solo qui, sul server, e ha un permesso solo: aprire issue. Se
 * non è configurato l'endpoint non finge di aver funzionato: risponde che
 * l'apertura automatica non è disponibile, e il modulo passa al ripiego, cioè
 * la issue precompilata su GitHub. Un fork senza token continua a funzionare.
 */

export const runtime = 'nodejs';
// Niente generazione statica: questa rotta esiste per ricevere, non per essere
// costruita una volta e servita uguale.
export const dynamic = 'force-dynamic';

const TIPI = new Set(['dato', 'pagina', 'chiarezza', 'accessibilita', 'altro']);

const ETICHETTA_TIPO: Record<string, string> = {
  dato: 'Un dato sembra sbagliato',
  pagina: 'Una pagina non funziona',
  chiarezza: 'Non si capisce',
  accessibilita: 'Problema di accessibilità',
  altro: 'Altro',
};

/**
 * Limite per indirizzo, tenuto in memoria.
 *
 * Vale per singola istanza e si azzera a ogni riavvio: non è una difesa contro
 * un attacco deciso, è un freno contro il caso frequente — qualcuno che
 * ricarica e rimanda dieci volte. Il freno vero è che la issue nasce con
 * l'etichetta `da-triage` e non notifica nessuno.
 */
const FINESTRA_MS = 10 * 60 * 1000;
const MAX_PER_FINESTRA = 3;
const recenti = new Map<string, number[]>();

function troppeDa(ip: string): boolean {
  const ora = Date.now();
  const precedenti = (recenti.get(ip) ?? []).filter((t) => ora - t < FINESTRA_MS);
  recenti.set(ip, [...precedenti, ora]);
  return precedenti.length >= MAX_PER_FINESTRA;
}

interface Corpo {
  tipo?: string;
  pagina?: string;
  messaggio?: string;
  contatto?: string;
  /** Campo esca: i moduli compilati da un programma lo riempiono, le persone no. */
  sitoWeb?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = process.env['LCNT_GITHUB_TOKEN'];
  const repo = (process.env['LCNT_REPO'] ?? REPO_URL).replace(/^https?:\/\/github\.com\//, '');

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return NextResponse.json({ errore: 'Richiesta non leggibile.' }, { status: 400 });
  }

  if (corpo.sitoWeb) {
    // L'esca è stata riempita. Si risponde bene e non si fa niente: dire «sei un
    // bot» a un bot serve solo a fargli cambiare strategia.
    return NextResponse.json({ esito: 'ricevuta' });
  }

  const messaggio = (corpo.messaggio ?? '').trim();
  const tipo = TIPI.has(corpo.tipo ?? '') ? corpo.tipo! : 'altro';
  const pagina = (corpo.pagina ?? '').trim().slice(0, 300);
  const contatto = (corpo.contatto ?? '').trim().slice(0, 200);

  if (messaggio.length < 30) {
    return NextResponse.json(
      { errore: 'Servono almeno trenta caratteri: cosa hai visto, e dove.' },
      { status: 400 },
    );
  }
  if (messaggio.length > 5000) {
    return NextResponse.json({ errore: 'Messaggio troppo lungo.' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'ignoto';
  if (troppeDa(ip)) {
    return NextResponse.json(
      { errore: 'Hai già mandato qualche segnalazione: riprova fra poco.' },
      { status: 429 },
    );
  }

  if (!token) {
    // Nessun token: si dice com'è. Il modulo, ricevuto questo, apre la issue
    // precompilata su GitHub invece di far finta di niente.
    return NextResponse.json({ errore: 'apertura-automatica-non-configurata' }, { status: 503 });
  }

  const titolo = `${ETICHETTA_TIPO[tipo]}${pagina ? ` — ${pagina}` : ''}`.slice(0, 120);
  const testo = [
    messaggio,
    '',
    '---',
    '',
    `**Tipo:** ${ETICHETTA_TIPO[tipo]}`,
    pagina ? `**Pagina:** ${pagina}` : '**Pagina:** non indicata',
    contatto ? `**Contatto lasciato:** ${contatto}` : '**Contatto:** non lasciato',
    '',
    'Segnalazione arrivata dal modulo del sito. Chi l’ha mandata non ha un account GitHub: se serve una risposta, e c’è un contatto, va usato quello.',
  ].join('\n');

  const risposta = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ title: titolo, body: testo, labels: ['da-triage', 'dal-sito'] }),
  });

  if (!risposta.ok) {
    return NextResponse.json({ errore: `GitHub ha risposto ${risposta.status}.` }, { status: 502 });
  }

  const creata = (await risposta.json()) as { html_url?: string; number?: number };
  return NextResponse.json({
    esito: 'aperta',
    ...(creata.html_url ? { url: creata.html_url } : {}),
    ...(creata.number ? { numero: creata.number } : {}),
  });
}
