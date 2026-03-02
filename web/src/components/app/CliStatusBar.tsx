'use client';

import { useTranslations } from 'next-intl';
import { GitBranch, History, Shield, ShieldOff, Zap } from 'lucide-react';
import type { StatusBarInfo } from '@/lib/cli-types';

/* ─── Spiral Level Colors ────────────────────── */

const SPIRAL_COLORS = [
  'bg-red-400',     // L1 — Focus
  'bg-orange-400',  // L2 — Active
  'bg-yellow-400',  // L3 — Familiar
  'bg-emerald-400', // L4 — Background
  'bg-blue-400',    // L5 — Archive
  'bg-purple-400',  // L6 — Deep
] as const;

const SPIRAL_LABELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;

/* ─── Component ───────────────────────────────── */

interface CliStatusBarProps {
  statusBar: StatusBarInfo;
  checkpointCount?: number;
  onCheckpointClick?: () => void;
}

export function CliStatusBar({ statusBar, checkpointCount, onCheckpointClick }: CliStatusBarProps) {
  const t = useTranslations('app');

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

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#0a0a14]/80 backdrop-blur-sm border-t border-white/5 font-mono text-[10px] text-gray-500 overflow-x-auto scrollbar-none select-none">
      {/* Spiral dots */}
      <div className="flex items-center gap-0.5" title={t('statusBarSpiral')}>
        {spiralValues.map((count, i) => (
          <div key={i} className="flex items-center gap-0.5" title={`${SPIRAL_LABELS[i]}: ${count}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? SPIRAL_COLORS[i] : 'bg-gray-700'} ${count > 0 ? 'opacity-100' : 'opacity-30'}`} />
            {count > 0 && <span className="text-gray-600">{count}</span>}
          </div>
        ))}
      </div>

      <span className="text-gray-700">|</span>

      {/* Tokens */}
      <div className="flex items-center gap-1" title={t('statusBarTokens')}>
        <span className="text-gray-600">{formatTokens(statusBar.tokens.thisMessage)}</span>
        <span className="text-gray-700">/</span>
        <span className="text-gray-600">{formatTokens(statusBar.tokens.sessionTotal)}</span>
      </div>

      {/* Tools this round */}
      {statusBar.tools.callsThisRound > 0 && (
        <>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-0.5" title={t('statusBarTools')}>
            <Zap size={9} className="text-cyan-400/60" />
            <span className="text-cyan-400/60">{statusBar.tools.callsThisRound}</span>
          </div>
        </>
      )}

      <span className="text-gray-700">|</span>

      {/* Model */}
      <span className="text-gray-500 truncate max-w-[100px]" title={statusBar.model}>
        {statusBar.model}
      </span>

      {/* Git */}
      {statusBar.git.branch && (
        <>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-0.5 hidden sm:flex" title={t('statusBarGit')}>
            <GitBranch size={9} className="text-gray-600" />
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
          <span className="text-gray-700">|</span>
          <button
            onClick={onCheckpointClick}
            className="flex items-center gap-0.5 hover:text-cyan-400 transition-colors"
            title={t('statusBarCheckpoints')}
          >
            <History size={9} />
            <span>{checkpointCount ?? statusBar.checkpoints}</span>
          </button>
        </>
      )}

      <div className="flex-1" />

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
  );
}
