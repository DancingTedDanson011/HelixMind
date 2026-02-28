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
  aider: Support;
  copilot: Support;
}

const rows: Row[] = [
  { key: 'persistentMemory', helixmind: 'yes', claudeCode: 'partial', cursor: 'no', aider: 'no', copilot: 'no' },
  { key: 'brainViz', helixmind: 'yes', claudeCode: 'no', cursor: 'no', aider: 'no', copilot: 'no' },
  { key: 'validation', helixmind: 'yes', claudeCode: 'no', cursor: 'no', aider: 'no', copilot: 'no' },
  { key: 'webEnricher', helixmind: 'yes', claudeCode: 'no', cursor: 'partial', aider: 'no', copilot: 'no' },
  { key: 'offlineMode', helixmind: 'yes', claudeCode: 'no', cursor: 'no', aider: 'yes', copilot: 'no' },
  { key: 'multiSession', helixmind: 'yes', claudeCode: 'no', cursor: 'no', aider: 'no', copilot: 'no' },
  { key: 'openSource', helixmind: 'yes', claudeCode: 'no', cursor: 'no', aider: 'yes', copilot: 'no' },
  { key: 'mcpServer', helixmind: 'yes', claudeCode: 'yes', cursor: 'yes', aider: 'no', copilot: 'no' },
];

const SupportIcon = ({ support }: { support: Support }) => {
  switch (support) {
    case 'yes':
      return <Check size={16} className="text-success" />;
    case 'no':
      return <X size={16} className="text-gray-600" />;
    case 'partial':
      return <Minus size={16} className="text-warning" />;
  }
};

export function ComparisonTable() {
  const t = useTranslations('comparison');

  const competitors = ['helixmind', 'claudeCode', 'cursor', 'aider', 'copilot'] as const;

  return (
    <section className="py-24 px-4">
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

        <motion.div
          className="overflow-x-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4 text-gray-400 font-medium">
                  {t('headers.feature')}
                </th>
                {competitors.map((c) => (
                  <th
                    key={c}
                    className={`text-center py-4 px-3 font-medium ${
                      c === 'helixmind' ? 'text-primary' : 'text-gray-400'
                    }`}
                  >
                    {t(`headers.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3.5 px-4 text-gray-300">{t(`rows.${row.key}`)}</td>
                  {competitors.map((c) => (
                    <td key={c} className="text-center py-3.5 px-3">
                      <span className="inline-flex justify-center">
                        <SupportIcon support={row[c]} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
