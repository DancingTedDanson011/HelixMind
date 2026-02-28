'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Terminal,
  Shield,
  Zap,
  MessageSquare,
  StopCircle,
  Clock,
} from 'lucide-react';
import type { SessionInfo, SessionStatus } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface SessionListProps {
  sessions: SessionInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

function sessionIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('security') || lower.includes('audit')) return Shield;
  if (lower.includes('auto')) return Zap;
  if (lower.includes('chat')) return MessageSquare;
  return Terminal;
}

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

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

/* ─── Component ───────────────────────────────── */

export function SessionList({ sessions, selectedId, onSelect, onAbort }: SessionListProps) {
  const t = useTranslations('cli');

  if (sessions.length === 0) {
    return (
      <GlassPanel intensity="subtle" className="p-6 text-center">
        <Terminal size={20} className="text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t('noSessions')}</p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {t('sessions')}
        </h3>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="divide-y divide-white/[0.03]"
      >
        {sessions.map((session) => {
          const isSelected = session.id === selectedId;
          const isRunning = session.status === 'running';
          const Icon = sessionIcon(session.name);

          return (
            <motion.button
              key={session.id}
              variants={item}
              onClick={() => onSelect(session.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                ${isSelected
                  ? 'bg-primary/5 border-l-2 border-primary'
                  : 'border-l-2 border-transparent hover:bg-white/[0.02]'
                }
              `}
            >
              {/* Icon */}
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSelected ? 'bg-primary/10 border border-primary/20' : 'bg-white/[0.03] border border-white/5'}
                `}
              >
                <Icon size={14} className={isSelected ? 'text-primary' : 'text-gray-400'} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">
                    {session.icon} {session.name}
                  </span>
                  <Badge variant={statusBadgeVariant[session.status]} className="text-[10px]">
                    {session.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                  <Clock size={10} />
                  <span>{formatElapsed(session.elapsed)}</span>
                </div>
              </div>

              {/* Abort button for running sessions */}
              {isRunning && (
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-shrink-0 px-2 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAbort(session.id);
                  }}
                >
                  <StopCircle size={12} />
                </Button>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </GlassPanel>
  );
}
