/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Il sito si genera dal dataset JSONL: i pacchetti del monorepo vengono
  // transpilati insieme all'app invece di essere pubblicati e reinstallati.
  transpilePackages: [
    '@leggichenontornano/corpus',
    '@leggichenontornano/engine',
    '@leggichenontornano/api',
    '@leggichenontornano/akn-parser',
    '@leggichenontornano/redazione',
  ],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  /* La home era l'indice completo, e i suoi filtri erano `/?tipo=<controllo>`.
     Un URL pubblicato non si rompe (ADR 0008): quei link riaprono la stessa
     vista, che adesso vive a `/segnalazioni`. */
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'query', key: 'tipo', value: '(?<tipo>.*)' }],
        destination: '/segnalazioni?tipo=:tipo',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'referrer-policy', value: 'strict-origin-when-cross-origin' },
          // Il sito non ha bisogno di nessuna di queste capacità.
          {
            key: 'permissions-policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
