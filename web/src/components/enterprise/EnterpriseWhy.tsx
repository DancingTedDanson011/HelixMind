'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, Clock } from 'lucide-react';

const stats = [
  { key: 'developers', icon: Users, value: '47M+' },
  { key: 'memory', icon: Zap, value: '0%' },
  { key: 'context', icon: Clock, value: '200K+' },
  { key: 'opportunity', icon: TrendingUp, value: 'First' },
];

export function EnterpriseWhy() {
  const t = useTranslations('enterprise.why');

  return (
    <section className="py-24 sm:py-32 px-4 relative bg-surface/30">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-accent/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-accent/60 mb-3"
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 text-center"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <stat.icon size={20} className="mx-auto text-accent mb-3" />
              <div className="text-2xl font-display font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{t(`stats.${stat.key}`)}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="font-display font-semibold text-lg text-white mb-4 text-center">
            {t('context.title')}
          </h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">{t('context.point1.title')}</div>
              <div className="text-sm text-gray-500">{t('context.point1.desc')}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">{t('context.point2.title')}</div>
              <div className="text-sm text-gray-500">{t('context.point2.desc')}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">{t('context.point3.title')}</div>
              <div className="text-sm text-gray-500">{t('context.point3.desc')}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
