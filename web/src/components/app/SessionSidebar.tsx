'use client';

import { useTranslations } from 'next-intl';
import {
  Shield, Zap, Activity, Bot, MessageSquare, X, StopCircle, XCircle,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface SessionInfo {
  id: string;
  name: string;
  icon: string;
  status: string;
  startTime: number;
  endTime: number;
  elapsed: number;
  outputLineCount: number;
  recentOutput: string[];
  result: {
    text: string;
    stepsCount: number;
    errorsCount: number;
  } | null;
}

interface ActionButton {
  label: string;
  icon: typeof Zap;
  onClick: () => void;
  color: string;
  hoverColor: string;
}

interface SessionSidebarProps {
  sessions: SessionInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAbort: (id: string) => void;
  onDismiss?: (id: string) => void;
  actions?: ActionButton[];
  emptyLabel?: string;
  emptyHint?: string;
}

/* ─── Session icon helper ────────────────────── */

function SessionIcon({ name, size = 12, className = '' }: { name: string; size?: number; className?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('security') || lower.includes('audit')) return <Shield size={size} className={className} />;
  if (lower.includes('auto')) return <Zap size={size} className={className} />;
  if (lower.includes('monitor')) return <Activity size={size} className={className} />;
  if (lower.includes('jarvis')) return <Bot size={size} className={className} />;
  return <MessageSquare size={size} className={className} />;
}

/* ─── Helpers ─────────────────────────────────── */

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'running': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'done': return 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10';
    case 'error': return 'bg-red-500/5 text-red-400 border-red-500/10';
    case 'paused': return 'bg-amber-500/5 text-amber-400 border-amber-500/10';
    default: return 'bg-white/5 text-gray-500 border-white/10';
  }
}

/* ─── Component ───────────────────────────────── */

export function SessionSidebar({
  sessions,
  selectedId,
  onSelect,
  onAbort,
  onDismiss,
  actions,
  emptyLabel,
  emptyHint,
}: SessionSidebarProps) {
  const t = useTranslations('app');

  return (
    <div className="flex flex-col h-full w-72">
      {/* Header */}
      <div className="p-3 border-b border-white/5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
          {t('sessions')}
        </p>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`
              w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group relative
              ${selectedId === session.id
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }
            `}
          >
            <div className="flex items-start gap-2">
              <SessionIcon name={session.name} size={14} className="mt-0.5 flex-shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">{session.name}</span>
                  {session.status === 'running' && (
                    <Activity size={8} className="text-emerald-400 animate-pulse flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${statusColor(session.status)}`}>
                    {session.status}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {formatElapsed(session.elapsed)}
                  </span>
                  {session.result && (
                    <span className="text-[10px] text-gray-600">
                      {session.result.stepsCount} steps
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Abort button on hover for running sessions */}
            {session.status === 'running' && (
              <span
                onClick={(e) => { e.stopPropagation(); onAbort(session.id); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                title="Stop"
              >
                <StopCircle size={12} />
              </span>
            )}
            {/* Dismiss button on hover for non-running sessions */}
            {onDismiss && session.status !== 'running' && (
              <span
                onClick={(e) => { e.stopPropagation(); onDismiss(session.id); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                title="Dismiss"
              >
                <XCircle size={12} />
              </span>
            )}
          </button>
        ))}

        {sessions.length === 0 && (
          <div className="text-center py-8 space-y-1">
            <p className="text-xs text-gray-600">{emptyLabel || t('noSessions')}</p>
            {emptyHint && (
              <p className="text-[10px] text-gray-700">{emptyHint}</p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {actions && actions.length > 0 && (
        <div className="p-2 border-t border-white/5 space-y-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${action.color} bg-white/5 border border-white/5 hover:${action.hoverColor} transition-all`}
            >
              <action.icon size={12} />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
