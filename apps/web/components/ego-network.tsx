import Link from 'next/link';
import type { SnapshotAct, SnapshotRelation } from '@antinomia/corpus';
import { data, nomeNorma, percorsoNorma } from '@/lib/testo';
import { Tabella } from '@/components/tabella';

/**
 * Ego-network a profondità 1, con layout deterministico e tempo sull'asse x.
 *
 * Nessun grafo force-directed (ADR 0003): le reti di citazioni normative sono
 * scale-free e collassano attorno agli hub; un layout a forze non è
 * deterministico e rompe la citabilità degli URL; le relazioni sono tipizzate e
 * datate, mentre un layout a forze mostra prossimità non orientata; e un canvas
 * è invisibile agli screen reader.
 *
 * Qui: le norme sono disposte per data lungo l'asse orizzontale, il layout è
 * calcolato server-side ed è identico a ogni caricamento, e sotto il disegno c'è
 * **la stessa informazione in forma di tabella**, che è il contenuto vero. Il
 * disegno lo illustra.
 */

const TIPI: Readonly<Record<string, { verbo: string; colore: string }>> = {
  MODIFICA: { verbo: 'modifica', colore: 'var(--verderame)' },
  ABROGA: { verbo: 'abroga', colore: 'var(--ossido)' },
  SOSTITUISCE: { verbo: 'sostituisce', colore: 'var(--verderame)' },
  INTRODUCE: { verbo: 'introduce in', colore: 'var(--verderame)' },
  PROROGA: { verbo: 'proroga', colore: 'var(--ocra)' },
  RINVIA: { verbo: 'rinvia a', colore: 'var(--inchiostro-debole)' },
  ATTUA: { verbo: 'attua', colore: 'var(--verderame)' },
  DEROGA: { verbo: 'deroga a', colore: 'var(--ocra)' },
  DICHIARA_ILLEGITTIMO: { verbo: 'dichiara illegittimo', colore: 'var(--ossido)' },
  CONVERTE: { verbo: 'converte', colore: 'var(--verderame)' },
};

const LARGHEZZA = 880;
const RIGA = 34;
const MARGINE = { top: 28, right: 24, bottom: 34, left: 24 };

export function EgoNetwork({
  centro,
  nodi,
  archi,
}: {
  centro: string;
  nodi: SnapshotAct[];
  archi: SnapshotRelation[];
}) {
  const visibili = archi.filter((a) => a.confidence === 'alta').slice(0, 40);
  if (visibili.length === 0) return null;

  const perUrn = new Map(nodi.map((n) => [n.urn, n]));
  const anno = (urn: string): number => {
    const n = perUrn.get(urn);
    const d = n?.publicationDate ?? '';
    return Number(d.slice(0, 4)) || 0;
  };

  const anni = [...new Set(nodi.map((n) => anno(n.urn)).filter(Boolean))].sort((a, b) => a - b);
  const minAnno = anni[0] ?? 1900;
  const maxAnno = anni.at(-1) ?? minAnno + 1;
  const spanAnni = Math.max(1, maxAnno - minAnno);
  const x = (urn: string): number => {
    const a = anno(urn);
    if (!a) return MARGINE.left;
    const util = LARGHEZZA - MARGINE.left - MARGINE.right;
    return MARGINE.left + ((a - minAnno) / spanAnni) * util;
  };

  const altezza = MARGINE.top + visibili.length * RIGA + MARGINE.bottom;
  const etichettaGrafo = `Diagramma a strati delle ${visibili.length} relazioni fra ${nomeNorma(centro)} e le norme collegate, disposte per anno dal ${minAnno} al ${maxAnno}. La stessa informazione è nella tabella qui sotto.`;

  return (
    <>
      {/* Anche il diagramma scorre su schermo stretto, e come la tabella deve
          essere raggiungibile da tastiera: chi non usa il mouse deve poter
          arrivare alla parte destra del disegno. */}
      <div className="grafo" tabIndex={0} role="region" aria-label={etichettaGrafo}>
        <svg
          viewBox={`0 0 ${LARGHEZZA} ${altezza}`}
          width={LARGHEZZA}
          height={altezza}
          role="img"
          aria-label={etichettaGrafo}
        >
          {/* Asse del tempo */}
          <line
            x1={MARGINE.left}
            y1={altezza - MARGINE.bottom + 10}
            x2={LARGHEZZA - MARGINE.right}
            y2={altezza - MARGINE.bottom + 10}
            stroke="var(--bordo-forte)"
            strokeWidth="1"
          />
          {[minAnno, maxAnno].map((a, i) => (
            <text
              key={a}
              x={i === 0 ? MARGINE.left : LARGHEZZA - MARGINE.right}
              y={altezza - MARGINE.bottom + 26}
              textAnchor={i === 0 ? 'start' : 'end'}
              fontSize="11"
              fill="var(--inchiostro-debole)"
              fontFamily="var(--grottesco)"
            >
              {a}
            </text>
          ))}

          {visibili.map((arco, i) => {
            const y = MARGINE.top + i * RIGA;
            const x1 = x(arco.sourceUrn);
            const x2 = x(arco.targetUrn);
            const tipo = TIPI[arco.type] ?? {
              verbo: arco.type,
              colore: 'var(--inchiostro-debole)',
            };
            return (
              <g key={arco.id}>
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke={tipo.colore}
                  strokeWidth="2"
                  markerEnd="url(#punta)"
                />
                <circle cx={x1} cy={y} r="4" fill={tipo.colore} />
                <text
                  x={(x1 + x2) / 2}
                  y={y - 7}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="var(--inchiostro-tenue)"
                  fontFamily="var(--grottesco)"
                >
                  {tipo.verbo}
                </text>
              </g>
            );
          })}

          <defs>
            <marker
              id="punta"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--inchiostro-tenue)" />
            </marker>
          </defs>
        </svg>
      </div>

      <Tabella
        didascalia="Le relazioni del diagramma, con il loro tipo e la data di efficacia. Il layout è precalcolato e identico a ogni caricamento: l’indirizzo di questa pagina resta citabile."
        stile={{ marginTop: '1rem' }}
      >
        <thead>
          <tr>
            <th scope="col">Norma che dispone</th>
            <th scope="col">Relazione</th>
            <th scope="col">Norma colpita</th>
            <th scope="col">Dal</th>
          </tr>
        </thead>
        <tbody>
          {visibili.map((arco) => (
            <tr key={`riga-${arco.id}`}>
              <td>
                <Link href={percorsoNorma(arco.sourceUrn)}>{nomeNorma(arco.sourceUrn)}</Link>
              </td>
              <td>{TIPI[arco.type]?.verbo ?? arco.type}</td>
              <td>
                <Link href={percorsoNorma(arco.targetUrn)}>{nomeNorma(arco.targetUrn)}</Link>
                {arco.targetArticle ? `, art. ${arco.targetArticle}` : ''}
              </td>
              <td>{arco.effectiveFrom ? data(arco.effectiveFrom) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Tabella>
    </>
  );
}
