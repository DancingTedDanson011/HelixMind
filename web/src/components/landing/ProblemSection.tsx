'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Brain, Clock, RefreshCw } from 'lucide-react';

const problems = [
  { icon: RefreshCw, key: 'forget', color: '#ff4444', bg: 'rgba(255,68,68,0.06)' },
  { icon: Clock, key: 'context', color: '#ffaa00', bg: 'rgba(255,170,0,0.06)' },
  { icon: Brain, key: 'patterns', color: '#8a2be2', bg: 'rgba(138,43,226,0.06)' },
];

export function ProblemSection() {
  const t = useTranslations('problem');

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      {/* Subtle red ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-error/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl text-center relative">
        <motion.p
          className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-error/60 mb-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          The problem
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
          className="text-gray-400 text-base sm:text-lg mb-16 max-w-2xl mx-auto font-light"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {t('subtitle')}
        </motion.p>

        <div className="grid md:grid-cols-3 gap-5">
          {problems.map((problem, i) => (
            <motion.div
              key={problem.key}
              initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="group relative rounded-xl p-6 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
                <div
                  className="inline-flex p-3 rounded-xl mb-5"
                  style={{ background: problem.bg }}
                >
                  <problem.icon size={22} style={{ color: problem.color }} />
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {t(`points.${problem.key}`)}
                </p>

                {/* Subtle top-line accent */}
                <div
                  className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(90deg, transparent, ${problem.color}40, transparent)` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
