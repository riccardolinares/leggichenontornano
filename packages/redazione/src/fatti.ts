/**
 * La scheda dei fatti.
 *
 * È l'unica cosa che il modello vede. Tutto quello che non sta qui dentro non
 * può comparire nell'articolo: la verifica, dopo, lo controlla riga per riga.
 *
 * La scheda non contiene giudizi. Contiene campi del dataset e citazioni
 * letterali, esattamente come la scheda della segnalazione sul sito — che è la
 * stessa cosa, letta due volte.
 */
import { humanLabel, tryParseUrn } from '@leggichenontornano/akn-parser';
import type { SnapshotAnomaly, SnapshotReader } from '@leggichenontornano/corpus';
import { checkById } from '@leggichenontornano/engine';

export interface Prova {
  etichetta: string;
  citazione: string;
}

export interface Fatti {
  anomaliaId: string;
  controllo: string;
  controlloDescrizione: string;
  livello: number;
  gravita: string;
  titolo: string;
  linguaComune: string;
  /** Gli atti coinvolti, con il nome per esteso e lo stato di vigenza. */
  atti: Array<{ urn: string; nome: string; titolo: string; stato: string }>;
  finestraDa: string | null;
  finestraA: string | null;
  /** Da quanti anni la situazione è aperta, alla data di conoscenza del dataset. */
  anniAperta: number | null;
  prove: Prova[];
  criteri: Array<{ criterio: string; stato: string; spiegazione: string }>;
  regola: string;
  /** Data a cui il dataset dichiara di conoscere il mondo. */
  conosciutoAl: string;
}

interface RigaProva {
  label?: string;
  quote?: string;
}

interface RigaCriterio {
  criterion?: string;
  status?: string;
  explanation?: string;
}

function nomeNorma(urn: string): string {
  const parsed = tryParseUrn(urn);
  return parsed ? humanLabel(parsed) : urn;
}

export function costruisciFatti(reader: SnapshotReader, anomalia: SnapshotAnomaly): Fatti {
  const conosciutoAl = (reader.data.manifest?.knownAt ?? anomalia.computedAt).slice(0, 10);
  const controllo = checkById(anomalia.checkId);

  const atti = [...new Set(anomalia.urns.map((u) => u.split('~')[0]!))].map((urn) => {
    const act = reader.act(urn);
    return {
      urn,
      nome: nomeNorma(urn),
      titolo: act?.title ?? '',
      stato: act?.abrogated
        ? `abrogato${act.abrogatedFrom ? ` dal ${act.abrogatedFrom}` : ''}`
        : 'in vigore',
    };
  });

  let anniAperta: number | null = null;
  if (anomalia.windowFrom) {
    const da = Date.parse(`${anomalia.windowFrom}T00:00:00Z`);
    const a = Date.parse(`${anomalia.windowTo ?? conosciutoAl}T00:00:00Z`);
    if (Number.isFinite(da) && Number.isFinite(a) && a > da) {
      anniAperta = Math.floor((a - da) / 86_400_000 / 365.25) || null;
    }
  }

  const prove = ((anomalia.evidence ?? []) as RigaProva[])
    .filter((p) => typeof p.quote === 'string' && p.quote.trim().length > 0)
    .slice(0, 4)
    .map((p) => ({
      etichetta: p.label ?? '',
      // Le citazioni lunghe si tagliano dalla fine, mai nel mezzo: il taglio
      // deve vedersi.
      citazione: p.quote!.length > 600 ? `${p.quote!.slice(0, 597)}…` : p.quote!,
    }));

  const criteri = ((anomalia.resolutions ?? []) as RigaCriterio[]).map((r) => ({
    criterio: r.criterion ?? '',
    stato: r.status ?? '',
    spiegazione: r.explanation ?? '',
  }));

  return {
    anomaliaId: anomalia.id,
    controllo: controllo?.label ?? anomalia.checkId,
    controlloDescrizione: controllo?.description ?? '',
    livello: anomalia.level,
    gravita: anomalia.severity,
    titolo: anomalia.title,
    linguaComune: anomalia.plainLanguage,
    atti,
    finestraDa: anomalia.windowFrom,
    finestraA: anomalia.windowTo,
    anniAperta,
    prove,
    criteri,
    regola: anomalia.rule,
    conosciutoAl,
  };
}

/**
 * La scheda in testo, così come arriva al modello.
 *
 * È anche il testo su cui la verifica cerca i numeri: se una cifra non compare
 * qui, non può comparire nell'articolo.
 */
export function fattiInTesto(f: Fatti): string {
  const righe: string[] = [
    `Identificatore della segnalazione: ${f.anomaliaId}`,
    `Controllo che l'ha prodotta: ${f.controllo} (livello ${f.livello}, gravità ${f.gravita})`,
    `Cosa cerca il controllo: ${f.controlloDescrizione}`,
    '',
    `Titolo della scheda: ${f.titolo}`,
    `Spiegazione in lingua comune già pubblicata sul sito: ${f.linguaComune}`,
    '',
    'Atti coinvolti:',
    ...f.atti.map((a) => `- ${a.nome} — ${a.titolo || 'senza titolo nel dataset'} — ${a.stato}`),
    '',
    `Periodo: dal ${f.finestraDa ?? 'data non nota'}${f.finestraA ? ` al ${f.finestraA}` : ', tuttora aperto'}`,
    f.anniAperta !== null ? `Anni trascorsi: ${f.anniAperta}` : 'Anni trascorsi: non calcolabili',
    `Dataset aggiornato al: ${f.conosciutoAl}`,
  ];

  if (f.prove.length > 0) {
    righe.push('', 'Testi originali (citazioni letterali, le uniche utilizzabili fra virgolette):');
    for (const p of f.prove) righe.push(`- ${p.etichetta}: «${p.citazione}»`);
  }

  if (f.criteri.length > 0) {
    righe.push('', 'Criteri di risoluzione valutati dal motore:');
    for (const c of f.criteri) righe.push(`- ${c.criterio} (${c.stato}): ${c.spiegazione}`);
  }

  return righe.join('\n');
}
