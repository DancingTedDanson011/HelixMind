import type { NextConfig } from 'next';
import { resolve } from 'path';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
});

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['three'],
  serverExternalPackages: ['@node-saml/node-saml', 'xml-crypto', 'xml-encryption', '@xmldom/xmldom'],
  outputFileTracingRoot: resolve('.'),
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  webpack: (config) => {
    // Next.js 15.5 regression: minify-webpack-plugin expects _webpack.WebpackError
    // at top-level but it's only at _webpack.webpack.WebpackError.
    // Without this polyfill, any minification error crashes the build with
    // "WebpackError is not a constructor" instead of showing the real error.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const webpackExports = require('next/dist/compiled/webpack/webpack');
      if (!webpackExports.WebpackError && webpackExports.webpack?.WebpackError) {
        webpackExports.WebpackError = webpackExports.webpack.WebpackError;
      }
    } catch { /* ignore if module structure changes in future versions */ }
    return config;
  },
};

export default withSerwist(withNextIntl(nextConfig));
