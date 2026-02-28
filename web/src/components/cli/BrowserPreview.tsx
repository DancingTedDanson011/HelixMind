'use client';

import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Globe, ExternalLink, Clock } from 'lucide-react';
import type { BrowserScreenshotInfo } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface BrowserPreviewProps {
  screenshot: BrowserScreenshotInfo | null;
}

/* ─── Component ───────────────────────────────── */

export function BrowserPreview({ screenshot }: BrowserPreviewProps) {
  const t = useTranslations('cli');

  if (!screenshot) {
    return (
      <GlassPanel intensity="subtle" className="p-6 text-center">
        <Globe size={20} className="text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t('noBrowserScreenshot')}</p>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── URL + Meta ── */}
      <GlassPanel className="p-3">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs text-gray-300 truncate flex-1 font-mono">
            {screenshot.url}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock size={10} />
            {new Date(screenshot.timestamp).toLocaleTimeString()}
          </div>
        </div>
        {screenshot.title && (
          <p className="text-xs text-gray-500 mt-1 truncate">{screenshot.title}</p>
        )}
      </GlassPanel>

      {/* ── Screenshot Image ── */}
      <AnimatePresence mode="wait">
        {screenshot.imageBase64 && (
          <motion.div
            key={screenshot.timestamp}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <GlassPanel className="overflow-hidden">
              <img
                src={`data:image/png;base64,${screenshot.imageBase64}`}
                alt={screenshot.title || 'Browser screenshot'}
                className="w-full rounded-lg"
                loading="lazy"
              />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Analysis ── */}
      {screenshot.analysis && (
        <GlassPanel intensity="subtle" className="p-3">
          <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
            <ExternalLink size={10} />
            {t('browserAnalysis')}
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {screenshot.analysis}
          </p>
        </GlassPanel>
      )}
    </div>
  );
}
