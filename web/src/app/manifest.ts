import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HelixMind — AI Coding CLI with Spiral Memory',
    short_name: 'HelixMind',
    description:
      'The only AI coding tool that remembers everything. Persistent spiral memory, 3D brain visualization, and intelligent context.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050510',
    theme_color: '#050510',
    categories: ['developer tools', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-192x192-maskable.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
