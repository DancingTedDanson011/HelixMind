'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Star, GitFork, Download, Users, TrendingUp, ExternalLink } from 'lucide-react';

const metrics = [
  { key: 'stars', icon: Star, value: 'Growing' },
  { key: 'forks', icon: GitFork, value: 'Active' },
  { key: 'downloads', icon: Download, value: 'Live' },
  { key: 'contributors', icon: Users, value: 'Open' },
];

export function EnterpriseTraction() {
  const t = useTranslations('enterprise.traction');

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-secondary/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-secondary/60 mb-3"
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 text-center hover:bg-white/[0.03] transition-colors"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <metric.icon size={18} className="mx-auto text-secondary mb-2" />
              <div className="text-lg font-display font-semibold text-white">{metric.value}</div>
              <div className="text-xs text-gray-500">{t(`metrics.${metric.key}`)}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <TrendingUp className="text-success" size={20} />
            <span className="text-sm font-semibold text-success">{t('momentum')}</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-sm text-gray-400 mb-1">{t('proof.point1.title')}</div>
              <div className="text-xs text-gray-500">{t('proof.point1.desc')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">{t('proof.point2.title')}</div>
              <div className="text-xs text-gray-500">{t('proof.point2.desc')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">{t('proof.point3.title')}</div>
              <div className="text-xs text-gray-500">{t('proof.point3.desc')}</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mt-8 flex flex-wrap justify-center gap-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <a
            href="https://github.com/DancingTedDanson011/HelixMind-Privat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Star size={14} />
            GitHub Repository
            <ExternalLink size={12} />
          </a>
          <a
            href="https://www.npmjs.com/package/helixmind"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Download size={14} />
            npm Package
            <ExternalLink size={12} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
