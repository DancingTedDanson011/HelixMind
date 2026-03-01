'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Brain, Eye, Shield, Globe, Wifi, Layers, Radar } from 'lucide-react';

const featureIcons = {
  memory: Brain,
  brain: Eye,
  validation: Shield,
  web: Globe,
  offline: Wifi,
  sessions: Layers,
  monitor: Radar,
};

const featureColors = [
  '#00d4ff', '#00ff88', '#4169e1', '#ffaa00', '#8a2be2', '#ff6b6b', '#ff4444',
];

const featureKeys = ['memory', 'brain', 'validation', 'web', 'offline', 'sessions', 'monitor'] as const;

export function FeatureGrid() {
  const t = useTranslations('features');

  return (
    <section className="py-24 sm:py-32 px-4 relative">
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureKeys.map((key, i) => {
            const Icon = featureIcons[key];
            const color = featureColors[i];

            return (
              <motion.div
                key={key}
                className={i === featureKeys.length - 1 ? 'sm:col-span-2 lg:col-start-2 lg:col-span-1' : undefined}
                initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="group relative h-full rounded-xl p-6 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
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
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
