'use client';

import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, Brain } from 'lucide-react';
import { Suspense, lazy, useState, useEffect, useCallback } from 'react';

const BrainScene = lazy(() =>
  import('@/components/brain/BrainScene').then((m) => ({ default: m.BrainScene }))
);

// ─── Expanded Modal ─────────────────────────────────────────

function BrainExpandedModal({ onClose }: { onClose: () => void }) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [handleEscape]);

  const spiralLevels = [
    { label: 'L1 Focus', color: '#00ffff', desc: 'Active working context' },
    { label: 'L2 Active', color: '#00ff88', desc: 'Recently used knowledge' },
    { label: 'L3 Reference', color: '#4169e1', desc: 'Cross-session patterns' },
    { label: 'L4 Archive', color: '#8a2be2', desc: 'Long-term memory' },
    { label: 'L5 Deep', color: '#6c757d', desc: 'Foundational knowledge' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[9990]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-0 z-[1] flex items-center justify-center p-4 sm:p-8">
        <motion.div
          className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl border border-white/[0.08] bg-[#0d0f14]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col lg:flex-row">
            {/* 3D Brain */}
            <div className="flex-1 h-[50vh] lg:h-[70vh]" style={{ background: '#050510' }}>
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                      <Brain size={28} className="text-primary/40" />
                    </motion.div>
                  </div>
                }
              >
                <BrainScene interactive />
              </Suspense>
            </div>

            {/* Info Panel */}
            <div className="lg:w-72 p-6 border-t lg:border-t-0 lg:border-l border-white/[0.06] overflow-y-auto">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500 mb-4">
                Spiral Levels
              </h3>
              <div className="space-y-3">
                {spiralLevels.map((level, i) => (
                  <motion.div
                    key={level.label}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: level.color }} />
                    <div>
                      <div className="text-xs font-mono font-medium" style={{ color: level.color }}>{level.label}</div>
                      <div className="text-[11px] text-gray-500">{level.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.06]">
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500 mb-3">
                  Capabilities
                </h3>
                <ul className="space-y-2 text-xs text-gray-400">
                  {[
                    'Real-time node activity',
                    'Level-colored connections',
                    'Live knowledge flow particles',
                    'Interactive zoom & pan',
                  ].map((cap, i) => (
                    <motion.li
                      key={cap}
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + i * 0.08 }}
                    >
                      <span className="w-1 h-1 rounded-full bg-[#00ff88]" />
                      {cap}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Main Section ────────────────────────────────────────────

export function BrainShowcase() {
  const t = useTranslations('features');
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <section className="py-24 px-4 relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#00ff88]/[0.03] blur-[120px]" />
        </div>

        <div className="mx-auto max-w-5xl relative">
          {/* Header */}
          <div className="text-center mb-10">
            <motion.p
              className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-[#00ff88]/60 mb-3"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {t('brain.title')}
            </motion.p>

            <motion.h2
              className="heading-lg text-3xl sm:text-4xl text-white mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.05 }}
            >
              Your knowledge, visualized
            </motion.h2>

            <motion.p
              className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto font-light"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {t('brain.desc')}
            </motion.p>
          </div>

          {/* 3D Brain Window */}
          <motion.div
            className="relative rounded-xl border border-white/[0.06] overflow-hidden"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Title Bar (browser chrome) */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[11px] text-gray-500 font-mono ml-2 flex-1 text-center">
                helixmind brain — localhost:9420
              </span>
            </div>

            {/* Brain Canvas */}
            <div className="h-[450px] sm:h-[500px] relative" style={{ background: '#050510' }}>
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center" style={{ background: '#050510' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                      <Brain size={28} className="text-primary/40" />
                    </motion.div>
                  </div>
                }
              >
                <BrainScene interactive />
              </Suspense>

              {/* Expand Button */}
              <button
                onClick={() => setExpanded(true)}
                className="absolute bottom-4 right-4 p-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-all duration-200 backdrop-blur-sm cursor-pointer"
                aria-label="Expand brain visualization"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Expanded Modal */}
      <AnimatePresence>
        {expanded && <BrainExpandedModal onClose={() => setExpanded(false)} />}
      </AnimatePresence>
    </>
  );
}
