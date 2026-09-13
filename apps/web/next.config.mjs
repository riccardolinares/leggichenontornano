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
  /**
   * Gli indirizzi pubblicati non si rompono (ADR 0008).
   *
   * Due casi, e tutti e due nati da una pagina che ha cambiato posto.
   *
   * La home era l'indice completo, e i suoi filtri erano `/?tipo=<controllo>`:
   * quei link riaprono la stessa vista, che adesso vive a `/segnalazioni`.
   *
   * La pagina del server MCP è nata come `/assistente`, quando «MCP» sembrava
   * una sigla da iniziati. Adesso è la parola con cui la si cerca. Il 308
   * passa a `/mcp` anche il peso accumulato dal vecchio indirizzo: un 302
   * lascerebbe l'indice fermo dov'era.
   */
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'query', key: 'tipo', value: '(?<tipo>.*)' }],
        destination: '/segnalazioni?tipo=:tipo',
        permanent: true,
      },
      { source: '/assistente', destination: '/mcp', permanent: true },
      /* Il sito è in italiano e le rotte pure, ma `/legal/terms`,
         `/legal/privacy-policy` e `/legal/cookie-policy` sono i nomi che
         chiunque scrive a memoria quando incolla un collegamento di servizio.
         Un 308 costa una riga e fa arrivare lo stesso chi legge. */
      { source: '/legal/terms', destination: '/legal/termini', permanent: true },
      { source: '/legal/privacy-policy', destination: '/legal/privacy', permanent: true },
      { source: '/legal/cookie-policy', destination: '/legal/cookie', permanent: true },
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
