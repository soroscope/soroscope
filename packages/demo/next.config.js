/** @type {import('next').NextConfig} */
const nextConfig = {
  // The /api/docs/search and /api/ai routes read content/*.md from disk at
  // request time. Without this, those files are not traced into the serverless
  // functions and the routes 500 in production. Bundle them explicitly.
  outputFileTracingIncludes: {
    '/api/docs/search': ['./content/**/*.md'],
    '/api/ai': ['./content/**/*.md'],
  },

  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
