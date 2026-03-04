'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Plug, Cloud, Handshake, ArrowRight } from 'lucide-react';

const paths = [
  { key: 'native', icon: Plug, color: '#00d4ff' },
  { key: 'mcp', icon: Cloud, color: '#00ff88' },
  { key: 'license', icon: Handshake, color: '#ff00ff' },
];

export function EnterpriseIntegration() {
  const t = useTranslations('enterprise.integration');

  return (
    <section id="integration" className="py-24 sm:py-32 px-4 relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[400px] rounded-full bg-primary/[0.04] blur-[120px]" />
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

        {/* Integration paths */}
        <div className="space-y-6">
          {paths.map((path, i) => (
            <motion.div
              key={path.key}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden hover:bg-white/[0.03] transition-colors"
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.1 }}
            >
              <div className="p-6 sm:p-8 flex flex-col lg:flex-row gap-6">
                {/* Header */}
                <div className="lg:w-1/3 flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${path.color}15` }}
                  >
                    <path.icon size={24} style={{ color: path.color }} />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg text-white">
                      {t(`paths.${path.key}.title`)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {t(`paths.${path.key}.effort`)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="lg:w-1/3">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {t(`paths.${path.key}.desc`)}
                  </p>
                </div>

                {/* Benefits */}
                <div className="lg:w-1/3">
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: path.color }} />
                        {t(`paths.${path.key}.benefit${j}`)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* MCP Already Live */}
        <motion.div
          className="mt-8 rounded-xl border border-success/20 bg-success/[0.03] p-4 flex items-center justify-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-success">{t('mcpLive')}</span>
        </motion.div>
      </div>
    </section>
  );
}
