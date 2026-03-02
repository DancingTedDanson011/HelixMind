'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Github, Scale, Repeat, Users, Server } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const highlights = [
  { key: 'license', icon: Scale, color: '#00ff88' },
  { key: 'noLockIn', icon: Repeat, color: '#00d4ff' },
  { key: 'community', icon: Users, color: '#ffaa00' },
  { key: 'selfHost', icon: Server, color: '#8a2be2' },
] as const;

export function OpenSourceBanner() {
  const t = useTranslations('openSource');

  return (
    <section className="py-24 sm:py-32 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-success/[0.04] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.06] px-4 py-1.5 text-xs font-medium text-success backdrop-blur-sm mb-6"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Github size={12} />
            <span className="tracking-wide">{t('label')}</span>
          </motion.div>

          <motion.h2
            className="heading-lg text-3xl sm:text-4xl text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            {t('title')}
          </motion.h2>

          <motion.p
            className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto font-light leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        {/* 4 highlight cards */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {highlights.map(({ key, icon: Icon, color }, i) => (
            <motion.div
              key={key}
              className="relative rounded-xl p-4 sm:p-5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.06 }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-4 right-4 h-[2px] rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
              />
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${color}12` }}
              >
                <Icon size={16} style={{ color }} />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">
                {t(`${key}` as 'license')}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t(`${key}Desc` as 'licenseDesc')}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA row */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href="https://github.com/DancingTedDanson011/HelixMind"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="primary" size="lg" className="font-display font-semibold tracking-wide">
              <Github size={16} />
              {t('starOnGithub')}
            </Button>
          </a>
          <a
            href="https://github.com/DancingTedDanson011/HelixMind"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="lg" className="font-display font-semibold tracking-wide">
              {t('viewSource')}
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
