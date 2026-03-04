'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Users, Zap, DollarSign, Target } from 'lucide-react';

const benefits = [
  { key: 'tokens', icon: TrendingDown, color: '#00ff88' },
  { key: 'quality', icon: Target, color: '#00d4ff' },
  { key: 'retention', icon: Users, color: '#ff00ff' },
  { key: 'competitive', icon: Zap, color: '#ffaa00' },
  { key: 'cost', icon: DollarSign, color: '#4169e1' },
];

export function EnterpriseROI() {
  const t = useTranslations('enterprise.roi');

  return (
    <section className="py-24 sm:py-32 px-4 relative bg-surface/30">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-success/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-success/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {t('label')}
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

          <motion.p
            className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto font-light"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 hover:bg-white/[0.03] transition-colors"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <benefit.icon size={20} style={{ color: benefit.color }} />
              <h4 className="font-display font-semibold text-white mt-3 mb-2">
                {t(`benefits.${benefit.key}.title`)}
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t(`benefits.${benefit.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="font-display font-semibold text-lg text-white mb-6 text-center">
            {t('comparison.title')}
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-error/20 bg-error/[0.02] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{t('comparison.flat')}</span>
                <span className="text-lg font-display font-bold text-error">120K tokens</span>
              </div>
              <div className="w-full h-2 bg-error/20 rounded-full overflow-hidden">
                <div className="h-full bg-error/60 rounded-full" style={{ width: '100%' }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('comparison.flatDesc')}</p>
            </div>

            <div className="rounded-xl border border-success/20 bg-success/[0.02] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">{t('comparison.spiral')}</span>
                <span className="text-lg font-display font-bold text-success">15-30K tokens</span>
              </div>
              <div className="w-full h-2 bg-success/20 rounded-full overflow-hidden">
                <div className="h-full bg-success/60 rounded-full" style={{ width: '25%' }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('comparison.spiralDesc')}</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              <span className="text-accent font-semibold">{t('comparison.lost')}</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
