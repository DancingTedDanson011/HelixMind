'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Brain, Eye, Shield, Globe, Wifi, Layers } from 'lucide-react';

const featureIcons = {
  memory: Brain,
  brain: Eye,
  validation: Shield,
  web: Globe,
  offline: Wifi,
  sessions: Layers,
};

const featureColors = [
  '#00d4ff', '#00ff88', '#4169e1', '#ffaa00', '#8a2be2', '#ff6b6b',
];

const featureKeys = ['memory', 'brain', 'validation', 'web', 'offline', 'sessions'] as const;

export function FeatureGrid() {
  const t = useTranslations('features');

  return (
    <section className="py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold mb-4 text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('title')}
          </motion.h2>
          <motion.p
            className="text-gray-300 text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureKeys.map((key, i) => {
            const Icon = featureIcons[key];
            const color = featureColors[i];

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassPanel className="h-full group hover:border-white/15 transition-all duration-300">
                  <div
                    className="inline-flex p-3 rounded-xl mb-4"
                    style={{ background: `${color}10` }}
                  >
                    <Icon size={24} style={{ color }} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {t(`${key}.title`)}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {t(`${key}.desc`)}
                  </p>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
