'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCookieConsent } from './CookieConsentProvider';

/* ─── Toggle Switch ──────────────────────────── */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        checked ? 'bg-primary/60' : 'bg-white/10',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

/* ─── Category Row ───────────────────────────── */

function CategoryRow({
  name,
  description,
  checked,
  onChange,
  disabled,
  badge,
}: {
  name: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-white/5 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{name}</span>
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        {disabled ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Lock className="w-3 h-3" />
            <Toggle checked={checked} onChange={onChange} disabled />
          </div>
        ) : (
          <Toggle checked={checked} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

/* ─── Settings Modal ─────────────────────────── */

export function CookieSettings() {
  const t = useTranslations('cookieConsent');
  const { showSettings, consent, savePreferences, rejectAll, closeSettings } = useCookieConsent();

  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  const [marketing, setMarketing] = useState(consent?.marketing ?? false);

  // Sync local state when modal opens with existing consent
  const handleSave = () => {
    savePreferences({ analytics, marketing });
  };

  const handleRejectAll = () => {
    setAnalytics(false);
    setMarketing(false);
    rejectAll();
  };

  return (
    <AnimatePresence>
      {showSettings && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9997] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          >
            <div className="glass-strong rounded-2xl border border-white/10 shadow-2xl shadow-black/50 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{t('settingsTitle')}</h2>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('settingsDescription')}</p>

                {/* Categories */}
                <div className="mb-6">
                  <CategoryRow
                    name={t('essential')}
                    description={t('essentialDesc')}
                    checked={true}
                    onChange={() => {}}
                    disabled
                    badge={t('alwaysOn')}
                  />
                  <CategoryRow
                    name={t('analytics')}
                    description={t('analyticsDesc')}
                    checked={analytics}
                    onChange={setAnalytics}
                    badge={t('optional')}
                  />
                  <CategoryRow
                    name={t('marketing')}
                    description={t('marketingDesc')}
                    checked={marketing}
                    onChange={setMarketing}
                    badge={t('optional')}
                  />
                </div>

                {/* Privacy link */}
                <p className="text-xs text-gray-500 mb-6">
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
                  <Button variant="ghost" size="sm" onClick={handleRejectAll}>
                    {t('rejectAll')}
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave}>
                    {t('savePreferences')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
