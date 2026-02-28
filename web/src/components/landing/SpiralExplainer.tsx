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
    <section className="py-24 px-4 overflow-hidden">
      <div className="mx-auto max-w-5xl">
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

        <div className="space-y-4">
          {levelKeys.map((key, i) => {
            const color = levelColors[i];
            const width = 100 - i * 15; // L1 widest, L5 narrowest (inverted funnel)

            return (
              <motion.div
                key={key}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="rounded-xl py-4 px-6 flex-shrink-0 transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    width: `${width}%`,
                    background: `rgba(${hexToRgb(color)}, 0.06)`,
                    borderLeft: `3px solid ${color}`,
                    borderTop: `1px solid rgba(${hexToRgb(color)}, 0.1)`,
                    borderBottom: `1px solid rgba(${hexToRgb(color)}, 0.1)`,
                    borderRight: `1px solid rgba(${hexToRgb(color)}, 0.1)`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                    />
                    <span className="font-semibold text-sm" style={{ color }}>
                      L{i + 1} — {t(`levels.${key}.name`)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-5">{t(`levels.${key}.desc`)}</p>
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
