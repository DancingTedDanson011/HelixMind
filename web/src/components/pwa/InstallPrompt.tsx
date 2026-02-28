'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'helixmind-pwa-dismiss';
const VISIT_KEY = 'helixmind-pwa-visits';
const DISMISS_HOURS = 24;
const SHOW_DELAY_MS = 30_000;
const MIN_VISITS = 2;

export function InstallPrompt() {
  const t = useTranslations('pwa');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    setDeferredPrompt(null);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  useEffect(() => {
    // Already installed as PWA?
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Dismissed recently?
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_HOURS * 60 * 60 * 1000) return;
    }

    // Track visits
    const visits = parseInt(localStorage.getItem(VISIT_KEY) || '0', 10) + 1;
    localStorage.setItem(VISIT_KEY, visits.toString());

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    setIsIOS(isiOS);

    // iOS: show after delay + min visits
    if (isiOS && visits >= MIN_VISITS) {
      const timer = setTimeout(() => setShowBanner(true), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // Chromium: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (visits >= MIN_VISITS) {
        const timer = setTimeout(() => setShowBanner(true), SHOW_DELAY_MS);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 inset-x-0 z-[9996] p-4 md:p-6"
        >
          <div className="mx-auto max-w-lg glass-strong rounded-2xl p-5 md:p-6 border border-white/10 shadow-2xl shadow-black/50">
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">
                  {t('installTitle')}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {isIOS ? t('iosInstructions') : t('installDescription')}
                </p>
              </div>
            </div>

            {!isIOS && (
              <div className="flex items-center gap-3 mt-4 justify-end">
                <button
                  onClick={dismiss}
                  className="text-xs text-gray-500 hover:text-white transition-colors px-3 py-1.5"
                >
                  {t('notNow')}
                </button>
                <button
                  onClick={install}
                  className="text-xs font-medium px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                >
                  {t('install')}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
