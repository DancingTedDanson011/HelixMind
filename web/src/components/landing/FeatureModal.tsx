'use client';

import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ExternalLink, Brain, Eye, Shield, Globe, Wifi, Layers, Radar } from 'lucide-react';
import { useEffect, useCallback, useState, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

const BrainScene = lazy(() =>
  import('@/components/brain/BrainScene').then((m) => ({ default: m.BrainScene }))
);

// ─── Types ───────────────────────────────────────────────────

type FeatureKey = 'memory' | 'brain' | 'validation' | 'web' | 'offline' | 'sessions' | 'monitor';

interface FeatureModalProps {
  feature: FeatureKey | null;
  onClose: () => void;
}

// ─── Feature Config ──────────────────────────────────────────

const featureConfig: Record<FeatureKey, {
  icon: typeof Brain;
  color: string;
  gradient: string;
}> = {
  memory:     { icon: Brain,  color: '#00d4ff', gradient: 'from-[#00d4ff] to-[#4169e1]' },
  brain:      { icon: Eye,    color: '#00ff88', gradient: 'from-[#00ff88] to-[#00d4ff]' },
  validation: { icon: Shield, color: '#4169e1', gradient: 'from-[#4169e1] to-[#8a2be2]' },
  web:        { icon: Globe,  color: '#ffaa00', gradient: 'from-[#ffaa00] to-[#ff6b6b]' },
  offline:    { icon: Wifi,   color: '#8a2be2', gradient: 'from-[#8a2be2] to-[#00d4ff]' },
  sessions:   { icon: Layers, color: '#ff6b6b', gradient: 'from-[#ff6b6b] to-[#ffaa00]' },
  monitor:    { icon: Radar,  color: '#ff4444', gradient: 'from-[#ff4444] to-[#8a2be2]' },
};

// ─── Feature Demos ───────────────────────────────────────────

function SpiralMemoryDemo() {
  const levels = [
    { label: 'L1 Focus',       color: '#00ffff', width: 85 },
    { label: 'L2 Active',      color: '#00ff88', width: 70 },
    { label: 'L3 Reference',   color: '#4169e1', width: 55 },
    { label: 'L4 Archive',     color: '#8a2be2', width: 35 },
    { label: 'L5 Deep Archive', color: '#6c757d', width: 20 },
  ];

  return (
    <div className="space-y-3">
      {levels.map((level, i) => (
        <motion.div
          key={level.label}
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
        >
          <span className="text-[11px] font-mono w-28 shrink-0" style={{ color: level.color }}>
            {level.label}
          </span>
          <div className="flex-1 h-3 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${level.color}80, ${level.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${level.width}%` }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <motion.span
            className="text-[11px] font-mono text-gray-500 w-8 text-right"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 + i * 0.1 }}
          >
            {level.width}%
          </motion.span>
        </motion.div>
      ))}
      <motion.div
        className="flex items-center gap-2 mt-4 text-[11px] text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
      >
        <div className="w-2 h-2 rounded-full bg-[#00ffff] animate-pulse" />
        <span>Nodes promote on repeated use, decay when stale</span>
      </motion.div>
    </div>
  );
}

function BrainDemo() {
  return (
    <div className="h-48 sm:h-56 rounded-xl overflow-hidden border border-white/[0.06] bg-black/40">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Brain size={24} className="text-primary/40" />
            </motion.div>
          </div>
        }
      >
        <BrainScene />
      </Suspense>
    </div>
  );
}

function ValidationDemo() {
  const checks = [
    { label: 'HTML structure',       pass: true },
    { label: 'SQL injection check',  pass: true },
    { label: 'Import validation',    pass: true },
    { label: 'Secret detection',     pass: true },
    { label: 'Type consistency',     pass: false },
    { label: 'Pattern compliance',   pass: true },
    { label: 'Edge case coverage',   pass: true },
  ];

  return (
    <div className="space-y-2">
      {checks.map((check, i) => (
        <motion.div
          key={check.label}
          className="flex items-center gap-3 font-mono text-xs"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.15, duration: 0.3 }}
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 400 }}
            style={{ color: check.pass ? '#00ff88' : '#ff4444' }}
          >
            {check.pass ? '\u2713' : '\u2717'}
          </motion.span>
          <span className="text-gray-400">{check.label}</span>
          <motion.span
            className="ml-auto text-[10px]"
            style={{ color: check.pass ? '#00ff88' : '#ff4444' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 + i * 0.15 }}
          >
            {check.pass ? 'passed' : 'fix applied'}
          </motion.span>
        </motion.div>
      ))}
      <motion.div
        className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0 }}
      >
        <span className="text-gray-500">6/7 passed, 1 auto-fixed</span>
        <span className="text-[#00ff88] font-semibold">All clear</span>
      </motion.div>
    </div>
  );
}

function WebKnowledgeDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-3 font-mono text-xs">
      <motion.div
        className="flex items-center gap-2 text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Globe size={14} className="text-[#ffaa00]" />
        <span>Searching: </span>
        <span className="text-[#ffaa00]">&quot;React Server Components patterns&quot;</span>
      </motion.div>

      {phase >= 1 && (
        <motion.div
          className="pl-5 text-gray-500"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-[#00ff88]">\u2713</span> Found 3 relevant sources
        </motion.div>
      )}

      {phase >= 2 && (
        <motion.div
          className="pl-5 text-gray-500"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-[#00ff88]">\u2713</span> Extracted key patterns &amp; code samples
        </motion.div>
      )}

      {phase >= 3 && (
        <motion.div
          className="pl-5 flex items-center gap-2"
          initial={{ opacity: 0, y: 4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <span className="text-[#00ff88]">\u2713</span>
          <span className="text-gray-400">Stored in</span>
          <span className="px-1.5 py-0.5 rounded bg-[#ffaa00]/10 text-[#ffaa00] border border-[#ffaa00]/20">
            L6 Web Knowledge
          </span>
        </motion.div>
      )}
    </div>
  );
}

function OfflineDemo() {
  const [line, setLine] = useState(0);
  const lines = [
    { prefix: '$ ', text: 'ollama pull deepseek-r1:8b', color: '#8a2be2' },
    { prefix: '  ', text: 'pulling manifest... done', color: '#00ff88' },
    { prefix: '  ', text: 'pulling layers... \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 100%', color: '#00d4ff' },
    { prefix: '$ ', text: 'helixmind --model deepseek-r1:8b', color: '#8a2be2' },
    { prefix: '  ', text: '\u2713 Connected to Ollama (localhost:11434)', color: '#00ff88' },
    { prefix: '  ', text: '\u2713 Zero data leaves your machine', color: '#00ff88' },
  ];

  useEffect(() => {
    const timers = lines.map((_, i) =>
      setTimeout(() => setLine(i + 1), 400 + i * 500)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="rounded-lg bg-black/40 border border-white/[0.06] p-4 font-mono text-xs space-y-1.5">
      {lines.slice(0, line).map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="whitespace-pre"
        >
          <span className="text-gray-600">{l.prefix}</span>
          <span style={{ color: l.color }}>{l.text}</span>
        </motion.div>
      ))}
      {line >= lines.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-600 mt-2"
        >
          <span style={{ color: '#8a2be2', fontWeight: 700 }}>{'\u276F'} </span>
          <span className="animate-pulse">\u2588</span>
        </motion.div>
      )}
    </div>
  );
}

function SessionsDemo() {
  const sessions = [
    { name: 'main', status: 'active', color: '#00ff88', task: 'Chat with user' },
    { name: 'security', status: 'running', color: '#ff4444', task: 'Security audit...' },
    { name: 'auto-1', status: 'running', color: '#ffaa00', task: 'Refactoring auth...' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 mb-3">
        {sessions.map((s, i) => (
          <motion.div
            key={s.name}
            className="px-3 py-1.5 rounded-t-lg text-[11px] font-mono border border-b-0"
            style={{
              borderColor: i === 0 ? `${s.color}40` : 'rgba(255,255,255,0.06)',
              backgroundColor: i === 0 ? `${s.color}08` : 'transparent',
              color: i === 0 ? s.color : '#6b7280',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
          >
            {s.name}
          </motion.div>
        ))}
      </div>
      {sessions.map((s, i) => (
        <motion.div
          key={s.name}
          className="flex items-center gap-3 text-xs p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 + i * 0.12 }}
        >
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: s.color }} />
          <span className="font-mono text-gray-300 w-16">{s.name}</span>
          <span className="text-gray-500 flex-1">{s.task}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: s.color, backgroundColor: `${s.color}10` }}>
            {s.status}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function MonitorDemo() {
  const events = [
    { time: '14:23', type: 'threat', label: 'Suspicious outbound connection', severity: 'high', color: '#ff4444' },
    { time: '14:23', type: 'defense', label: 'Connection blocked', severity: 'action', color: '#00ff88' },
    { time: '14:25', type: 'threat', label: 'Hardcoded API key detected', severity: 'medium', color: '#ffaa00' },
    { time: '14:25', type: 'defense', label: 'Key rotated automatically', severity: 'action', color: '#00ff88' },
    { time: '14:28', type: 'info', label: 'All checks passed', severity: 'clear', color: '#00d4ff' },
  ];

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3 text-xs"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.25 }}
        >
          <span className="font-mono text-gray-600 text-[10px] w-10">{event.time}</span>
          <motion.div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: event.color }}
            animate={event.type === 'threat' ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 1, repeat: event.type === 'threat' ? 2 : 0 }}
          />
          <span className="text-gray-400 flex-1">{event.label}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ color: event.color, backgroundColor: `${event.color}10` }}
          >
            {event.severity}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

const demoComponents: Record<FeatureKey, () => React.ReactElement> = {
  memory: SpiralMemoryDemo,
  brain: BrainDemo,
  validation: ValidationDemo,
  web: WebKnowledgeDemo,
  offline: OfflineDemo,
  sessions: SessionsDemo,
  monitor: MonitorDemo,
};

// ─── Modal Component ─────────────────────────────────────────

export function FeatureModal({ feature, onClose }: FeatureModalProps) {
  const t = useTranslations('features');

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (feature) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [feature, handleEscape]);

  return (
    <AnimatePresence>
      {feature && (() => {
        const config = featureConfig[feature];
        const Icon = config.icon;
        const Demo = demoComponents[feature];
        const capabilities: string[] = [];
        for (let i = 0; i < 4; i++) {
          try {
            capabilities.push(t(`${feature}.capabilities.${i}`));
          } catch {
            break;
          }
        }
        const docsLink = t(`${feature}.docsLink`);

        return (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              key="modal"
              className="fixed inset-0 z-[9991] flex items-center justify-center p-4 sm:p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d0f14]/95 backdrop-blur-xl shadow-2xl shadow-black/60"
                initial={{ scale: 0.8, y: 60, opacity: 0, filter: 'blur(12px)' }}
                animate={{ scale: 1, y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ scale: 0.9, y: 30, opacity: 0, filter: 'blur(8px)' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>

                {/* Ambient glow */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full blur-[120px] pointer-events-none"
                  style={{ backgroundColor: `${config.color}08` }}
                />

                <div className="relative p-6 sm:p-8">
                  {/* Header */}
                  <motion.div
                    className="flex items-center gap-4 mb-2"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <div
                      className="relative p-3.5 rounded-2xl"
                      style={{ background: `${config.color}12` }}
                    >
                      <Icon size={26} style={{ color: config.color }} />
                      {/* Glow pulse */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{ boxShadow: `0 0 20px ${config.color}20` }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                        {t(`${feature}.modalTitle`)}
                      </h2>
                    </div>
                  </motion.div>

                  <motion.p
                    className="text-sm text-gray-400 leading-relaxed mb-6 pl-[72px]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.4 }}
                  >
                    {t(`${feature}.modalDesc`)}
                  </motion.p>

                  {/* Animated Divider */}
                  <motion.div
                    className="h-px mb-6 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                  >
                    <motion.div
                      className={`h-full bg-gradient-to-r ${config.gradient}`}
                      initial={{ x: '-100%' }}
                      animate={{ x: '0%' }}
                      transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </motion.div>

                  {/* Feature Demo */}
                  <motion.div
                    className="mb-6"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                  >
                    <Demo />
                  </motion.div>

                  {/* Capabilities */}
                  {capabilities.length > 0 && (
                    <motion.div
                      className="mb-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 mb-3">
                        Key Capabilities
                      </h3>
                      <ul className="space-y-2">
                        {capabilities.map((cap, i) => (
                          <motion.li
                            key={i}
                            className="flex items-start gap-2.5 text-sm text-gray-300"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.55 + i * 0.08, duration: 0.3 }}
                          >
                            <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                            {cap}
                          </motion.li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {/* CTA Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75, duration: 0.4 }}
                  >
                    <Link href={docsLink}>
                      <Button
                        variant="outline"
                        size="md"
                        className="group relative overflow-hidden"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <ExternalLink size={14} />
                          Read the Docs
                        </span>
                        {/* Animated gradient border effect */}
                        <motion.div
                          className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r ${config.gradient} transition-opacity duration-300`}
                          style={{ padding: '1px', borderRadius: '0.5rem', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude', WebkitMaskComposite: 'xor' }}
                        />
                      </Button>
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </>
        );
      })()}
    </AnimatePresence>
  );
}
