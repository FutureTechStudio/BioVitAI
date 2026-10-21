// Only a port can vary for isolated tests; the upstream host remains loopback.
const apiPort = process.env.BIOVITAI_TEST_API_PORT ?? '3001';
if (!/^[1-9][0-9]{0,4}$/.test(apiPort) || Number(apiPort) > 65535)
  throw new Error('Invalid loopback API port');
const upstream = `http://127.0.0.1:${apiPort}`;
const config = {
  poweredByHeader: false,
  reactStrictMode: true,
  webpack(config) {
    // Shared NodeNext sources use emitted .js specifiers; resolve their TS source in the browser build.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: `${upstream}/api/auth/:path*`,
      },
      { source: '/v1/:path*', destination: `${upstream}/v1/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};
export default config;
