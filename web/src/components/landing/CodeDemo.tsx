'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';

// ─── Realistic HelixMind CLI Demo ─────────────────────────────

interface TermLine {
  spans: Span[];
  delay?: number; // extra ms before this line appears
}

interface Span {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

// Helper to create spans
const c = (text: string, color: string, bold = false): Span => ({ text, color, bold });
const d = (text: string): Span => ({ text, dim: true });
const t = (text: string): Span => ({ text });

const LINES: TermLine[] = [
  // ─── Command ───
  { spans: [d('  '), c('$', '#6c757d'), t(' helixmind chat')] },
  { spans: [] },

  // ─── ANSI Shadow Figlet Banner (gradient: cyan → blue → violet) ───
  { spans: [c('  ██╗  ██╗███████╗██╗     ██╗██╗  ██╗', '#00d4ff')] },
  { spans: [c('  ██║  ██║██╔════╝██║     ██║', '#00ccf0'), c('╚██╗██╔╝', '#1a7fd8')] },
  { spans: [c('  ███████║█████╗  ██║     ██║', '#2070c8'), c(' ╚███╔╝ ', '#3560c0')] },
  { spans: [c('  ██╔══██║██╔══╝  ██║     ██║', '#4a50b8'), c(' ██╔██╗ ', '#5e40b0')] },
  { spans: [c('  ██║  ██║███████╗███████╗██║', '#7030c0'), c('██╔╝ ██╗', '#8a2be2')] },
  { spans: [c('  ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝', '#7a2ed8'), c('╚═╝  ╚═╝', '#8a2be2')] },
  { spans: [] },
  { spans: [c('  ─── ', '#00d4ff'), c('Mind', '#4169e1', true), c(' ───', '#8a2be2')] },
  { spans: [] },

  // ─── Startup Info ───
  { spans: [d('  Provider: '), t('ollama'), d(' (local) │ Model: '), c('llama3.2', '#00d4ff')] },
  { spans: [d('  Project: '), t('my-saas-app'), d(' (typescript)')] },
  { spans: [d('  Brain: '), c('project-local', '#00d4ff'), d(' (.helixmind/) │ '), c('847', '#00ff88'), d(' memories')] },
  { spans: [d('  Agent mode: '), c('safe permissions', '#00ff88')] },
  { spans: [d('  🧠 Brain: '), d('http://127.0.0.1:9420')] },
  { spans: [] },
  { spans: [
    d('  '), c('L1', '#00d4ff'), d(':12 '),
    c('L2', '#00ff88'), d(':45 '),
    c('L3', '#4169e1'), d(':128 '),
    c('L4', '#8a2be2'), d(':23 '),
    c('L5', '#6c757d'), d(':8 '),
    c('L6', '#ffaa00'), d(':14'),
  ] },
  { spans: [d('  Type /help for commands, ESC ESC = stop, Ctrl+C to exit')] },
  { spans: [c('  ─────────────────────────────────────────────────────────', '#00d4ff')] },
  { spans: [] },

  // ─── User Prompt ───
  { spans: [c('  ❯ ', '#00d4ff', true), t('Fix the auth middleware — tokens expire too early')], delay: 400 },
  { spans: [] },

  // ─── Activity Indicator ───
  { spans: [c('  ⟡ ', '#00d4ff'), c('H', '#00d4ff'), c('e', '#0aace0'), c('l', '#2084c0'), c('i', '#385ca0'), c('x', '#5040b0'), c('M', '#7028d0'), c('i', '#8a2be2'), c('n', '#7028d0'), c('d', '#5040b0'), d(' working...  '), d('3s')], delay: 200 },
  { spans: [] },

  // ─── Tool Block ───
  { spans: [d('  ┌─ Working ──────────────────────────────────────────────')], delay: 300 },
  { spans: [d('  │ '), d('[1] '), t('📄 '), c('read_file', '#4169e1'), d(': src/middleware/auth.ts'), c(' ✓', '#00ff88'), d(' 847ch')], delay: 150 },
  { spans: [d('  │ '), d('[2] '), t('🌀 '), c('spiral_query', '#4169e1'), d(': "JWT auth token expiry"'), c(' ✓', '#00ff88'), d(' 3 nodes')], delay: 150 },
  { spans: [d('  │ '), d('[3] '), t('📄 '), c('read_file', '#4169e1'), d(': src/config/auth.config.ts'), c(' ✓', '#00ff88'), d(' 234ch')], delay: 150 },
  { spans: [d('  │ '), d('[4] '), t('✏️  '), c('edit_file', '#4169e1'), d(': src/middleware/auth.ts:42'), c(' ✓', '#00ff88'), d(' 3 ln')], delay: 150 },
  { spans: [d('  │ '), d('[5] '), t('✏️  '), c('edit_file', '#4169e1'), d(': src/config/auth.config.ts'), c(' ✓', '#00ff88'), d(' 2 ln')], delay: 150 },
  { spans: [d('  └── 5 steps · 2.1s')], delay: 100 },
  { spans: [] },

  // ─── AI Response ───
  { spans: [c('  ─────────────────────────────────────────────────────────', '#00d4ff')], delay: 200 },
  { spans: [] },
  { spans: [c('  HelixMind', '#8a2be2', true)] },
  { spans: [c('  │', '#00d4ff'), t(' I found the issue using your spiral memory. From our')], delay: 50 },
  { spans: [c('  │', '#00d4ff'), t(' last session '), c('(L3 Reference)', '#4169e1'), t(', you switched from cookie-based')], delay: 50 },
  { spans: [c('  │', '#00d4ff'), t(' to JWT auth. The expiry was hardcoded to 15min.')], delay: 50 },
  { spans: [c('  │', '#00d4ff')] },
  { spans: [c('  │', '#00d4ff'), t(' Your pattern '), c('(L2 Active)', '#00ff88'), t(': you prefer ')], delay: 50 },
  { spans: [c('  │', '#00d4ff'), t(' • '), c('24h', '#00d4ff'), t(' tokens for development')], delay: 50 },
  { spans: [c('  │', '#00d4ff'), t(' • '), c('1h', '#00d4ff'), t(' tokens for production')], delay: 50 },
  { spans: [c('  │', '#00d4ff')] },
  { spans: [c('  │', '#00d4ff'), t(' Fixed both environments. Changes:')], delay: 50 },
  { spans: [c('  │', '#00d4ff'), c(' ✓', '#00ff88'), t(' src/middleware/auth.ts:42 — dynamic expiry')], delay: 50 },
  { spans: [c('  │', '#00d4ff'), c(' ✓', '#00ff88'), t(' src/config/auth.config.ts — env-based config')], delay: 50 },
  { spans: [] },
  { spans: [c('  ─────────────────────────────────────────────────────────', '#00d4ff')] },
  { spans: [] },

  // ─── Validation Matrix ───
  { spans: [d('  ╭─── '), c('✅ Validation Matrix', '#00ff88'), d(' ── 12 checks ── 1 loop ── 340ms ───╮')], delay: 300 },
  { spans: [d('  │')] },
  { spans: [d('  │   Structural  : '), c('✅✅✅', '#00ff88'), d('  3/3')] },
  { spans: [d('  │   Completeness: '), c('✅✅', '#00ff88'), d('    2/2')] },
  { spans: [d('  │   Consistency : '), c('✅✅✅', '#00ff88'), d('  3/3')] },
  { spans: [d('  │   Security    : '), c('✅✅', '#00ff88'), d('    2/2')] },
  { spans: [d('  │   Style       : '), c('✅✅', '#00ff88'), d('    2/2')] },
  { spans: [d('  │')] },
  { spans: [d('  │   '), c('12/12 passed', '#00ff88'), d(' │ 0 warnings │ 0 errors')] },
  { spans: [d('  │')] },
  { spans: [d('  ╰──────────────────────────────────────────────────────╯')] },
  { spans: [] },

  // ─── Spiral Update ───
  { spans: [c('  ✓', '#00ff88'), d(' Spiral updated: '), c('auth-middleware', '#00d4ff'), d(' promoted to '), c('L1 Focus', '#00d4ff')], delay: 200 },
  { spans: [c('  ✓', '#00ff88'), d(' Checkpoint created '), d('(12 total)')], delay: 100 },

  // ─── Web Knowledge Notification ───
  { spans: [] },
  { spans: [t('  🌐 '), c('Web Knowledge', '#ffaa00'), d(': JWT best practices for production')], delay: 400 },
  { spans: [d('     Source: https://auth0.com/docs/tokens')] },
  { spans: [d('     Quality: '), c('0.94', '#00ff88'), d(' │ Stored in '), c('L6', '#ffaa00'), d(' (Web Knowledge)')] },
];

// ─── Status Bar Component ───
function StatusBar() {
  const [time, setTime] = useState('14:32');

  useEffect(() => {
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  }, []);

  return (
    <div className="border-t border-white/5 px-4 py-2 font-mono text-[11px] flex items-center justify-between select-none">
      <div className="flex items-center gap-1">
        <span>🌀</span>
        <span style={{ color: '#00d4ff' }}>L1</span><span className="text-gray-600">:12</span>
        <span style={{ color: '#00ff88' }}>L2</span><span className="text-gray-600">:45</span>
        <span style={{ color: '#4169e1' }}>L3</span><span className="text-gray-600">:128</span>
        <span style={{ color: '#8a2be2' }}>L4</span><span className="text-gray-600">:23</span>
        <span style={{ color: '#6c757d' }}>L5</span><span className="text-gray-600">:8</span>
        <span style={{ color: '#ffaa00' }}>L6</span><span className="text-gray-600">:14</span>
      </div>

      {/* Token Bar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full w-[35%]" style={{ background: 'linear-gradient(90deg, #00d4ff, #4169e1)' }} />
          </div>
          <span className="text-gray-600">1.2M/10M</span>
        </div>
        <span className="text-gray-700">│</span>
        <span style={{ color: '#00ff88' }}>🛡 safe</span>
        <span className="text-gray-700">│</span>
        <span className="text-gray-500">llama3.2</span>
        <span className="text-gray-700">│</span>
        <span style={{ color: '#00ff88' }}>master</span>
        <span className="text-gray-700">│</span>
        <span className="text-gray-600">{time}</span>
      </div>
    </div>
  );
}

// ─── Hint Bar ───
function HintBar() {
  return (
    <div className="px-4 py-1.5 font-mono text-[10px] text-gray-600 flex items-center gap-1 border-t border-white/5">
      <span style={{ color: '#00d4ff' }}>▸▸</span>
      <span style={{ color: '#00ff88' }}>safe permissions</span>
      <span className="text-gray-700"> · </span>
      <span>esc = stop</span>
      <span className="text-gray-700"> · </span>
      <span>/help</span>
    </div>
  );
}

// ─── Span Renderer ───
function SpanRenderer({ span }: { span: Span }) {
  const style: React.CSSProperties = {};
  let className = '';

  if (span.color) style.color = span.color;
  if (span.bold) style.fontWeight = 700;
  if (span.dim) className = 'text-gray-600';

  return <span style={style} className={className}>{span.text}</span>;
}

// ─── Animated Line ───
function AnimatedLine({ line, index, baseDelay }: { line: TermLine; index: number; baseDelay: number }) {
  if (line.spans.length === 0) {
    return (
      <motion.div
        className="h-[18px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: baseDelay, duration: 0.05 }}
      />
    );
  }

  return (
    <motion.div
      className="whitespace-pre"
      initial={{ opacity: 0, x: -2 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: baseDelay, duration: 0.15 }}
    >
      {line.spans.map((span, j) => (
        <SpanRenderer key={j} span={span} />
      ))}
    </motion.div>
  );
}

// ─── Main Component ───
export function CodeDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  // Calculate cumulative delays
  const lineDelays: number[] = [];
  let cumDelay = 0;
  const BASE_LINE_DELAY = 0.04; // 40ms per line base

  LINES.forEach((line, i) => {
    if (line.delay) cumDelay += line.delay / 1000;
    lineDelays.push(cumDelay);
    cumDelay += BASE_LINE_DELAY;
  });

  return (
    <section className="py-24 px-4" ref={containerRef}>
      <div className="mx-auto max-w-4xl">
        <GlassPanel intensity="strong" className="p-0 overflow-hidden">
          {/* Terminal Title Bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] text-gray-500 font-mono ml-2 flex-1 text-center">
              helixmind — zsh — 120×40
            </span>
          </div>

          {/* Terminal Content */}
          <div
            className="p-3 font-mono text-[12px] leading-[18px] overflow-x-auto overflow-y-auto scrollbar-thin"
            style={{
              background: '#050510',
              height: '560px',
            }}
          >
            {isInView && LINES.map((line, i) => (
              <AnimatedLine
                key={i}
                line={line}
                index={i}
                baseDelay={lineDelays[i]}
              />
            ))}
          </div>

          {/* Bottom Bars */}
          <HintBar />
          <StatusBar />
        </GlassPanel>
      </div>
    </section>
  );
}
