'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { GitBranch, History, Shield, ShieldOff, Zap, Loader2, ChevronDown, SkipForward, X } from 'lucide-react';
import type { StatusBarInfo } from '@/lib/cli-types';
import { AnsiLine } from '@/lib/ansi-to-spans';

/* ─── Spiral Level Colors ────────────────────── */

const SPIRAL_COLORS = [
  'bg-red-400',     // L1 — Focus
  'bg-orange-400',  // L2 — Active
  'bg-yellow-400',  // L3 — Familiar
  'bg-emerald-400', // L4 — Background
  'bg-blue-400',    // L5 — Archive
  'bg-purple-400',  // L6 — Deep
] as const;

const SPIRAL_GLOW = [
  'shadow-[0_0_4px_rgba(248,113,113,0.4)]',
  'shadow-[0_0_4px_rgba(251,146,60,0.4)]',
  'shadow-[0_0_4px_rgba(250,204,21,0.4)]',
  'shadow-[0_0_4px_rgba(52,211,153,0.4)]',
  'shadow-[0_0_4px_rgba(96,165,250,0.4)]',
  'shadow-[0_0_4px_rgba(192,132,252,0.4)]',
] as const;

const SPIRAL_LABELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;

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

/* ─── Divider ────────────────────────────────── */

function Divider() {
  return <span className="w-px h-3 bg-white/10 flex-shrink-0" />;
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
}

export function CliStatusBar({
  statusBar,
  checkpointCount,
  isWorking = false,
  liveLines = [],
  onSendChat,
  onCheckpointClick,
}: CliStatusBarProps) {
  const t = useTranslations('app');
  const [skipMenuOpen, setSkipMenuOpen] = useState(false);
  const [skipMenuIndex, setSkipMenuIndex] = useState(0);
  const [validationSkipped, setValidationSkipped] = useState(false);
  const skipRef = useRef<HTMLDivElement>(null);

  const spiralValues = [
    statusBar.spiral.l1,
    statusBar.spiral.l2,
    statusBar.spiral.l3,
    statusBar.spiral.l4,
    statusBar.spiral.l5,
    statusBar.spiral.l6,
  ];

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  const permBadge = statusBar.permissionMode === 'yolo'
    ? { label: 'YOLO', color: 'text-red-400 bg-red-500/15 border-red-500/20' }
    : statusBar.permissionMode === 'skip'
      ? { label: 'SKIP', color: 'text-amber-400 bg-amber-500/15 border-amber-500/20' }
      : { label: 'SAFE', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' };

  // ── Extract live validation info from output lines ──
  const latestActivity = extractLatestActivity(liveLines);

  // ── Skip menu keyboard navigation ──
  const skipOptions = [
    { label: 'Skip Once', action: () => { onSendChat?.('/validation skip'); setSkipMenuOpen(false); } },
    { label: 'Skip Session', action: () => { onSendChat?.('/validation off'); setValidationSkipped(true); setSkipMenuOpen(false); } },
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

  // Close skip menu on outside click
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
    <div className="flex flex-col">
      {/* Main status bar */}
      <div
        className={`relative flex items-center gap-2.5 px-3 py-1.5 backdrop-blur-sm border-t font-mono text-[11px] text-gray-500 overflow-x-auto scrollbar-none select-none transition-all duration-300 ${
          isWorking
            ? 'bg-gradient-to-r from-[#0a0a14]/90 via-[#0d1020]/90 to-[#0a0a14]/90 border-cyan-500/15'
            : 'bg-gradient-to-r from-[#0a0a14]/90 to-[#0d0d1a]/90 border-white/5'
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
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Loader2 size={11} className="text-cyan-400 animate-spin" />
              <span className="text-[9px] font-bold tracking-wider text-cyan-400 uppercase animate-statusbar-text-pulse">
                WORKING
              </span>
            </div>
            <Divider />
          </>
        )}

        {/* Spiral dots */}
        <div className="flex items-center gap-1" title={t('statusBarSpiral')}>
          {spiralValues.map((count, i) => (
            <div key={i} className="flex items-center gap-0.5" title={`${SPIRAL_LABELS[i]}: ${count}`}>
              <span className={`w-2 h-2 rounded-full transition-all ${count > 0 ? SPIRAL_COLORS[i] : 'bg-gray-700'} ${count > 0 ? `opacity-100 ${SPIRAL_GLOW[i]}` : 'opacity-30'}`} />
              {count > 0 && <span className="text-gray-500 text-[10px]">{count}</span>}
            </div>
          ))}
        </div>

        <Divider />

        {/* Tokens */}
        <div className="flex items-center gap-1" title={t('statusBarTokens')}>
          <span className={isWorking ? 'text-gray-400 transition-colors' : 'text-gray-500'}>{formatTokens(statusBar.tokens.thisMessage)}</span>
          <span className="text-gray-700">/</span>
          <span className={isWorking ? 'text-gray-400 transition-colors' : 'text-gray-500'}>{formatTokens(statusBar.tokens.sessionTotal)}</span>
        </div>

        {/* Tools this round */}
        {statusBar.tools.callsThisRound > 0 && (
          <>
            <Divider />
            <div className="flex items-center gap-0.5" title={t('statusBarTools')}>
              <Zap size={10} className={isWorking ? 'text-cyan-400 animate-pulse' : 'text-cyan-400/60'} />
              <span className={isWorking ? 'text-cyan-400' : 'text-cyan-400/60'}>{statusBar.tools.callsThisRound}</span>
            </div>
          </>
        )}

        <Divider />

        {/* Model */}
        <span className="text-gray-500 truncate max-w-[120px]" title={statusBar.model}>
          {statusBar.model}
        </span>

        {/* Git */}
        {statusBar.git.branch && (
          <>
            <Divider />
            <div className="flex items-center gap-1 hidden sm:flex" title={t('statusBarGit')}>
              <GitBranch size={10} className="text-gray-600" />
              <span className="text-gray-500 truncate max-w-[80px]">{statusBar.git.branch}</span>
              {statusBar.git.uncommitted > 0 && (
                <span className="text-amber-400/70">+{statusBar.git.uncommitted}</span>
              )}
            </div>
          </>
        )}

        {/* Checkpoints */}
        {(checkpointCount ?? statusBar.checkpoints) > 0 && (
          <>
            <Divider />
            <button
              onClick={onCheckpointClick}
              className="flex items-center gap-0.5 hover:text-cyan-400 transition-colors"
              title={t('statusBarCheckpoints')}
            >
              <History size={10} />
              <span>{checkpointCount ?? statusBar.checkpoints}</span>
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Skip Validation dropdown */}
        {onSendChat && (
          <div className="relative" ref={skipRef}>
            {validationSkipped ? (
              <button
                onClick={() => { onSendChat('/validation on'); setValidationSkipped(false); }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-500 bg-white/5 border border-white/10 hover:text-amber-400 hover:border-amber-500/20 transition-colors"
                title="Re-enable validation"
              >
                <X size={7} />
                VAL OFF
              </button>
            ) : (
              <button
                onClick={() => { setSkipMenuOpen(!skipMenuOpen); setSkipMenuIndex(0); }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-500 hover:text-amber-400 transition-colors"
                title="Skip validation"
              >
                <SkipForward size={8} />
                <ChevronDown size={7} />
              </button>
            )}
            {skipMenuOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-36 rounded-lg border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl py-0.5 z-50">
                {skipOptions.map((opt, i) => (
                  <button
                    key={opt.label}
                    onClick={opt.action}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-[10px] transition-colors ${
                      i === skipMenuIndex
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/5'
                    }`}
                  >
                    <SkipForward size={9} />
                    {opt.label}
                  </button>
                ))}
                <div className="px-3 py-1 text-[8px] text-gray-600 border-t border-white/5">
                  Arrow keys + Enter to select
                </div>
              </div>
            )}
          </div>
        )}

        <Divider />

        {/* Permission badge */}
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${permBadge.color}`}>
          {statusBar.permissionMode === 'safe' ? (
            <Shield size={8} className="inline mr-0.5" />
          ) : (
            <ShieldOff size={8} className="inline mr-0.5" />
          )}
          {permBadge.label}
        </span>

        {/* Autonomous badge */}
        {statusBar.autonomous && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-purple-400 bg-purple-500/15 border border-purple-500/20">
            AUTO
          </span>
        )}

        {/* Paused badge */}
        {statusBar.paused && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-amber-400 bg-amber-500/15 border border-amber-500/20">
            PAUSED
          </span>
        )}
      </div>

      {/* Live activity feed — shows what's happening right now */}
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

  // Look at the last ~20 lines for validation context
  const recent = lines.slice(-20);
  const lastLine = lines[lines.length - 1] || '';

  let validationPhase = false;
  let activeCategory = '';
  const doneCategories: string[] = [];

  for (const line of recent) {
    const lower = line.toLowerCase().replace(/\x1b\[[0-9;]*m/g, '');

    // Detect validation phase
    if (lower.includes('validating') || lower.includes('validation matrix') || lower.includes('validation:')) {
      validationPhase = true;
    }

    // Detect category progress
    for (const cat of VALIDATION_CATEGORIES) {
      if (lower.includes(cat.key)) {
        if (lower.includes('✅') || lower.includes('passed') || lower.includes('✔')) {
          if (!doneCategories.includes(cat.key)) doneCategories.push(cat.key);
        } else if (lower.includes('checking') || lower.includes('running') || lower.includes('...')) {
          activeCategory = cat.key;
        }
      }
    }

    // Tool calls
    if (lower.includes('reading') || lower.includes('writing') || lower.includes('editing')
      || lower.includes('running') || lower.includes('searching') || lower.includes('finding')) {
      // Keep as general activity
    }
  }

  return {
    line: lastLine,
    validationPhase,
    activeCategory,
    doneCategories,
  };
}
