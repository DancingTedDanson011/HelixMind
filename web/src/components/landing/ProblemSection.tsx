'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Brain, Clock, RefreshCw } from 'lucide-react';

export function ProblemSection() {
  const t = useTranslations('problem');

  const problems = [
    { icon: RefreshCw, text: t('points.forget'), color: 'text-error' },
    { icon: Clock, text: t('points.context'), color: 'text-warning' },
    { icon: Brain, text: t('points.patterns'), color: 'text-accent' },
  ];

  return (
    <section className="py-24 px-4">
      <div className="mx-auto max-w-5xl text-center">
        <motion.h2
          className="text-3xl sm:text-4xl font-bold mb-4 text-white"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {t('title')}
        </motion.h2>
        <motion.p
          className="text-gray-300 text-lg mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          {t('subtitle')}
        </motion.p>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassPanel className="text-center h-full">
                <div className={`inline-flex p-3 rounded-xl bg-error/5 mb-4 ${problem.color}`}>
                  <problem.icon size={24} />
                </div>
                <p className="text-gray-300">{problem.text}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
