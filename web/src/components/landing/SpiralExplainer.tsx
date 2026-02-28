'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { colors } from '@/lib/constants';

const levelColors = [
  colors.spiralL1,
  colors.spiralL2,
  colors.spiralL3,
  colors.spiralL4,
  colors.spiralL5,
  colors.spiralL6,
];

const levelKeys = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'] as const;

export function SpiralExplainer() {
  const t = useTranslations('spiral');

  return (
    <section className="py-24 sm:py-32 px-4 overflow-hidden relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] max-w-[100vw] h-[400px] rounded-full bg-accent/[0.04] blur-[120px]" />
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
            {t('sectionLabel')}
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

        <div className="space-y-3">
          {levelKeys.map((key, i) => {
            const color = levelColors[i];
            const width = 100 - i * 12;

            return (
              <motion.div
                key={key}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -24, filter: 'blur(3px)' }}
                whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className="group rounded-xl py-4 px-6 flex-shrink-0 transition-all duration-300 hover:scale-[1.01] cursor-default"
                  style={{
                    width: `${width}%`,
                    background: `rgba(${hexToRgb(color)}, 0.04)`,
                    borderLeft: `3px solid ${color}`,
                    borderTop: `1px solid rgba(${hexToRgb(color)}, 0.08)`,
                    borderBottom: `1px solid rgba(${hexToRgb(color)}, 0.08)`,
                    borderRight: `1px solid rgba(${hexToRgb(color)}, 0.08)`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
                    />
                    <span className="font-display font-semibold text-sm tracking-wide" style={{ color }}>
                      L{i + 1} — {t(`levels.${key}.name`)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 ml-5 leading-relaxed">{t(`levels.${key}.desc`)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
