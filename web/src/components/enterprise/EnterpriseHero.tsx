'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { BrainCanvas } from '@/components/brain/BrainCanvas';
import { ArrowRight, Zap, Shield, Layers } from 'lucide-react';
import { Link } from '@/i18n/routing';

const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  },
  item: {
    initial: { opacity: 0, y: 24, filter: 'blur(4px)' },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  },
};

export function EnterpriseHero() {
  const t = useTranslations('enterprise');

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      {/* 3D Brain background */}
      <div className="absolute inset-0 z-[0] pointer-events-none opacity-70">
        <BrainCanvas />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(138,43,226,0.08),transparent)]" />
      </div>

      {/* Dot grid */}
      <div className="absolute inset-0 z-[2] dot-grid opacity-30 pointer-events-none" />

      {/* Content */}
      <motion.div
        className="relative z-10 mx-auto max-w-5xl px-4 text-center pt-28 pb-12"
        variants={stagger.container}
        initial="initial"
        animate="animate"
      >
        {/* Badge */}
        <motion.div variants={stagger.item} className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.06] px-4 py-1.5 text-xs font-medium text-accent backdrop-blur-sm">
            <Shield size={12} />
            <span className="tracking-wide">{t('hero.badge')}</span>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          variants={stagger.item}
          className="heading-xl text-[clamp(2.5rem,7vw,6rem)] mb-6"
        >
          <span className="text-white">{t('hero.title')}</span>
          <br />
          <span className="gradient-text-vivid">{t('hero.titleHighlight')}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={stagger.item}
          className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed font-light"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* Feature pills */}
        <motion.div variants={stagger.item} className="flex justify-center gap-3 mb-10 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
            <Layers size={14} className="text-spiral-l1" />
            {t('hero.pill1')}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
            <Zap size={14} className="text-spiral-l6" />
            {t('hero.pill2')}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-gray-300">
            <Shield size={14} className="text-accent" />
            {t('hero.pill3')}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          variants={stagger.item}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="#contact">
            <Button size="lg" className="font-display font-semibold tracking-wide group">
              {t('hero.cta')}
              <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="#integration" className="text-sm text-gray-400 hover:text-white transition-colors">
            {t('hero.secondary')}
          </Link>
        </motion.div>

        {/* Social proof hint */}
        <motion.div
          variants={stagger.item}
          className="mt-10 text-xs text-gray-500"
        >
          {t('hero.trust')}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-6 h-10 rounded-full border border-white/10 flex items-start justify-center pt-2"
        >
          <motion.div
            animate={{ opacity: [0.2, 1, 0.2], y: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-2 bg-white/40 rounded-full"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
