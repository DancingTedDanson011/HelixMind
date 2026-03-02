'use client';

import { Suspense, lazy, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';

const InteractiveBrainCanvas = lazy(() =>
  import('./InteractiveBrainCanvas').then((m) => ({ default: m.InteractiveBrainCanvas }))
);

function BrainFallback() {
  return (
    <div className="w-full h-full bg-[#050510] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export function BrainShowcase() {
  const t = useTranslations('brainShowcase');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="py-24 sm:py-32 px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-primary/[0.03] blur-[150px]" />
      </div>

      <div className="mx-auto max-w-6xl relative">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-primary/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {t('sectionLabel')}
          </motion.p>
          <motion.h2
            className="heading-lg text-3xl sm:text-4xl text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            {t('title')}
          </motion.h2>
        </div>

        {/* Browser Chrome Frame */}
        <motion.div
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
          initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              {/* Traffic lights */}
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              {/* URL bar */}
              <div className="hidden sm:flex items-center px-3 py-1 rounded-md bg-black/30 text-xs text-gray-500 font-mono">
                brain.helixmind.dev
              </div>
            </div>

            {/* Expand/Collapse button */}
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all duration-200"
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isExpanded ? t('collapse') : t('expand')}</span>
            </button>
          </div>

          {/* Canvas container with smooth height transition */}
          <div
            className={`w-full transition-[height] duration-500 ease-in-out ${
              isExpanded ? 'h-[75vh]' : 'h-[400px] sm:h-[500px]'
            }`}
          >
            <Suspense fallback={<BrainFallback />}>
              <InteractiveBrainCanvas />
            </Suspense>
          </div>
        </motion.div>

        {/* Subtitle below frame */}
        <motion.p
          className="text-gray-400 text-sm sm:text-base text-center max-w-2xl mx-auto mt-6 font-light leading-relaxed"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {t('subtitle')}
        </motion.p>
      </div>
    </section>
  );
}
