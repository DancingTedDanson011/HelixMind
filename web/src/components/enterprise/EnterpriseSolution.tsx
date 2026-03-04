'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { colors } from '@/lib/constants';
import { ArrowUp, Brain, Sparkles, Database, Archive, Globe } from 'lucide-react';

const levelColors = [
  colors.spiralL1,
  colors.spiralL2,
  colors.spiralL3,
  colors.spiralL4,
  colors.spiralL5,
  colors.spiralL6,
];

const levelIcons = [Sparkles, Brain, Database, Archive, Archive, Globe];
const levelKeys = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'] as const;

export function EnterpriseSolution() {
  const t = useTranslations('enterprise.solution');

  return (
    <section id="solution" className="py-24 sm:py-32 px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
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

        {/* 6-Level visualization */}
        <div className="relative">
          {/* Central spine */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-spiral-l1 via-spiral-l3 to-spiral-l5 opacity-20 hidden lg:block" />

          <div className="space-y-4">
            {levelKeys.map((key, i) => {
              const color = levelColors[i];
              const Icon = levelIcons[i];
              const isLeft = i % 2 === 0;

              return (
                <motion.div
                  key={key}
                  className={`flex items-center gap-4 ${isLeft ? 'lg:flex-row' : 'lg:flex-row-reverse'} flex-col lg:flex-row`}
                  initial={{ opacity: 0, x: isLeft ? -40 : 40, filter: 'blur(4px)' }}
                  whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Level card */}
                  <div
                    className={`flex-1 rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.01] ${isLeft ? 'lg:text-right' : 'lg:text-left'}`}
                    style={{
                      background: `linear-gradient(135deg, rgba(${hexToRgb(color)}, 0.06), rgba(${hexToRgb(color)}, 0.02))`,
                      borderColor: `${color}20`,
                    }}
                  >
                    <div className={`flex items-center gap-3 mb-2 ${isLeft ? 'lg:justify-end' : ''}`}>
                      <Icon size={16} style={{ color }} />
                      <span className="font-display font-semibold tracking-wide" style={{ color }}>
                        L{i + 1} — {t(`levels.${key}.name`)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {t(`levels.${key}.desc`)}
                    </p>
                  </div>

                  {/* Center node */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border"
                    style={{
                      background: `linear-gradient(135deg, ${color}20, ${color}05)`,
                      borderColor: `${color}40`,
                      boxShadow: `0 0 20px ${color}30`,
                    }}
                  >
                    <span className="font-display font-bold text-white text-sm">{i + 1}</span>
                  </div>

                  {/* Spacer for opposite side */}
                  <div className="flex-1 hidden lg:block" />
                </motion.div>
              );
            })}
          </div>

          {/* Evolution arrow */}
          <motion.div
            className="flex items-center justify-center gap-2 mt-8 text-sm text-gray-500"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
          >
            <ArrowUp size={14} className="text-spiral-l1" />
            <span>{t('evolution')}</span>
          </motion.div>
        </div>

        {/* Key differentiator */}
        <motion.div
          className="mt-16 rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 sm:p-8 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-lg sm:text-xl text-white font-light">
            <span className="text-accent font-semibold">{t('notRag')}</span>
          </p>
          <p className="text-sm text-gray-400 mt-2 max-w-xl mx-auto">
            {t('notRagDesc')}
          </p>
        </motion.div>
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
