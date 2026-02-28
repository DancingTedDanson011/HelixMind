import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSerwist } from '@serwist/turbopack';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default withSerwist(withNextIntl(nextConfig));
