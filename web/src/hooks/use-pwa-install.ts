'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallReturn {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<void>;
}

export function usePwaInstall(): PwaInstallReturn {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already installed as PWA
    const mq = window.matchMedia('(display-mode: standalone)');
    setIsInstalled(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener('change', onChange);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect if app was installed
    const onInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt.current = null;
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
    }
    deferredPrompt.current = null;
  }, []);

  return { canInstall, isInstalled, install };
}
