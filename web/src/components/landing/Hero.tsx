'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Terminal, Copy, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

const INSTALL_KEY = 'helixmind-installed';

// Orchestrated stagger animation
const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
  },
  item: {
    initial: { opacity: 0, y: 28, filter: 'blur(4px)' },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  },
};

export function Hero() {
  const t = useTranslations('hero');
  const [copied, setCopied] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(localStorage.getItem(INSTALL_KEY) === 'true');
  }, []);

  const installCommand = isInstalled ? t('updateCommand') : t('installCommand');

  const copyInstall = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    if (!isInstalled) {
      localStorage.setItem(INSTALL_KEY, 'true');
      setIsInstalled(true);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      {/* Gradient background (no 3D — brain opens in popup) */}
      <div className="absolute inset-0 z-[0] pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.06)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_80%_-30%,rgba(138,43,226,0.04),transparent)]" />
      </div>

      {/* Multi-layer gradient overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,212,255,0.08),transparent)]" />
      </div>

      {/* Dot grid pattern */}
      <div className="absolute inset-0 z-[2] dot-grid opacity-40 pointer-events-none" />

      {/* Content */}
      <motion.div
        className="relative z-10 mx-auto max-w-5xl px-4 text-center pt-28 pb-8"
        variants={stagger.container}
        initial="initial"
        animate="animate"
      >
        {/* Badge */}
        <motion.div variants={stagger.item} className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm">
            <Terminal size={12} />
            <span className="tracking-wide">{t('badge')}</span>
          </div>
        </motion.div>

        {/* Main heading — oversized, tight tracking */}
        <motion.h1
          variants={stagger.item}
          className="heading-xl text-[clamp(3rem,8vw,7rem)] mb-8"
        >
          <span className="text-white">{t('title')}</span>
          <br />
          <span className="gradient-text-vivid">{t('titleHighlight')}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={stagger.item}
          className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light"
        >
          {t('subtitle')}
        </motion.p>

        {/* Actions */}
        <motion.div
          variants={stagger.item}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {/* Install command — animated border */}
          <button
            onClick={copyInstall}
            className="group relative flex items-center gap-2 sm:gap-3 rounded-xl px-4 sm:px-6 py-3 sm:py-3.5 font-mono text-xs sm:text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white/[0.04] border border-white/[0.08] hover:border-primary/30 hover:bg-primary/[0.04]"
          >
            <span className="text-primary font-bold">$</span>
            <span className="text-gray-200">{installCommand}</span>
            {copied ? (
              <Check size={15} className="text-success" />
            ) : (
              <Copy size={15} className="text-gray-500 group-hover:text-primary transition-colors" />
            )}
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_ease-in-out]">
                <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
              </div>
            </div>
          </button>

          <span className="text-gray-600 text-sm hidden sm:block">\u2022</span>

          <Button
            size="lg"
            className="font-display font-semibold tracking-wide"
            onClick={copyInstall}
          >
            {copied ? (
              <span className="flex items-center gap-2"><Check size={16} /> {t('copied')}</span>
            ) : isInstalled ? (
              <span className="flex items-center gap-2"><RefreshCw size={16} /> {t('ctaUpdate')}</span>
            ) : (
              t('cta')
            )}
          </Button>
        </motion.div>

        {/* Requirement note */}
        <motion.p
          variants={stagger.item}
          className="mt-4 text-xs text-gray-500"
        >
          {t('requirement')}
        </motion.p>

        {/* Social proof hint */}
        <motion.div
          variants={stagger.item}
          className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-500"
        >
          <span>{t('openSource')}</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>{t('license')}</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>{t('anyLlm')}</span>
        </motion.div>
      </motion.div>

      {/* Scroll indicator — refined */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={20} className="text-gray-600" />
        </motion.div>
      </motion.div>
    </section>
  );
}
