'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { useCookieConsent } from './CookieConsentProvider';

export function CookieBanner() {
  const t = useTranslations('cookieConsent');
  const { showBanner, showSettings, acceptAll, rejectAll, openSettings } = useCookieConsent();

  return (
    <AnimatePresence>
      {showBanner && !showSettings && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 inset-x-0 z-[9998] p-4 md:p-6"
        >
          <div className="mx-auto max-w-4xl glass-strong rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{t('title')}</h3>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                  {t('description')}
                </p>
              </div>
            </div>

            {/* Privacy Policy link */}
            <p className="text-xs text-gray-500 mb-5">
              {t('learnMore')}{' '}
              <Link
                href="/legal/privacy"
                className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              >
                {t('privacyPolicyLink')}
              </Link>
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
              <Button variant="ghost" size="sm" onClick={rejectAll}>
                {t('rejectAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={openSettings}>
                {t('customize')}
              </Button>
              <Button variant="primary" size="sm" onClick={acceptAll}>
                {t('acceptAll')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
