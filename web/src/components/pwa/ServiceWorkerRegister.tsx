'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/serwist/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('SW registration failed:', err);
        });
    }
  }, []);

  return null;
}
