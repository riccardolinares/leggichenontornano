import { ImageResponse } from 'next/og';

/** Lo stesso segno della favicon, alla misura che iOS mette in home. */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#14201c',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <rect x="5" y="10" width="13" height="3" rx="1" fill="#f5f6f4" />
          <rect x="21" y="10" width="6" height="3" rx="1" fill="#9e3323" />
          <rect x="5" y="16" width="22" height="3" rx="1" fill="#f5f6f4" opacity="0.55" />
          <rect x="5" y="22" width="9" height="3" rx="1" fill="#f5f6f4" opacity="0.3" />
        </svg>
      </div>
    ),
    size,
  );
}
