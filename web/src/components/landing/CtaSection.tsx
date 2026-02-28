'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Github, Terminal } from 'lucide-react';

export function CtaSection() {
  const t = useTranslations('cta');

  return (
    <section className="py-32 sm:py-40 px-4 relative overflow-hidden">
      {/* Multi-layer ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-primary/[0.05] blur-[140px]" />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-accent/[0.04] blur-[100px]" />
      </div>

      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

      <div className="mx-auto max-w-3xl text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm mb-8">
            <Terminal size={12} />
            <span className="tracking-wide">Ready to install</span>
          </div>

          <h2 className="heading-xl text-4xl sm:text-5xl lg:text-6xl mb-6">
            <span className="gradient-text-vivid">{t('title')}</span>
          </h2>

          <p className="text-gray-400 text-base sm:text-lg mb-10 max-w-xl mx-auto font-light leading-relaxed">
            {t('subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="font-display font-semibold tracking-wide">
              {t('button')}
            </Button>
            <Button variant="outline" size="lg" className="font-display font-semibold tracking-wide">
              <Github size={16} />
              {t('github')}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
