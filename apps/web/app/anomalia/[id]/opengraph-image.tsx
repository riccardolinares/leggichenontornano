import { ImageResponse } from 'next/og';
import { dataset } from '@/lib/dataset';

/*
 * L'anteprima Open Graph di ogni segnalazione.
 *
 * È la feature con il rapporto impatto/sforzo più alto del progetto: decide se
 * il contenuto circola su WhatsApp e su X, cioè se una segnalazione esce dal
 * sito o resta dentro. Costa cinquanta righe.
 *
 * Contiene il titolo e il numero chiave, nient'altro: un'anteprima piena di
 * dettagli non si legge su un telefono, e il dettaglio sta nella pagina.
 */

export const alt = 'Anteprima della segnalazione';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  return dataset()
    .publishedAnomalies()
    .map((a) => ({ id: a.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const anomalia = dataset().anomaly(decodeURIComponent(id));

  const titolo = anomalia?.title ?? 'Le leggi che non tornano';
  const chiave = anomalia?.urns[0]?.split(':').pop() ?? '';
  const accento = anomalia?.severity === 'alta' ? '#8c2f21' : '#7a5206';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#eaece9',
        color: '#131d19',
        padding: '72px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 14, height: 56, background: accento }} />
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#0f5c50',
            fontWeight: 700,
          }}
        >
          Le leggi che non tornano
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: titolo.length > 110 ? 48 : 60,
          lineHeight: 1.16,
          fontWeight: 600,
          maxWidth: 1000,
        }}
      >
        {titolo.length > 180 ? `${titolo.slice(0, 177)}…` : titolo}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 24,
          color: '#3f4b46',
        }}
      >
        <div style={{ display: 'flex' }}>{chiave}</div>
        <div style={{ display: 'flex', color: '#5c6763' }}>
          elaborazione su dati Normattiva · CC BY 4.0
        </div>
      </div>
    </div>,
    size,
  );
}
