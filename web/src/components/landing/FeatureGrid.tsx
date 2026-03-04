'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Brain, Shield, Globe, Wifi } from 'lucide-react';
import { useState } from 'react';
import { FeatureModal } from './FeatureModal';

const featureIcons = {
  memory: Brain,
  validation: Shield,
  web: Globe,
  offline: Wifi,
};

const featureColors = [
  '#00d4ff', '#4169e1', '#ffaa00', '#8a2be2',
];

const featureKeys = ['memory', 'validation', 'web', 'offline'] as const;

type FeatureKey = (typeof featureKeys)[number];

export function FeatureGrid() {
  const t = useTranslations('features');
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);

  return (
    <section id="features" className="py-24 sm:py-32 px-4 relative">
      {/* Dual ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] rounded-full bg-accent/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-primary/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Features
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

        <div className="grid sm:grid-cols-2 gap-4">
          {featureKeys.map((key, i) => {
            const Icon = featureIcons[key];
            const color = featureColors[i];

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  onClick={() => setActiveFeature(key)}
                  className="group relative h-full w-full text-left rounded-xl p-6 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.99]"
                >
                  <div
                    className="inline-flex p-3 rounded-xl mb-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${color}10` }}
                  >
                    <Icon size={22} style={{ color }} />
                  </div>
                  <h3 className="font-display text-base font-semibold text-white mb-2 tracking-tight">
                    {t(`${key}.title`)}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {t(`${key}.desc`)}
                  </p>

                  {/* Hover glow at bottom */}
                  <div
                    className="absolute bottom-0 left-1/4 right-1/4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}30, transparent)` }}
                  />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Feature Detail Modal */}
      <FeatureModal feature={activeFeature} onClose={() => setActiveFeature(null)} />
    </section>
  );
}
