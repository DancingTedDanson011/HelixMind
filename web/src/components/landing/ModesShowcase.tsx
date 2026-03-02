'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Sparkles, Terminal, Shield, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';

const modes = [
  { key: 'jarvis', icon: Sparkles, color: '#ff00ff', borderColor: '#ff00ff', docsHref: '/docs/jarvis' },
  { key: 'agent', icon: Terminal, color: '#00d4ff', borderColor: '#00d4ff', docsHref: '/docs/agent-tools' },
  { key: 'monitor', icon: Shield, color: '#ff4444', borderColor: '#ff4444', docsHref: '/docs/monitor' },
] as const;

// ─── Demo Components ──────────────────────────────────────────

function JarvisDemo({ t }: { t: (key: string) => string }) {
  const lines = [
    { icon: '\uD83E\uDDE0', text: t('jarvis.demo1'), color: '#ff00ff' },
    { icon: '\uD83E\uDDE0', text: t('jarvis.demo2'), color: '#ff00ff' },
    { icon: '\uD83D\uDCA1', text: t('jarvis.demo3'), color: '#ffaa00', bold: true },
    { icon: ' ', text: t('jarvis.demo4'), color: '#888', indent: true },
    { icon: '\u2705', text: t('jarvis.demo5'), color: '#00ff88' },
  ];

  return (
    <div className="rounded-xl bg-black/50 border border-white/[0.06] p-4 font-mono text-[11px] space-y-2.5">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className={`flex items-start gap-2 ${line.indent ? 'pl-5' : ''}`}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
        >
          <span className="shrink-0 w-4 text-center">{line.icon}</span>
          <span style={{ color: line.color }} className={line.bold ? 'font-bold' : ''}>
            {line.text}
          </span>
        </motion.div>
      ))}
      <motion.div
        className="flex gap-2 pl-6 mt-1.5"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.0 }}
      >
        <span className="px-2.5 py-0.5 rounded-md bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 text-[10px]">Approve</span>
        <span className="px-2.5 py-0.5 rounded-md bg-[#ff4444]/10 text-[#ff4444] border border-[#ff4444]/20 text-[10px]">Deny</span>
      </motion.div>
    </div>
  );
}

function AgentDemo({ t }: { t: (key: string) => string }) {
  const lines = [
    { prefix: 'You:', text: t('agent.demo1'), color: '#fff' },
    { prefix: '\uD83D\uDD0D', text: t('agent.demo2'), color: '#00d4ff' },
    { prefix: '\uD83D\uDD0D', text: t('agent.demo3'), color: '#8a2be2' },
    { prefix: '\u270F\uFE0F', text: t('agent.demo4'), color: '#ffaa00' },
    { prefix: '\u2705', text: t('agent.demo5'), color: '#00ff88' },
  ];

  return (
    <div className="rounded-xl bg-black/50 border border-white/[0.06] p-4 font-mono text-[11px] space-y-2.5">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className="flex items-start gap-2"
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
        >
          <span className="shrink-0 w-4 text-center">{line.prefix}</span>
          <span style={{ color: line.color }}>{line.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

function MonitorDemo({ t }: { t: (key: string) => string }) {
  const findings = [
    { severity: 'CRITICAL', color: '#ff4444', text: t('monitor.demo1') },
    { severity: 'HIGH', color: '#ff8800', text: t('monitor.demo2') },
    { severity: 'MEDIUM', color: '#ffaa00', text: t('monitor.demo3') },
    { severity: 'INFO', color: '#00d4ff', text: t('monitor.demo4') },
  ];

  const dots: Record<string, string> = { CRITICAL: '\uD83D\uDD34', HIGH: '\uD83D\uDFE0', MEDIUM: '\uD83D\uDFE1', INFO: '\uD83D\uDFE2' };

  return (
    <div className="rounded-xl bg-black/50 border border-white/[0.06] p-4 font-mono text-[11px] space-y-2.5">
      {findings.map((f, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
        >
          <span className="shrink-0">{dots[f.severity]}</span>
          <span
            className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: f.color, backgroundColor: `${f.color}15` }}
          >
            {f.severity}
          </span>
          <span className="text-gray-400 truncate">{f.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

const demos: Record<string, React.ComponentType<{ t: (key: string) => string }>> = {
  jarvis: JarvisDemo,
  agent: AgentDemo,
  monitor: MonitorDemo,
};

// ─── Main Component ───────────────────────────────────────────

export function ModesShowcase() {
  const t = useTranslations('modes');

  return (
    <section id="modes" className="py-24 sm:py-32 px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[140px] bg-primary/[0.04]" />
      </div>

      <div className="mx-auto max-w-6xl relative">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-primary/60 mb-3"
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

        {/* 3-Column Grid — all modes visible */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {modes.map((mode, i) => {
            const Icon = mode.icon;
            const Demo = demos[mode.key];

            return (
              <motion.div
                key={mode.key}
                initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="group relative flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/[0.12]"
                style={{ borderTopWidth: 3, borderTopColor: mode.borderColor }}
              >
                {/* Icon + Title */}
                <div className="flex items-center gap-3 mb-3">
                  <Icon size={18} style={{ color: mode.color }} />
                  <h3
                    className="font-display text-lg font-bold tracking-tight"
                    style={{ color: mode.color }}
                  >
                    {t(`${mode.key}.title`)}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm leading-relaxed mb-5">
                  {t(`${mode.key}.desc`)}
                </p>

                {/* Demo */}
                <div className="flex-1 mb-5">
                  <Demo t={t} />
                </div>

                {/* Learn more link */}
                <Link
                  href={mode.docsHref}
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 group/link"
                  style={{ color: mode.color }}
                >
                  {t('learnMore')}
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover/link:translate-x-0.5" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
