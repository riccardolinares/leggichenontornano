import { data } from '@/lib/testo';

export interface Finestra {
  etichetta: string;
  da: string | null;
  a: string | null;
}

/**
 * La barra delle finestre di vigenza, con l'intersezione evidenziata.
 *
 * Il layout è calcolato qui, server-side, e reso come SVG statico: nessun
 * JavaScript, nessuna libreria, e il contenuto resta leggibile da uno screen
 * reader perché sotto la barra c'è la stessa informazione in forma di elenco.
 * Una barra temporale che esiste solo come grafica è invisibile a metà dei
 * potenziali utenti di un progetto civico.
 */
export function BarraVigenze({
  finestre,
  intersezione,
}: {
  finestre: Finestra[];
  intersezione?: { da: string; a: string | null } | null;
}) {
  const valide = finestre.filter((f) => f.da);
  if (valide.length === 0) return null;

  const oggi = new Date().toISOString().slice(0, 10);
  const date = valide.flatMap((f) => [f.da!, f.a ?? oggi]);
  const min = date.reduce((a, b) => (a < b ? a : b));
  const maxGrezzo = date.reduce((a, b) => (a > b ? a : b));
  // Un margine a destra evita che una finestra aperta finisca incollata al bordo.
  const max = maxGrezzo === min ? aggiungiAnni(min, 1) : maxGrezzo;
  const span = giorni(min, max) || 1;
  const pos = (iso: string) => Math.max(0, Math.min(100, (giorni(min, iso) / span) * 100));

  return (
    <div className="vigenze">
      {valide.map((f) => {
        const da = pos(f.da!);
        const a = pos(f.a ?? max);
        return (
          <div className="vigenze__riga" key={`${f.etichetta}-${f.da}`}>
            <span>{f.etichetta}</span>
            <span className="vigenze__traccia" aria-hidden="true">
              <span
                className="vigenze__barra"
                style={{ left: `${da}%`, width: `${Math.max(a - da, 0.8)}%` }}
              />
            </span>
          </div>
        );
      })}

      {intersezione ? (
        <div className="vigenze__riga">
          <span style={{ color: 'var(--ossido)', fontWeight: 600 }}>Intersezione</span>
          <span className="vigenze__traccia" aria-hidden="true">
            <span
              className="vigenze__intersezione"
              style={{
                left: `${pos(intersezione.da)}%`,
                width: `${Math.max(pos(intersezione.a ?? max) - pos(intersezione.da), 0.8)}%`,
              }}
            />
          </span>
        </div>
      ) : null}

      {/* L'equivalente testuale non è un ripiego: è il contenuto. La barra lo illustra. */}
      <dl style={{ fontSize: '0.88rem', margin: '1rem 0 0' }}>
        {valide.map((f) => (
          <div key={`testo-${f.etichetta}-${f.da}`} style={{ display: 'flex', gap: '0.6rem' }}>
            <dt style={{ fontWeight: 600, minWidth: '7rem' }}>{f.etichetta}</dt>
            <dd style={{ margin: 0 }}>
              {f.a ? `dal ${data(f.da)} al ${data(f.a)}` : `dal ${data(f.da)}, tuttora in vigore`}
            </dd>
          </div>
        ))}
        {intersezione ? (
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
            <dt style={{ fontWeight: 600, minWidth: '7rem', color: 'var(--ossido)' }}>
              Intersezione
            </dt>
            <dd style={{ margin: 0 }}>
              {intersezione.a
                ? `dal ${data(intersezione.da)} al ${data(intersezione.a)}`
                : `dal ${data(intersezione.da)}, tuttora`}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function giorni(da: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000);
}

function aggiungiAnni(iso: string, anni: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + anni);
  return d.toISOString().slice(0, 10);
}
