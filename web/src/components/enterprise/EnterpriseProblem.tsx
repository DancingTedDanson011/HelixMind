'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, RefreshCw, XCircle } from 'lucide-react';

const problems = [
  { icon: RefreshCw, key: 'reexplain', color: 'text-error' },
  { icon: Clock, key: 'time', color: 'text-warning' },
  { icon: AlertTriangle, key: 'quality', color: 'text-spiral-l6' },
  { icon: XCircle, key: 'frustration', color: 'text-gray-400' },
];

export function EnterpriseProblem() {
  const t = useTranslations('enterprise.problem');

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      {/* Subtle glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-error/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-error/60 mb-3"
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

        {/* Visual comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Without memory */}
          <motion.div
            className="rounded-2xl border border-error/20 bg-error/[0.02] p-6 sm:p-8"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center">
                <XCircle className="text-error" size={20} />
              </div>
              <h3 className="font-display font-semibold text-lg text-error">{t('without.title')}</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              {t('without.desc')}
            </p>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-error/50" />
                  {t(`without.item${i}`)}
                </div>
              ))}
            </div>
          </motion.div>

          {/* With HelixMind */}
          <motion.div
            className="rounded-2xl border border-success/20 bg-success/[0.02] p-6 sm:p-8"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <RefreshCw className="text-success" size={20} />
              </div>
              <h3 className="font-display font-semibold text-lg text-success">{t('with.title')}</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              {t('with.desc')}
            </p>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-success/50" />
                  {t(`with.item${i}`)}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Problem points */}
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {problems.map((problem, i) => (
            <div
              key={problem.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 hover:bg-white/[0.03] transition-colors"
            >
              <problem.icon size={20} className={problem.color} />
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                {t(`items.${problem.key}`)}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
