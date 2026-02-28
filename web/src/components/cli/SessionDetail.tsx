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
} from 'lucide-react';
import type { SessionInfo, SessionStatus } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface SessionDetailProps {
  session: SessionInfo | null;
  outputLines: string[];
  onAbort: (id: string) => void;
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

export function SessionDetail({ session, outputLines, onAbort }: SessionDetailProps) {
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
