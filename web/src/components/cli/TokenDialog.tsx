'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KeyRound, X } from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface TokenDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (token: string, remember: boolean) => void;
  tokenHint?: string;
}

/* ─── Animation Variants ──────────────────────── */

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

/* ─── Component ───────────────────────────────── */

export function TokenDialog({ open, onClose, onSubmit, tokenHint }: TokenDialogProps) {
  const t = useTranslations('cli');

  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setToken('');
      setRemember(false);
      // Focus the input after animation settles
      const timer = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (token.trim()) {
        onSubmit(token.trim(), remember);
      }
    },
    [token, remember, onSubmit],
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-md mx-4 rounded-xl border border-white/10 bg-surface p-6 shadow-2xl"
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <KeyRound size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{t('tokenDialogTitle')}</h2>
                <p className="text-xs text-gray-500">{t('tokenDialogSubtitle')}</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                ref={inputRef}
                id="cli-token"
                type="password"
                label={t('tokenLabel')}
                placeholder={
                  tokenHint
                    ? `${t('tokenPlaceholderHint')} ...${tokenHint}`
                    : t('tokenPlaceholder')
                }
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />

              {tokenHint && (
                <p className="text-xs text-gray-500">
                  {t('tokenHintLabel')}: <code className="text-primary font-mono">...{tokenHint}</code>
                </p>
              )}

              {/* Remember checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded border border-white/20 bg-surface peer-checked:bg-primary/20 peer-checked:border-primary/40 transition-all" />
                  {remember && (
                    <svg
                      className="absolute inset-0 w-4 h-4 text-primary pointer-events-none"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M4 8l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  {t('rememberToken')}
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button type="submit" size="sm" disabled={!token.trim()}>
                  {t('connectButton')}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
