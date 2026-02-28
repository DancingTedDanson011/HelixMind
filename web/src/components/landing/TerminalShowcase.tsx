'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

/**
 * Cinematic fake CLI terminal — NO scrollbar, fixed height.
 * Content is carefully sized to fit the visible area.
 * Lines appear with a typewriter stagger when scrolled into view.
 */

// ─── Types ───────────────────────────────────────────────────

interface Span {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

interface TermLine {
  spans: Span[];
  phase?: number; // group lines into animation phases
}

// Helpers
const c = (text: string, color: string, bold = false): Span => ({ text, color, bold });
const d = (text: string): Span => ({ text, dim: true });
const t = (text: string): Span => ({ text });

// ─── Demo Content (fits ~420px without scrolling) ────────────

const LINES: TermLine[] = [
  // Phase 0: User prompt
  { spans: [c('  \u276F ', '#00d4ff', true), t('Fix the auth middleware \u2014 tokens expire too early')], phase: 0 },
  { spans: [], phase: 0 },

  // Phase 1: Activity
  { spans: [c('  \u27E1 ', '#00d4ff'), c('H', '#00d4ff'), c('e', '#0aace0'), c('l', '#2084c0'), c('i', '#385ca0'), c('x', '#5040b0'), c('M', '#7028d0'), c('i', '#8a2be2'), c('n', '#7028d0'), c('d', '#5040b0'), d(' working...  '), d('3s')], phase: 1 },
  { spans: [], phase: 1 },

  // Phase 2: Tool calls
  { spans: [d('  \u250C\u2500 Working \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')], phase: 2 },
  { spans: [d('  \u2502 '), d('[1] '), t('\uD83D\uDCC4 '), c('read_file', '#4169e1'), d(': src/middleware/auth.ts'), c(' \u2713', '#00ff88'), d(' 847ch')], phase: 2 },
  { spans: [d('  \u2502 '), d('[2] '), t('\uD83C\uDF00 '), c('spiral_query', '#4169e1'), d(': "JWT token expiry"'), c(' \u2713', '#00ff88'), d(' 3 nodes')], phase: 2 },
  { spans: [d('  \u2502 '), d('[3] '), t('\u270F\uFE0F  '), c('edit_file', '#4169e1'), d(': src/middleware/auth.ts:42'), c(' \u2713', '#00ff88'), d(' applied')], phase: 2 },
  { spans: [d('  \u2502 '), d('[4] '), t('\u270F\uFE0F  '), c('edit_file', '#4169e1'), d(': src/config/auth.config.ts'), c(' \u2713', '#00ff88'), d(' applied')], phase: 2 },
  { spans: [d('  \u2514\u2500\u2500 4 steps \u00B7 2.1s')], phase: 2 },
  { spans: [], phase: 2 },

  // Phase 3: AI response
  { spans: [c('  HelixMind', '#8a2be2', true)], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff'), t(' Found the issue using your '), c('spiral memory', '#00d4ff'), t('.')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff'), t(' From last session '), c('(L3 Reference)', '#4169e1'), t(': you switched')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff'), t(' to JWT auth. Expiry was hardcoded to 15min.')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff'), t(' Your pattern '), c('(L2 Active)', '#00ff88'), t(':')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff'), t('   \u2022 '), c('24h', '#00d4ff'), t(' tokens for dev, '), c('1h', '#00d4ff'), t(' for prod')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff')], phase: 3 },
  { spans: [c('  \u2502', '#00d4ff'), c(' \u2713', '#00ff88'), t(' Fixed both environments.')], phase: 3 },
  { spans: [], phase: 3 },

  // Phase 4: Spiral update
  { spans: [c('  \u2713', '#00ff88'), d(' Spiral: '), c('auth-middleware', '#00d4ff'), d(' \u2192 '), c('L1 Focus', '#00ffff')], phase: 4 },
  { spans: [c('  \u2713', '#00ff88'), d(' Checkpoint '), c('#12', '#6c757d'), d(' created')], phase: 4 },
  { spans: [], phase: 4 },

  // Phase 5: Web knowledge
  { spans: [t('  \uD83C\uDF10 '), c('Web Knowledge', '#ffaa00'), d(': JWT best practices stored in '), c('L6', '#ffaa00')], phase: 5 },
];

// Phase timing (seconds delay before each phase starts)
const PHASE_DELAYS = [0, 0.6, 1.2, 2.8, 4.5, 5.2];

// ─── Span Renderer ───────────────────────────────────────────

function SpanRenderer({ span }: { span: Span }) {
  const style: React.CSSProperties = {};
  let cls = '';
  if (span.color) style.color = span.color;
  if (span.bold) style.fontWeight = 700;
  if (span.dim) cls = 'text-gray-500';
  return <span style={style} className={cls}>{span.text}</span>;
}

// ─── Animated Line ───────────────────────────────────────────

function AnimatedLine({ line, delay }: { line: TermLine; delay: number }) {
  if (line.spans.length === 0) {
    return (
      <motion.div
        className="h-[21px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.01 }}
      />
    );
  }

  return (
    <motion.div
      className="whitespace-pre"
      initial={{ opacity: 0, filter: 'blur(2px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ delay, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {line.spans.map((span, j) => (
        <SpanRenderer key={j} span={span} />
      ))}
    </motion.div>
  );
}

// ─── Status Bar ──────────────────────────────────────────────

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 font-mono text-[11px] border-t border-white/[0.06] bg-white/[0.015] select-none">
      <div className="flex items-center gap-1.5">
        <span>\uD83C\uDF00</span>
        <span style={{ color: '#00ffff' }}>L1</span><span className="text-gray-600">:12</span>
        <span className="text-gray-700">\u00B7</span>
        <span style={{ color: '#00ff88' }}>L2</span><span className="text-gray-600">:45</span>
        <span className="text-gray-700">\u00B7</span>
        <span style={{ color: '#4169e1' }}>L3</span><span className="text-gray-600">:128</span>
        <span className="text-gray-700">\u00B7</span>
        <span style={{ color: '#8a2be2' }}>L4</span><span className="text-gray-600">:23</span>
        <span className="text-gray-700">\u00B7</span>
        <span style={{ color: '#ffaa00' }}>L6</span><span className="text-gray-600">:14</span>
      </div>
      <div className="flex items-center gap-2.5 text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-14 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full w-[35%]" style={{ background: 'linear-gradient(90deg, #00d4ff, #4169e1)' }} />
          </div>
          <span className="text-gray-600">665k</span>
        </div>
        <span className="text-gray-700">\u2502</span>
        <span style={{ color: '#00ff88' }}>\uD83D\uDEE1 safe</span>
        <span className="text-gray-700">\u2502</span>
        <span>opus-4.6</span>
        <span className="text-gray-700">\u2502</span>
        <span style={{ color: '#00ff88' }}>main</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function TerminalShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-80px' });

  // Calculate per-line delays based on phases
  const lineDelays: number[] = [];
  const phaseCounters: Record<number, number> = {};

  LINES.forEach((line) => {
    const phase = line.phase ?? 0;
    const counter = phaseCounters[phase] ?? 0;
    phaseCounters[phase] = counter + 1;
    lineDelays.push(PHASE_DELAYS[phase] + counter * 0.06);
  });

  return (
    <section className="py-12 sm:py-20 px-4 relative" ref={containerRef}>
      {/* Ambient glow behind terminal */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
      </div>

      <div className="mx-auto max-w-4xl relative">
        {/* Section label */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-primary/70 mb-3">
            See it in action
          </p>
          <h2 className="heading-lg text-3xl sm:text-4xl text-white">
            Your AI remembers <span className="gradient-text">everything</span>
          </h2>
        </motion.div>

        {/* Terminal Window */}
        <motion.div
          className="terminal-window relative terminal-scanlines"
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          {/* Title bar */}
          <div className="terminal-titlebar">
            <div className="flex gap-2">
              <div className="terminal-dot bg-[#ff5f57]/80" />
              <div className="terminal-dot bg-[#febc2e]/80" />
              <div className="terminal-dot bg-[#28c840]/80" />
            </div>
            <span className="text-[11px] text-gray-500 font-mono ml-2 flex-1 text-center tracking-wide">
              helixmind \u2014 zsh \u2014 120\u00D740
            </span>
            <div className="w-[52px]" /> {/* Balance the dots */}
          </div>

          {/* Terminal content — NO SCROLL */}
          <div className="terminal-body" style={{ height: '520px' }}>
            {isInView && LINES.map((line, i) => (
              <AnimatedLine key={i} line={line} delay={lineDelays[i]} />
            ))}

            {/* Blinking cursor at the end */}
            {isInView && (
              <motion.div
                className="whitespace-pre"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 6.0, duration: 0.1 }}
              >
                <span style={{ color: '#00d4ff', fontWeight: 700 }}>  {'\u276F'} </span>
                <span className="terminal-cursor" />
              </motion.div>
            )}
          </div>

          {/* Status bar */}
          <StatusBar />
        </motion.div>

        {/* Floating labels around terminal */}
        <motion.div
          className="hidden lg:flex absolute -left-48 top-1/3 items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 3.0, duration: 0.6 }}
        >
          <div className="text-right">
            <p className="text-xs font-semibold text-primary/80">Spiral Memory</p>
            <p className="text-[10px] text-gray-500">Remembers your patterns</p>
          </div>
          <div className="w-8 h-px bg-gradient-to-r from-transparent to-primary/30" />
        </motion.div>

        <motion.div
          className="hidden lg:flex absolute -right-44 top-2/3 items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 4.5, duration: 0.6 }}
        >
          <div className="w-8 h-px bg-gradient-to-l from-transparent to-success/30" />
          <div>
            <p className="text-xs font-semibold text-success/80">Auto-Validation</p>
            <p className="text-[10px] text-gray-500">12 checks, zero bugs</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
