'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Terminal, Shield } from 'lucide-react';

const tabs = ['jarvis', 'agent', 'monitor'] as const;
type TabKey = (typeof tabs)[number];

const tabConfig: Record<TabKey, { icon: typeof Sparkles; color: string }> = {
  jarvis: { icon: Sparkles, color: '#ff00ff' },
  agent: { icon: Terminal, color: '#00d4ff' },
  monitor: { icon: Shield, color: '#ff4444' },
};

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
    <div className="rounded-xl bg-black/50 border border-white/[0.06] p-5 font-mono text-xs space-y-3">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className={`flex items-start gap-2.5 ${line.indent ? 'pl-6' : ''}`}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.15, duration: 0.4 }}
        >
          <span className="shrink-0 w-5 text-center">{line.icon}</span>
          <span style={{ color: line.color }} className={line.bold ? 'font-bold' : ''}>
            {line.text}
          </span>
        </motion.div>
      ))}
      {/* Approve/Deny buttons inline */}
      <motion.div
        className="flex gap-2 pl-7 mt-2"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.0 }}
      >
        <span className="px-3 py-1 rounded-md bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 text-[10px]">Approve</span>
        <span className="px-3 py-1 rounded-md bg-[#ff4444]/10 text-[#ff4444] border border-[#ff4444]/20 text-[10px]">Deny</span>
      </motion.div>
    </div>
  );
}

function AgentDemo({ t }: { t: (key: string) => string }) {
  const lines = [
    { prefix: 'You:', text: t('agent.demo1'), color: '#fff', icon: null },
    { prefix: '\uD83D\uDD0D', text: t('agent.demo2'), color: '#00d4ff', icon: null },
    { prefix: '\uD83D\uDD0D', text: t('agent.demo3'), color: '#8a2be2', icon: null },
    { prefix: '\u270F\uFE0F', text: t('agent.demo4'), color: '#ffaa00', icon: null },
    { prefix: '\u2705', text: t('agent.demo5'), color: '#00ff88', icon: null },
  ];

  return (
    <div className="rounded-xl bg-black/50 border border-white/[0.06] p-5 font-mono text-xs space-y-3">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className="flex items-start gap-2.5"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.15, duration: 0.4 }}
        >
          <span className="shrink-0 w-5 text-center">{line.prefix}</span>
          <span style={{ color: line.color }}>{line.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

function MonitorDemo({ t }: { t: (key: string) => string }) {
  const findings = [
    { severity: 'CRITICAL', color: '#ff4444', bg: '#ff4444', text: t('monitor.demo1') },
    { severity: 'HIGH', color: '#ff8800', bg: '#ff8800', text: t('monitor.demo2') },
    { severity: 'MEDIUM', color: '#ffaa00', bg: '#ffaa00', text: t('monitor.demo3') },
    { severity: 'INFO', color: '#00d4ff', bg: '#00d4ff', text: t('monitor.demo4') },
  ];

  const dots: Record<string, string> = { CRITICAL: '\uD83D\uDD34', HIGH: '\uD83D\uDFE0', MEDIUM: '\uD83D\uDFE1', INFO: '\uD83D\uDFE2' };

  return (
    <div className="rounded-xl bg-black/50 border border-white/[0.06] p-5 font-mono text-xs space-y-3">
      {findings.map((f, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.15, duration: 0.4 }}
        >
          <span className="shrink-0">{dots[f.severity]}</span>
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ color: f.color, backgroundColor: `${f.bg}15` }}
          >
            {f.severity}
          </span>
          <span className="text-gray-400">{f.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

const demos: Record<TabKey, React.ComponentType<{ t: (key: string) => string }>> = {
  jarvis: JarvisDemo,
  agent: AgentDemo,
  monitor: MonitorDemo,
};

// ─── Main Component ───────────────────────────────────────────

export function ModesShowcase() {
  const t = useTranslations('modes');
  const [active, setActive] = useState<TabKey>('jarvis');

  const Demo = demos[active];

  return (
    <section id="modes" className="py-24 sm:py-32 px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[140px]"
          style={{ backgroundColor: `${tabConfig[active].color}08` }}
        />
      </div>

      <div className="mx-auto max-w-6xl relative">
        {/* Header */}
        <div className="text-center mb-12">
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

        {/* Tab Buttons */}
        <motion.div
          className="flex justify-center gap-2 sm:gap-3 mb-12"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {tabs.map((tab) => {
            const config = tabConfig[tab];
            const Icon = config.icon;
            const isActive = active === tab;

            return (
              <button
                key={tab}
                onClick={() => setActive(tab)}
                className="relative flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-300"
                style={{
                  color: isActive ? config.color : '#888',
                  backgroundColor: isActive ? `${config.color}12` : 'transparent',
                  borderWidth: 1,
                  borderColor: isActive ? `${config.color}40` : 'rgba(255,255,255,0.06)',
                }}
              >
                <Icon size={14} />
                <span>{t(`${tab}.tab`)}</span>
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 20px ${config.color}15` }}
                    layoutId="modeGlow"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="grid md:grid-cols-2 gap-8 md:gap-12 items-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            {/* Text side */}
            <div>
              <h3
                className="font-display text-xl sm:text-2xl font-bold mb-4 tracking-tight"
                style={{ color: tabConfig[active].color }}
              >
                {t(`${active}.title`)}
              </h3>
              <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                {t(`${active}.desc`)}
              </p>
            </div>

            {/* Demo side */}
            <Demo t={t} />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
