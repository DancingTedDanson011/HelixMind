'use client';

import { useTranslations } from 'next-intl';
import { motion, useInView } from 'framer-motion';
import { Sparkles, Terminal, Shield, ArrowRight, Copy, Check, Download } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useRef, useState } from 'react';

// ─── Mode Definitions ─────────────────────────────────────────

const modes = [
  {
    key: 'agent',
    index: '01',
    icon: Terminal,
    color: '#00d4ff',
    shadowColor: 'rgba(0,212,255,0.15)',
    glowColor: 'rgba(0,212,255,0.06)',
    borderColor: '#00d4ff',
    docsHref: '/docs/agent-tools',
    flip: false,
  },
  {
    key: 'jarvis',
    index: '02',
    icon: Sparkles,
    color: '#ff00ff',
    shadowColor: 'rgba(255,0,255,0.15)',
    glowColor: 'rgba(255,0,255,0.06)',
    borderColor: '#ff00ff',
    docsHref: '/docs/jarvis',
    flip: true,
  },
  {
    key: 'monitor',
    index: '03',
    icon: Shield,
    color: '#ff4444',
    shadowColor: 'rgba(255,68,68,0.15)',
    glowColor: 'rgba(255,68,68,0.06)',
    borderColor: '#ff4444',
    docsHref: '/docs/security-monitor',
    flip: false,
  },
] as const;

// ─── Demo Components ───────────────────────────────────────────

function JarvisDemo({ t }: { t: (key: string) => string }) {
  const lines = [
    { icon: '\uD83E\uDDE0', text: t('jarvis.demo1'), color: '#ff00ff' },
    { icon: '\uD83E\uDDE0', text: t('jarvis.demo2'), color: '#ff00ff' },
    { icon: '\uD83D\uDCA1', text: t('jarvis.demo3'), color: '#ffaa00', bold: true },
    { icon: ' ', text: t('jarvis.demo4'), color: '#888', indent: true },
    { icon: '\u2705', text: t('jarvis.demo5'), color: '#00ff88' },
  ];

  return (
    <div className="rounded-2xl bg-black/60 border border-white/[0.07] p-5 font-mono text-[12px] space-y-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-4 pb-3 border-b border-white/[0.06]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/30 tracking-wide">jarvis — spiral memory</span>
      </div>
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className={`flex items-start gap-2.5 ${line.indent ? 'pl-6' : ''}`}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.13, duration: 0.45 }}
        >
          <span className="shrink-0 w-4 text-center leading-relaxed">{line.icon}</span>
          <span style={{ color: line.color }} className={`leading-relaxed ${line.bold ? 'font-bold' : ''}`}>
            {line.text}
          </span>
        </motion.div>
      ))}
      <motion.div
        className="flex gap-2 pl-6 pt-1"
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.1, duration: 0.4 }}
      >
        <span className="px-3 py-1 rounded-lg bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/25 text-[11px] font-semibold">
          Approve
        </span>
        <span className="px-3 py-1 rounded-lg bg-[#ff4444]/10 text-[#ff4444] border border-[#ff4444]/25 text-[11px] font-semibold">
          Deny
        </span>
      </motion.div>
    </div>
  );
}

function AgentDemo({ t }: { t: (key: string) => string }) {
  // ASCII art banner as single block (gradient flows across entire banner)
  const bannerText = [
    '██╗  ██╗███████╗██╗     ██╗██╗  ██╗',
    '██║  ██║██╔════╝██║     ██║╚██╗██╔╝',
    '███████║█████╗  ██║     ██║ ╚███╔╝ ',
    '██╔══██║██╔══╝  ██║     ██║ ██╔██╗ ',
    '██║  ██║███████╗███████╗██║██╔╝ ██╗',
    '╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝',
    '  ─── Mind ───',
  ].join('\n');

  const infoLines = [
    { label: 'Provider', value: 'Anthropic', color: '#00d4ff' },
    { label: 'Model', value: 'claude-sonnet-4-20250514', color: '#00d4ff' },
    { label: 'Brain', value: '🌀 localhost:9420', color: '#8a2be2' },
    { label: 'Spiral', value: '47 nodes · 12 connections', color: '#4169e1' },
  ];

  const agentLines = [
    { prefix: '›', text: t('agent.demo1'), color: '#ffffff', isInput: true },
    { prefix: '⚡', text: t('agent.demo2'), color: '#00d4ff' },
    { prefix: '🧠', text: t('agent.demo3'), color: '#8a2be2' },
    { prefix: '✏️', text: t('agent.demo4'), color: '#ffaa00' },
    { prefix: '✅', text: t('agent.demo5'), color: '#00ff88' },
  ];

  return (
    <div className="rounded-2xl bg-[#0a0a0f] border border-white/[0.07] font-mono text-[11px] backdrop-blur-sm overflow-hidden">
      {/* Terminal title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/25 tracking-wide">helixmind — ~/my-project</span>
      </div>

      <div className="px-4 pt-3 pb-1 space-y-0">
        {/* ASCII Banner — single block so gradient flows across entire art */}
        <motion.pre
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-1 text-[7px] sm:text-[8px] leading-[1.15] font-bold whitespace-pre select-none"
          style={{
            background: 'linear-gradient(135deg, #00d4ff 0%, #4169e1 40%, #8a2be2 70%, #c471ed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'saturate(1.3) brightness(1.1)',
          }}
        >
          {bannerText}
        </motion.pre>

        {/* Info lines */}
        <motion.div
          className="space-y-0.5 mb-2 pt-1 border-t border-white/[0.04]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {infoLines.map((info, i) => (
            <div key={i} className="flex gap-2 text-[10px]">
              <span className="text-gray-600 w-14 shrink-0">{info.label}</span>
              <span style={{ color: info.color }}>{info.value}</span>
            </div>
          ))}
        </motion.div>

        {/* Separator */}
        <div className="border-t border-white/[0.04] my-1.5" />

        {/* Agent interaction */}
        <div className="space-y-2 pb-2">
          {agentLines.map((line, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-2"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 + i * 0.15, duration: 0.4 }}
            >
              <span className={`shrink-0 w-4 text-center ${line.isInput ? 'text-[#00d4ff] font-bold' : 'text-[10px]'}`}>
                {line.prefix}
              </span>
              <span
                style={{ color: line.color }}
                className={`leading-relaxed ${line.isInput ? 'font-semibold' : ''}`}
              >
                {line.text}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <motion.div
        className="flex items-center text-[9px] border-t border-white/[0.06]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.5, duration: 0.4 }}
      >
        <span className="px-2 py-1 bg-[#00d4ff]/20 text-[#00d4ff] font-bold">AGENT</span>
        <span className="px-2 py-1 bg-[#8a2be2]/15 text-[#8a2be2]">L1-L5</span>
        <span className="px-2 py-1 text-gray-500">22 tools</span>
        <span className="px-2 py-1 text-gray-600 ml-auto">sonnet-4</span>
        <span className="px-2 py-1 bg-[#00ff88]/10 text-[#00ff88]">● connected</span>
      </motion.div>
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

  const dots: Record<string, string> = {
    CRITICAL: '\uD83D\uDD34',
    HIGH: '\uD83D\uDFE0',
    MEDIUM: '\uD83D\uDFE1',
    INFO: '\uD83D\uDFE2',
  };

  return (
    <div className="rounded-2xl bg-black/60 border border-white/[0.07] p-5 font-mono text-[12px] space-y-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-4 pb-3 border-b border-white/[0.06]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/30 tracking-wide">hx monitor — security audit</span>
      </div>
      {findings.map((f, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.13, duration: 0.45 }}
        >
          <span className="shrink-0 text-sm">{dots[f.severity]}</span>
          <span
            className="shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wider"
            style={{ color: f.color, backgroundColor: `${f.color}18` }}
          >
            {f.severity}
          </span>
          <span className="text-gray-400 truncate">{f.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

const demoComponents: Record<string, React.ComponentType<{ t: (key: string) => string }>> = {
  jarvis: JarvisDemo,
  agent: AgentDemo,
  monitor: MonitorDemo,
};

// ─── Mode Row ─────────────────────────────────────────────────

interface ModeRowProps {
  mode: (typeof modes)[number];
  index: number;
  t: (key: string) => string;
}

function ModeRow({ mode, index, t }: ModeRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const Icon = mode.icon;
  const Demo = demoComponents[mode.key];

  const textContent = (
    <motion.div
      className="flex flex-col justify-center gap-6"
      initial={{ opacity: 0, x: mode.flip ? 32 : -32 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    >
      {/* Big faint index number */}
      <div
        className="absolute select-none pointer-events-none font-display font-black text-[160px] sm:text-[200px] leading-none -top-8 opacity-[0.04]"
        style={{ color: mode.color, left: mode.flip ? 'auto' : '-0.02em', right: mode.flip ? '-0.02em' : 'auto' }}
      >
        {mode.index}
      </div>

      {/* Icon + badge */}
      <div className="flex items-center gap-3">
        <motion.div
          className="flex items-center justify-center w-10 h-10 rounded-xl border"
          style={{
            borderColor: `${mode.color}40`,
            backgroundColor: `${mode.color}0f`,
            boxShadow: `0 0 20px ${mode.color}20`,
          }}
          whileHover={{ scale: 1.08, boxShadow: `0 0 32px ${mode.color}40` }}
          transition={{ duration: 0.2 }}
        >
          <Icon size={18} style={{ color: mode.color }} />
        </motion.div>
        <span
          className="text-xs font-bold tracking-[0.22em] uppercase"
          style={{ color: `${mode.color}99` }}
        >
          Mode {mode.index}
        </span>
      </div>

      {/* Title */}
      <h3
        className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-black tracking-tight leading-tight"
        style={{
          background: `linear-gradient(135deg, ${mode.color} 0%, ${mode.color}99 60%, ${mode.color}55 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {t(`${mode.key}.title`)}
      </h3>

      {/* Description */}
      <p className="text-gray-300 text-base sm:text-lg leading-relaxed font-light max-w-lg">
        {t(`${mode.key}.desc`)}
      </p>

      {/* Learn more */}
      <div>
        <Link
          href={mode.docsHref}
          className="group/link inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-all duration-200"
          style={{ color: mode.color }}
        >
          <span className="border-b border-transparent group-hover/link:border-current transition-all duration-200">
            {t('learnMore')}
          </span>
          <ArrowRight
            size={15}
            className="transition-transform duration-200 group-hover/link:translate-x-1"
          />
        </Link>
      </div>
    </motion.div>
  );

  const demoContent = (
    <motion.div
      className="relative"
      initial={{ opacity: 0, x: mode.flip ? -32 : 32, scale: 0.96 }}
      animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
    >
      {/* Glow behind demo */}
      <div
        className="absolute -inset-6 rounded-3xl blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${mode.shadowColor} 0%, transparent 70%)` }}
      />
      {/* Demo border wrapper */}
      <div
        className="relative rounded-2xl p-px"
        style={{
          background: `linear-gradient(135deg, ${mode.color}30 0%, transparent 50%, ${mode.color}15 100%)`,
        }}
      >
        <div className="rounded-2xl overflow-hidden bg-[#0a0a0f]">
          <Demo t={t} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div ref={ref} className="relative">
      {/* Per-row ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{
            background: mode.glowColor,
            left: mode.flip ? '55%' : '-5%',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>

      {/* Divider line */}
      {index > 0 && (
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      )}

      {/* Row content */}
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
            mode.flip ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''
          }`}
        >
          {textContent}
          {demoContent}
        </div>
      </div>
    </div>
  );
}

// ─── Install CTA (below modes) ────────────────────────────────

function InstallCta({ t }: { t: (key: string) => string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText('npm install -g helixmind');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <motion.div
        className="flex flex-col items-center text-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-[0.2em]">
          <Download size={14} className="text-primary" />
          {t('installLabel')}
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold text-white max-w-xl">
          {t('installTitle')}
        </h3>

        <p className="text-gray-400 text-sm sm:text-base max-w-lg leading-relaxed">
          {t('installDesc')}
        </p>

        {/* npm command + copy */}
        <button
          onClick={copy}
          className="group relative flex items-center gap-3 rounded-xl px-6 py-3.5 font-mono text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white/[0.04] border border-white/[0.08] hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <span className="text-primary font-bold">$</span>
          <span className="text-gray-200">npm install -g helixmind</span>
          {copied ? (
            <Check size={15} className="text-success" />
          ) : (
            <Copy size={15} className="text-gray-500 group-hover:text-primary transition-colors" />
          )}
        </button>

        <p className="text-xs text-gray-600">
          {t('installNote')}
        </p>
      </motion.div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────

export function ModesShowcase() {
  const t = useTranslations('modes');

  return (
    <section id="modes" className="relative overflow-hidden">
      {/* Section header */}
      <div className="relative mx-auto max-w-6xl px-4 pt-24 sm:pt-32 pb-4 text-center">
        <motion.p
          className="font-display text-xs font-bold tracking-[0.3em] uppercase mb-4"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {t('sectionLabel')}
        </motion.p>

        <motion.h2
          className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-5 leading-tight"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.05 }}
        >
          {t('title')}
        </motion.h2>

        <motion.p
          className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto font-light leading-relaxed mb-2"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.12 }}
        >
          {t('subtitle')}
        </motion.p>

        {/* Decorative line below header */}
        <motion.div
          className="mt-12 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.2 }}
        />
      </div>

      {/* Mode rows */}
      {modes.map((mode, i) => (
        <ModeRow key={mode.key} mode={mode} index={i} t={t} />
      ))}

      {/* Install CTA */}
      <InstallCta t={t} />

      {/* Bottom fade */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </section>
  );
}
