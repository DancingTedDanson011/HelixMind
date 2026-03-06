'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  GitBranch, History, Shield, ShieldOff, Zap, Loader2,
  ChevronDown, SkipForward, X, Clock, ArrowDown, ArrowUp, Bug,
} from 'lucide-react';
import type { StatusBarInfo } from '@/lib/cli-types';
import { AnsiLine } from '@/lib/ansi-to-spans';

/* ─── Spiral Level Config ───────────────────── */

const SPIRAL_LEVELS = [
  { label: 'L1 Focus',      bg: 'bg-red-400',     glow: 'shadow-[0_0_4px_rgba(248,113,113,0.4)]' },
  { label: 'L2 Active',     bg: 'bg-orange-400',  glow: 'shadow-[0_0_4px_rgba(251,146,60,0.4)]' },
  { label: 'L3 Familiar',   bg: 'bg-yellow-400',  glow: 'shadow-[0_0_4px_rgba(250,204,21,0.4)]' },
  { label: 'L4 Background', bg: 'bg-emerald-400', glow: 'shadow-[0_0_4px_rgba(52,211,153,0.4)]' },
  { label: 'L5 Archive',    bg: 'bg-blue-400',    glow: 'shadow-[0_0_4px_rgba(96,165,250,0.4)]' },
  { label: 'L6 Deep',       bg: 'bg-purple-400',  glow: 'shadow-[0_0_4px_rgba(192,132,252,0.4)]' },
] as const;

/* ─── Validation category display ─────────────── */

const VALIDATION_CATEGORIES = [
  { key: 'structural',   label: 'Struct',   color: 'text-cyan-400' },
  { key: 'quality',      label: 'Quality',  color: 'text-blue-400' },
  { key: 'completeness', label: 'Compl',    color: 'text-emerald-400' },
  { key: 'consistency',  label: 'Consist',  color: 'text-yellow-400' },
  { key: 'logic',        label: 'Logic',    color: 'text-orange-400' },
  { key: 'security',     label: 'Security', color: 'text-red-400' },
  { key: 'performance',  label: 'Perf',     color: 'text-purple-400' },
] as const;

/* ─── Helpers ─────────────────────────────────── */

function Divider() {
  return <span className="w-px h-3 bg-white/8 flex-shrink-0" />;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

/* ─── Component ───────────────────────────────── */

interface CliStatusBarProps {
  statusBar: StatusBarInfo;
  checkpointCount?: number;
  isWorking?: boolean;
  /** Latest output lines from CLI (for live validation feed) */
  liveLines?: string[];
  /** Send a slash command / chat to CLI */
  onSendChat?: (text: string) => void;
  onCheckpointClick?: () => void;
  /** Bug panel toggle */
  openBugCount?: number;
  showBugPanel?: boolean;
  onToggleBugPanel?: () => void;
}

export function CliStatusBar({
  statusBar,
  checkpointCount,
  isWorking = false,
  liveLines = [],
  onSendChat,
  onCheckpointClick,
  openBugCount = 0,
  showBugPanel = false,
  onToggleBugPanel,
}: CliStatusBarProps) {
  const t = useTranslations('app');
  const [skipMenuOpen, setSkipMenuOpen] = useState(false);
  const [skipMenuIndex, setSkipMenuIndex] = useState(0);
  const [validationSkipped, setValidationSkipped] = useState(false);
  const skipRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // ── Session timer ──
  const [sessionStartMs] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - sessionStartMs), 1000);
    return () => clearInterval(id);
  }, [sessionStartMs]);

  // Recompute portal position when menu opens
  useLayoutEffect(() => {
    if (!skipMenuOpen || !skipRef.current) { setMenuPos(null); return; }
    const rect = skipRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.top - 4, left: rect.right - 180 });
  }, [skipMenuOpen]);

  const spiralValues = [
    statusBar.spiral.l1, statusBar.spiral.l2, statusBar.spiral.l3,
    statusBar.spiral.l4, statusBar.spiral.l5, statusBar.spiral.l6,
  ];
  const spiralTotal = spiralValues.reduce((a, b) => a + b, 0);

  const permBadge = statusBar.permissionMode === 'yolo'
    ? { label: 'YOLO', color: 'text-red-400 bg-red-500/15 border-red-500/20' }
    : statusBar.permissionMode === 'skip'
      ? { label: 'SKIP', color: 'text-amber-400 bg-amber-500/15 border-amber-500/20' }
      : { label: 'SAFE', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' };

  // ── Extract live validation info from output lines ──
  const latestActivity = extractLatestActivity(liveLines);

  // ── Skip menu ──
  const skipOptions = [
    { label: 'Skip Next Validation', desc: 'Skip once, re-enable after', action: () => { onSendChat?.('/validation skip'); setSkipMenuOpen(false); } },
    { label: 'Disable for Session', desc: 'Turn off until re-enabled', action: () => { onSendChat?.('/validation off'); setValidationSkipped(true); setSkipMenuOpen(false); } },
  ];

  const handleSkipKey = useCallback((e: KeyboardEvent) => {
    if (!skipMenuOpen) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); setSkipMenuIndex(i => Math.max(0, i - 1)); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSkipMenuIndex(i => Math.min(skipOptions.length - 1, i + 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); skipOptions[skipMenuIndex].action(); }
    else if (e.key === 'Escape') { setSkipMenuOpen(false); }
  }, [skipMenuOpen, skipMenuIndex, skipOptions]);

  useEffect(() => {
    document.addEventListener('keydown', handleSkipKey);
    return () => document.removeEventListener('keydown', handleSkipKey);
  }, [handleSkipKey]);

  useEffect(() => {
    if (!skipMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (skipRef.current && !skipRef.current.contains(e.target as Node)) {
        setSkipMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [skipMenuOpen]);

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* ─── Main status bar ─── */}
      <div
        className={`relative flex items-center gap-2 px-3 py-1 backdrop-blur-sm border-t font-mono text-[11px] text-gray-500 overflow-x-auto scrollbar-none select-none transition-all duration-300 ${
          isWorking
            ? 'bg-gradient-to-r from-[#0a0a14]/95 via-[#0d1020]/95 to-[#0a0a14]/95 border-cyan-500/15'
            : 'bg-gradient-to-r from-[#0a0a14]/95 to-[#0d0d1a]/95 border-white/5'
        }`}
      >
        {/* Working flicker overlay */}
        {isWorking && (
          <div
            className="absolute inset-0 pointer-events-none opacity-60 animate-statusbar-flicker"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.04) 30%, rgba(168,85,247,0.06) 50%, rgba(0,212,255,0.04) 70%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        )}

        {/* Working indicator */}
        {isWorking && (
          <>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Loader2 size={10} className="text-cyan-400 animate-spin" />
              <span className="text-[9px] font-bold tracking-wider text-cyan-400 uppercase animate-statusbar-text-pulse">
                WORKING
              </span>
            </div>
            <Divider />
          </>
        )}

        {/* ── Spiral Memory ── */}
        <div className="flex items-center gap-1 flex-shrink-0" title="Spiral Memory Levels">
          <span className="text-[9px] text-gray-600 mr-0.5">Spiral</span>
          {spiralValues.map((count, i) => (
            <div key={i} className="flex items-center" title={`${SPIRAL_LEVELS[i].label}: ${count} nodes`}>
              <span className={`w-[6px] h-[6px] rounded-full transition-all ${
                count > 0 ? SPIRAL_LEVELS[i].bg : 'bg-gray-700'
              } ${count > 0 ? `opacity-100 ${SPIRAL_LEVELS[i].glow}` : 'opacity-30'}`} />
              {count > 0 && <span className="text-[9px] text-gray-500 ml-px">{count}</span>}
            </div>
          ))}
          {spiralTotal > 0 && (
            <span className="text-[9px] text-gray-600 ml-0.5">({spiralTotal})</span>
          )}
        </div>

        <Divider />

        {/* ── Tokens (labeled) ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0" title="Token usage: input (received) / output (generated) this session">
          <div className="flex items-center gap-0.5">
            <ArrowDown size={8} className="text-blue-400/50" />
            <span className="text-[9px] text-gray-600">In</span>
            <span className={`text-[10px] tabular-nums ${isWorking ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatTokens(statusBar.tokens.thisMessage)}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <ArrowUp size={8} className="text-emerald-400/50" />
            <span className="text-[9px] text-gray-600">Out</span>
            <span className={`text-[10px] tabular-nums ${isWorking ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatTokens(statusBar.tokens.sessionTotal)}
            </span>
          </div>
        </div>

        {/* ── Tools this round ── */}
        {statusBar.tools.callsThisRound > 0 && (
          <>
            <Divider />
            <div className="flex items-center gap-0.5 flex-shrink-0" title={`${statusBar.tools.callsThisRound} tool calls this round`}>
              <Zap size={9} className={isWorking ? 'text-cyan-400 animate-pulse' : 'text-cyan-400/60'} />
              <span className={`text-[10px] ${isWorking ? 'text-cyan-400' : 'text-cyan-400/60'}`}>{statusBar.tools.callsThisRound}</span>
            </div>
          </>
        )}

        <Divider />

        {/* ── Model ── */}
        <span className="text-[10px] text-gray-500 truncate max-w-[100px] flex-shrink-0" title={`Model: ${statusBar.model}`}>
          {statusBar.model}
        </span>

        {/* ── Git ── */}
        {statusBar.git.branch && (
          <>
            <Divider />
            <div className="items-center gap-1 hidden sm:flex flex-shrink-0" title={`Git: ${statusBar.git.branch}${statusBar.git.uncommitted > 0 ? ` (+${statusBar.git.uncommitted} uncommitted)` : ''}`}>
              <GitBranch size={9} className="text-gray-600" />
              <span className="text-[10px] text-gray-500 truncate max-w-[70px]">{statusBar.git.branch}</span>
              {statusBar.git.uncommitted > 0 && (
                <span className="text-[10px] text-amber-400/70">+{statusBar.git.uncommitted}</span>
              )}
            </div>
          </>
        )}

        {/* ── Session time ── */}
        <Divider />
        <div className="flex items-center gap-0.5 flex-shrink-0" title={`Session duration: ${formatElapsed(elapsed)}`}>
          <Clock size={9} className="text-gray-600" />
          <span className="text-[10px] text-gray-500 tabular-nums">{formatElapsed(elapsed)}</span>
        </div>

        {/* ── Checkpoints ── */}
        {(checkpointCount ?? statusBar.checkpoints) > 0 && (
          <>
            <Divider />
            <button
              onClick={onCheckpointClick}
              className="flex items-center gap-0.5 hover:text-cyan-400 transition-colors flex-shrink-0"
              title={`${checkpointCount ?? statusBar.checkpoints} checkpoints — click to browse`}
            >
              <History size={9} />
              <span className="text-[10px]">{checkpointCount ?? statusBar.checkpoints}</span>
            </button>
          </>
        )}

        {/* ── Bugs ── */}
        {onToggleBugPanel && (
          <>
            <Divider />
            <button
              onClick={onToggleBugPanel}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors flex-shrink-0 ${
                showBugPanel
                  ? 'text-red-400 bg-red-500/10'
                  : openBugCount > 0
                    ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-gray-600 hover:text-gray-400'
              }`}
              title={`${openBugCount} open bugs — click to ${showBugPanel ? 'hide' : 'show'} panel`}
            >
              <Bug size={9} />
              {openBugCount > 0 && (
                <span className="text-[9px] font-bold">{openBugCount}</span>
              )}
            </button>
          </>
        )}

        <div className="flex-1 min-w-[8px]" />

        {/* ── Validation control ── */}
        {onSendChat && (
          <div className="relative flex-shrink-0" ref={skipRef}>
            {validationSkipped ? (
              <button
                onClick={() => { onSendChat('/validation on'); setValidationSkipped(false); }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                title="Validation is disabled — click to re-enable"
              >
                <X size={7} />
                Validation Off
              </button>
            ) : (
              <button
                onClick={() => { setSkipMenuOpen(!skipMenuOpen); setSkipMenuIndex(0); }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-500 hover:text-amber-400 hover:bg-amber-500/5 transition-colors"
                title="Skip or disable code validation"
              >
                <SkipForward size={8} />
                <span>Validation</span>
                <ChevronDown size={7} />
              </button>
            )}
            {skipMenuOpen && menuPos && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed w-[180px] rounded-lg border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl py-1 z-[100]"
                style={{ top: menuPos.top, left: menuPos.left, transform: 'translateY(-100%)' }}
              >
                <div className="px-3 py-1 text-[9px] text-gray-500 font-medium border-b border-white/5">
                  Code Validation
                </div>
                {skipOptions.map((opt, i) => (
                  <button
                    key={opt.label}
                    onClick={opt.action}
                    className={`flex flex-col w-full px-3 py-1.5 text-left transition-colors ${
                      i === skipMenuIndex
                        ? 'bg-amber-500/10'
                        : 'hover:bg-amber-500/5'
                    }`}
                  >
                    <span className={`text-[10px] font-medium ${i === skipMenuIndex ? 'text-amber-400' : 'text-gray-400'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[8px] text-gray-600">{opt.desc}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )}
          </div>
        )}

        <Divider />

        {/* ── Permission badge ── */}
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex-shrink-0 ${permBadge.color}`}>
          {statusBar.permissionMode === 'safe' ? (
            <Shield size={8} className="inline mr-0.5" />
          ) : (
            <ShieldOff size={8} className="inline mr-0.5" />
          )}
          {permBadge.label}
        </span>

        {/* Autonomous badge */}
        {statusBar.autonomous && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-purple-400 bg-purple-500/15 border border-purple-500/20 flex-shrink-0">
            AUTO
          </span>
        )}

        {/* Paused badge */}
        {statusBar.paused && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-amber-400 bg-amber-500/15 border border-amber-500/20 flex-shrink-0">
            PAUSED
          </span>
        )}
      </div>

      {/* ─── Live activity feed — shows what's happening right now ─── */}
      {isWorking && latestActivity && (
        <div className="flex items-center gap-2 px-3 py-0.5 bg-[#08081a]/90 border-t border-white/[0.03] overflow-hidden">
          {/* Validation categories progress */}
          {latestActivity.validationPhase && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {VALIDATION_CATEGORIES.map((cat) => {
                const isActive = latestActivity.activeCategory === cat.key;
                const isDone = latestActivity.doneCategories.includes(cat.key);
                return (
                  <span
                    key={cat.key}
                    className={`text-[8px] px-1 py-px rounded transition-all ${
                      isActive
                        ? `${cat.color} bg-white/10 font-bold animate-pulse`
                        : isDone
                          ? 'text-gray-600 line-through'
                          : 'text-gray-700'
                    }`}
                  >
                    {cat.label}
                  </span>
                );
              })}
              <Divider />
            </div>
          )}

          {/* Live output line */}
          <div className="flex-1 min-w-0 text-[9px] text-gray-600 truncate font-mono">
            <AnsiLine text={latestActivity.line} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Activity extraction from live output ──── */

interface ActivityInfo {
  line: string;
  validationPhase: boolean;
  activeCategory: string;
  doneCategories: string[];
}

function extractLatestActivity(lines: string[]): ActivityInfo | null {
  if (lines.length === 0) return null;

  const recent = lines.slice(-20);
  const lastLine = lines[lines.length - 1] || '';

  let validationPhase = false;
  let activeCategory = '';
  const doneCategories: string[] = [];

  for (const line of recent) {
    const lower = line.toLowerCase().replace(/\x1b\[[0-9;]*m/g, '');

    if (lower.includes('validating') || lower.includes('validation matrix') || lower.includes('validation:')) {
      validationPhase = true;
    }

    for (const cat of VALIDATION_CATEGORIES) {
      if (lower.includes(cat.key)) {
        if (lower.includes('✅') || lower.includes('passed') || lower.includes('✔')) {
          if (!doneCategories.includes(cat.key)) doneCategories.push(cat.key);
        } else if (lower.includes('checking') || lower.includes('running') || lower.includes('...')) {
          activeCategory = cat.key;
        }
      }
    }
  }

  return { line: lastLine, validationPhase, activeCategory, doneCategories };
}
