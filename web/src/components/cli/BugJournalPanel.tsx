'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import {
  Bug,
  Search,
  CheckCircle2,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import type { BugInfo, BugStatus } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface BugJournalPanelProps {
  bugs: BugInfo[];
}

/* ─── Constants ───────────────────────────────── */

const statusOrder: BugStatus[] = ['open', 'investigating', 'fixed', 'verified'];

const statusBadgeVariant: Record<BugStatus, 'error' | 'warning' | 'primary' | 'default'> = {
  open: 'error',
  investigating: 'warning',
  fixed: 'primary',
  verified: 'default',
};

const statusIcon: Record<BugStatus, typeof Bug> = {
  open: Bug,
  investigating: Search,
  fixed: CheckCircle2,
  verified: ShieldCheck,
};

const statusColor: Record<BugStatus, string> = {
  open: 'border-error/20',
  investigating: 'border-warning/10',
  fixed: 'border-primary/10',
  verified: 'border-white/5',
};

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

/* ─── Component ───────────────────────────────── */

export function BugJournalPanel({ bugs }: BugJournalPanelProps) {
  const t = useTranslations('cli');

  // ── Group and sort by status ────────────────────

  const grouped = useMemo(() => {
    const groups: Record<BugStatus, BugInfo[]> = {
      open: [],
      investigating: [],
      fixed: [],
      verified: [],
    };

    for (const bug of bugs) {
      groups[bug.status].push(bug);
    }

    return statusOrder
      .filter((s) => groups[s].length > 0)
      .map((s) => ({ status: s, bugs: groups[s] }));
  }, [bugs]);

  // ── Empty state ─────────────────────────────────

  if (bugs.length === 0) {
    return (
      <GlassPanel intensity="subtle" className="p-6 text-center">
        <Bug size={20} className="text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t('noBugs')}</p>
      </GlassPanel>
    );
  }

  // ── Summary counts ─────────────────────────────

  const counts = useMemo(() => {
    const c: Partial<Record<BugStatus, number>> = {};
    for (const bug of bugs) {
      c[bug.status] = (c[bug.status] || 0) + 1;
    }
    return c;
  }, [bugs]);

  return (
    <div className="space-y-4">
      {/* ── Summary Bar ── */}
      <GlassPanel className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">{t('bugs')}:</span>
          {statusOrder.map((s) =>
            counts[s] ? (
              <Badge key={s} variant={statusBadgeVariant[s]} className="text-[10px]">
                {counts[s]} {s}
              </Badge>
            ) : null,
          )}
        </div>
      </GlassPanel>

      {/* ── Grouped Bugs ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {grouped.map((group) => {
          const StatusIcon = statusIcon[group.status];

          return (
            <motion.div key={group.status} variants={item}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon
                  size={14}
                  className={
                    group.status === 'open'
                      ? 'text-error'
                      : group.status === 'investigating'
                        ? 'text-warning'
                        : group.status === 'fixed'
                          ? 'text-primary'
                          : 'text-gray-400'
                  }
                />
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {group.status}
                </h4>
                <span className="text-xs text-gray-600">({group.bugs.length})</span>
              </div>

              {/* Bugs list */}
              <div className="space-y-2">
                {group.bugs.map((bug) => (
                  <motion.div
                    key={bug.id}
                    variants={item}
                    className={`
                      rounded-lg border bg-white/[0.01] p-3
                      ${statusColor[bug.status]}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Badge variant={statusBadgeVariant[bug.status]} className="text-[10px] flex-shrink-0">
                        #{bug.id}
                      </Badge>
                      <span className="text-[10px] text-gray-600">
                        {new Date(bug.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {bug.description}
                    </p>
                    {bug.file && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                        <FileText size={10} className="flex-shrink-0" />
                        <span className="font-mono truncate">
                          {bug.file}{bug.line ? `:${bug.line}` : ''}
                        </span>
                      </div>
                    )}
                    {bug.fixDescription && (
                      <div className="mt-2 text-xs text-primary/70 border-t border-white/5 pt-2">
                        {bug.fixDescription}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
