/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Il sito si genera dal dataset JSONL: i pacchetti del monorepo vengono
  // transpilati insieme all'app invece di essere pubblicati e reinstallati.
  transpilePackages: ['@antinomia/corpus', '@antinomia/engine', '@antinomia/api', '@antinomia/akn-parser'],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'referrer-policy', value: 'strict-origin-when-cross-origin' },
          // Il sito non ha bisogno di nessuna di queste capacità.
          { key: 'permissions-policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
