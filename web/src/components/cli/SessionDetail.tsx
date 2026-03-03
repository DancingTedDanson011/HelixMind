'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TerminalViewer } from './TerminalViewer';
import {
  Terminal,
  Clock,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Brain,
  Cpu,
  Wrench,
  GitBranch,
  History,
  Shield,
  ShieldOff,
} from 'lucide-react';
import type { SessionInfo, SessionStatus, StatusBarInfo } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface SessionDetailProps {
  session: SessionInfo | null;
  outputLines: string[];
  onAbort: (id: string) => void;
  statusBar?: StatusBarInfo | null;
}

/* ─── Helpers ─────────────────────────────────── */

const statusBadgeVariant: Record<SessionStatus, 'primary' | 'success' | 'error' | 'default' | 'warning'> = {
  running: 'primary',
  done: 'success',
  error: 'error',
  idle: 'default',
  paused: 'warning',
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ─── Component ───────────────────────────────── */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const SPIRAL_COLORS = [
  'bg-cyan-400',
  'bg-emerald-400',
  'bg-yellow-400',
  'bg-orange-400',
  'bg-purple-400',
  'bg-pink-400',
] as const;
const SPIRAL_LABELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'W'] as const;

export function SessionDetail({ session, outputLines, onAbort, statusBar }: SessionDetailProps) {
  const t = useTranslations('cli');

  // ── Empty state ─────────────────────────────────

  if (!session) {
    return (
      <GlassPanel intensity="subtle" className="p-12 text-center">
        <Terminal size={28} className="text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t('selectSession')}</p>
        <p className="text-xs text-gray-600 mt-1">{t('selectSessionHint')}</p>
      </GlassPanel>
    );
  }

  const isRunning = session.status === 'running';
  const isDone = session.status === 'done';
  const isError = session.status === 'error';

  return (
    <motion.div
      key={session.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Header ── */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Terminal size={18} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {session.icon} {session.name}
                </h2>
                <Badge variant={statusBadgeVariant[session.status]}>
                  {session.status}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                <Clock size={10} />
                <span>{formatElapsed(session.elapsed)}</span>
                <span className="text-gray-600 mx-1">|</span>
                <Layers size={10} />
                <span>{session.outputLineCount} {t('lines')}</span>
              </div>
            </div>
          </div>

          {isRunning && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onAbort(session.id)}
            >
              <StopCircle size={14} />
              {t('abort')}
            </Button>
          )}
        </div>
      </GlassPanel>

      {/* ── Live Metrics ── */}
      {statusBar && (
        <GlassPanel intensity="subtle" className="px-4 py-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Brain / Spiral */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Brain size={11} />
                <span className="font-medium">Brain</span>
              </div>
              <div className="flex items-center gap-1">
                {[statusBar.spiral.l1, statusBar.spiral.l2, statusBar.spiral.l3,
                  statusBar.spiral.l4, statusBar.spiral.l5, statusBar.spiral.l6,
                ].map((count, i) => (
                  count > 0 && (
                    <span key={i} className="flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${SPIRAL_COLORS[i]}`} />
                      <span className="text-gray-400 text-[10px]">{SPIRAL_LABELS[i]}:{count}</span>
                    </span>
                  )
                ))}
              </div>
            </div>

            {/* Tokens */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Cpu size={11} />
                <span className="font-medium">Tokens</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-[10px]">
                  in:<span className="text-gray-300">{formatTokens(statusBar.tokens.thisSession - statusBar.tokens.thisMessage)}</span>
                </span>
                <span className="text-gray-400 text-[10px]">
                  out:<span className="text-white font-medium">{formatTokens(statusBar.tokens.thisMessage)}</span>
                </span>
                <span className="text-gray-500 text-[10px]">
                  total:{formatTokens(statusBar.tokens.sessionTotal)}
                </span>
              </div>
            </div>

            {/* Tools + Model */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Wrench size={11} />
                <span className="font-medium">Tools</span>
                <span className="text-gray-400">{statusBar.tools.callsThisRound}</span>
                <span className="text-gray-600 mx-0.5">|</span>
                <History size={10} className="text-gray-500" />
                <span className="text-gray-400">{statusBar.checkpoints}</span>
              </div>
              <div className="text-[10px] text-gray-500 truncate" title={statusBar.model}>
                {statusBar.model}
              </div>
            </div>

            {/* Git + Permission */}
            <div className="space-y-1">
              {statusBar.git.branch && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <GitBranch size={11} />
                  <span className="text-gray-400 truncate max-w-[80px]">{statusBar.git.branch}</span>
                  {statusBar.git.uncommitted > 0 && (
                    <span className="text-amber-400/70 text-[10px]">+{statusBar.git.uncommitted}</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {statusBar.permissionMode === 'safe' ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Shield size={9} /> Safe</span>
                ) : statusBar.permissionMode === 'skip' ? (
                  <span className="text-[10px] text-amber-400 flex items-center gap-0.5"><ShieldOff size={9} /> Skip</span>
                ) : (
                  <span className="text-[10px] text-red-400 flex items-center gap-0.5"><ShieldOff size={9} /> YOLO</span>
                )}
                {statusBar.autonomous && (
                  <span className="text-[10px] text-purple-400 font-medium">AUTO</span>
                )}
                {statusBar.paused && (
                  <span className="text-[10px] text-amber-400 font-medium">PAUSED</span>
                )}
              </div>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* ── Terminal Output ── */}
      <TerminalViewer lines={outputLines} />

      {/* ── Result Summary ── */}
      {(isDone || isError) && session.result && (
        <GlassPanel
          intensity="subtle"
          className={`p-4 border ${
            isError
              ? 'border-error/20 bg-error/[0.03]'
              : 'border-success/20 bg-success/[0.03]'
          }`}
        >
          <div className="flex items-start gap-3">
            {isError ? (
              <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="text-success flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium mb-1">
                {isDone ? t('sessionComplete') : t('sessionFailed')}
              </p>
              <p className="text-xs text-gray-400 break-words">
                {session.result.text}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>{session.result.stepsCount} {t('steps')}</span>
                {session.result.errorsCount > 0 && (
                  <span className="text-error">
                    {session.result.errorsCount} {t('errors')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </GlassPanel>
      )}
    </motion.div>
  );
}
