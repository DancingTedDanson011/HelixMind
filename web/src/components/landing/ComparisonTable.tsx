'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

type Support = 'yes' | 'no' | 'partial';

interface Row {
  key: string;
  helixmind: Support;
  claudeCode: Support;
  cursor: Support;
  codexCli: Support;
  aider: Support;
  copilot: Support;
}

const rows: Row[] = [
  { key: 'persistentMemory', helixmind: 'yes', claudeCode: 'partial', cursor: 'no', codexCli: 'no', aider: 'no', copilot: 'no' },
  { key: 'brainViz', helixmind: 'yes', claudeCode: 'no', cursor: 'no', codexCli: 'no', aider: 'no', copilot: 'no' },
  { key: 'validation', helixmind: 'yes', claudeCode: 'no', cursor: 'no', codexCli: 'no', aider: 'no', copilot: 'no' },
  { key: 'webEnricher', helixmind: 'yes', claudeCode: 'no', cursor: 'partial', codexCli: 'partial', aider: 'no', copilot: 'no' },
  { key: 'offlineMode', helixmind: 'yes', claudeCode: 'no', cursor: 'no', codexCli: 'no', aider: 'yes', copilot: 'no' },
  { key: 'multiSession', helixmind: 'yes', claudeCode: 'no', cursor: 'no', codexCli: 'no', aider: 'no', copilot: 'no' },
  { key: 'openSource', helixmind: 'yes', claudeCode: 'no', cursor: 'no', codexCli: 'yes', aider: 'yes', copilot: 'no' },
  { key: 'mcpServer', helixmind: 'yes', claudeCode: 'yes', cursor: 'yes', codexCli: 'no', aider: 'no', copilot: 'no' },
];

const SupportIcon = ({ support, size = 15 }: { support: Support; size?: number }) => {
  switch (support) {
    case 'yes':
      return <Check size={size} className="text-success" />;
    case 'no':
      return <X size={size} className="text-gray-700" />;
    case 'partial':
      return <Minus size={size} className="text-warning" />;
  }
};

const competitors = ['helixmind', 'claudeCode', 'cursor', 'codexCli', 'aider', 'copilot'] as const;

export function ComparisonTable() {
  const t = useTranslations('comparison');

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      {/* Subtle glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-secondary/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-secondary/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Comparison
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

        {/* Desktop table — hidden on mobile */}
        <motion.div
          className="hidden md:block rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
          initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-4 px-5 text-gray-500 font-medium text-xs tracking-wider uppercase">
                    {t('headers.feature')}
                  </th>
                  {competitors.map((c) => (
                    <th
                      key={c}
                      className={`text-center py-4 px-3 text-xs tracking-wider uppercase font-medium ${
                        c === 'helixmind'
                          ? 'text-primary bg-primary/[0.04]'
                          : 'text-gray-500'
                      }`}
                    >
                      {t(`headers.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.key}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-200"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                  >
                    <td className="py-3.5 px-5 text-gray-300 text-sm">{t(`rows.${row.key}`)}</td>
                    {competitors.map((c) => (
                      <td
                        key={c}
                        className={`text-center py-3.5 px-3 ${
                          c === 'helixmind' ? 'bg-primary/[0.02]' : ''
                        }`}
                      >
                        <span className="inline-flex justify-center">
                          <SupportIcon support={row[c]} />
                        </span>
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Mobile card layout — visible only on mobile */}
        <div className="md:hidden space-y-3">
          {rows.map((row, i) => (
            <motion.div
              key={row.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.5 }}
            >
              {/* Feature name */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">
                  {t(`rows.${row.key}`)}
                </span>
                {/* HelixMind status prominent */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">HelixMind</span>
                  <SupportIcon support={row.helixmind} size={14} />
                </div>
              </div>

              {/* Competitor grid */}
              <div className="grid grid-cols-5 gap-1">
                {(['claudeCode', 'cursor', 'codexCli', 'aider', 'copilot'] as const).map((c) => (
                  <div
                    key={c}
                    className="flex flex-col items-center gap-1 py-1.5 rounded-lg bg-white/[0.02]"
                  >
                    <SupportIcon support={row[c]} size={12} />
                    <span className="text-[9px] text-gray-600 leading-tight text-center">
                      {t(`headers.${c}`)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
