import type { NextConfig } from 'next';
import { resolve } from 'path';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
});

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
