'use client';

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  StopCircle,
  Zap,
} from 'lucide-react';
import type { SwarmInfo, SwarmSubTaskInfo } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface SwarmPanelProps {
  swarm: SwarmInfo;
  onAbort?: (swarmId: string) => void;
  onSelectSession?: (sessionId: string) => void;
}

/* ─── Constants ───────────────────────────────── */

const statusBadgeVariant: Record<string, 'default' | 'primary' | 'warning' | 'error'> = {
  idle: 'default',
  planning: 'primary',
  executing: 'primary',
  completed: 'default',
  failed: 'error',
  aborted: 'warning',
};

const statusLabel: Record<string, string> = {
  idle: 'Idle',
  planning: 'Planning...',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
  aborted: 'Aborted',
};

const TASK_STATUS_ICON: Record<SwarmSubTaskInfo['status'], typeof Clock> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

const TASK_STATUS_COLOR: Record<SwarmSubTaskInfo['status'], string> = {
  pending: 'text-gray-500',
  running: 'text-amber-400',
  completed: 'text-emerald-400',
  failed: 'text-red-400',
};

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

/* ─── Component ───────────────────────────────── */

export function SwarmPanel({ swarm, onAbort, onSelectSession }: SwarmPanelProps) {
  const completed = useMemo(
    () => swarm.subTasks.filter((t) => t.status === 'completed').length,
    [swarm.subTasks],
  );
  const total = swarm.subTasks.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const isActive = swarm.status === 'planning' || swarm.status === 'executing';

  const handleAbort = useCallback(() => {
    if (onAbort) onAbort(swarm.id);
  }, [onAbort, swarm.id]);

  const handleTaskClick = useCallback(
    (task: SwarmSubTaskInfo) => {
      if (task.sessionId && onSelectSession) {
        onSelectSession(task.sessionId);
      }
    },
    [onSelectSession],
  );

  // Group tasks by parallel groups for visual lanes
  const groupedTasks = useMemo(() => {
    if (swarm.parallelGroups.length === 0) {
      return [swarm.subTasks];
    }
    return swarm.parallelGroups.map((group) =>
      group
        .map((id) => swarm.subTasks.find((t) => t.id === id))
        .filter((t): t is SwarmSubTaskInfo => t != null),
    );
  }, [swarm.subTasks, swarm.parallelGroups]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
      {/* ── Header ── */}
      <motion.div variants={item}>
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">&#x1F41D;</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Swarm</span>
                  <Badge variant={statusBadgeVariant[swarm.status] ?? 'default'}>
                    {swarm.status === 'executing' && (
                      <Loader2 size={10} className="mr-1 animate-spin" />
                    )}
                    {swarm.status === 'planning' && (
                      <Zap size={10} className="mr-1" />
                    )}
                    {statusLabel[swarm.status] ?? swarm.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-[300px]">
                  {swarm.originalRequest}
                </p>
              </div>
            </div>
            {isActive && onAbort && (
              <button
                onClick={handleAbort}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg hover:bg-red-400/20 transition-colors"
              >
                <StopCircle size={12} />
                Abort
              </button>
            )}
          </div>

          {/* ── Progress Bar ── */}
          {total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>
                  {completed}/{total} tasks
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-amber-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* ── Parallel Group Lanes ── */}
      {groupedTasks.map((group, groupIdx) => (
        <motion.div key={groupIdx} variants={item}>
          <GlassPanel className="p-3">
            {groupedTasks.length > 1 && (
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                Phase {groupIdx + 1}
              </div>
            )}
            <div className="space-y-2">
              {group.map((task) => {
                const Icon = TASK_STATUS_ICON[task.status];
                const colorClass = TASK_STATUS_COLOR[task.status];
                const clickable = !!task.sessionId && !!onSelectSession;

                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border border-white/5 bg-white/[0.02] ${
                      clickable ? 'cursor-pointer hover:bg-white/[0.04] transition-colors' : ''
                    }`}
                  >
                    <div className={`mt-0.5 ${colorClass}`}>
                      <Icon
                        size={14}
                        className={task.status === 'running' ? 'animate-spin' : ''}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white/90 truncate">
                        {task.title}
                      </div>
                      {task.result && (
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                          {task.result}
                        </p>
                      )}
                      {task.affectedFiles.length > 0 && !task.result && (
                        <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                          {task.affectedFiles.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        </motion.div>
      ))}

      {/* ── Reason/Summary ── */}
      {swarm.reason && (swarm.status === 'completed' || swarm.status === 'failed') && (
        <motion.div variants={item}>
          <GlassPanel className="p-3">
            <p className="text-xs text-gray-500">{swarm.reason}</p>
          </GlassPanel>
        </motion.div>
      )}
    </motion.div>
  );
}
