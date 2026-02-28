import type { PrecacheEntry } from 'serwist';
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // JS/CSS bundles
    {
      matcher: /\/_next\/static\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: 'static-resources',
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Fonts
    {
      matcher: /\/fonts\/.*/i,
      handler: new CacheFirst({
        cacheName: 'font-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 })],
      }),
    },
    // Images
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
      handler: new StaleWhileRevalidate({
        cacheName: 'image-cache',
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // API routes
    {
      matcher: /\/api\/.*/i,
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 })],
      }),
    },
    // 3D assets
    {
      matcher: /\.(?:glb|gltf)$/i,
      handler: new CacheFirst({
        cacheName: '3d-assets',
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
