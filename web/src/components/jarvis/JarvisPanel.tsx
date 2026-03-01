'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bot, Play, Square, Pause, RotateCcw, Plus, Trash2,
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Brain, Sparkles, Zap, Eye, Users,
} from 'lucide-react';
import type {
  JarvisTaskInfo, JarvisStatusInfo,
  ProposalInfo, IdentityInfo, WorkerInfo,
  ThinkingUpdate, ConsciousnessEvent,
} from '@/lib/cli-types';
import { ProposalCard } from './ProposalCard';
import { IdentityCard } from './IdentityCard';
import { ConsciousnessStream } from './ConsciousnessStream';
import { TabInfoPage } from '@/components/app/TabInfoPage';

/* ─── Types ───────────────────────────────────── */

interface JarvisPanelProps {
  tasks: JarvisTaskInfo[];
  status: JarvisStatusInfo | null;
  onStartJarvis: () => void;
  onStopJarvis: () => void;
  onPauseJarvis: () => void;
  onResumeJarvis: () => void;
  onAddTask: (title: string, description: string, priority: 'high' | 'medium' | 'low') => void;
  onClearCompleted: () => void;
  isConnected: boolean;
  // AGI props
  proposals?: ProposalInfo[];
  identity?: IdentityInfo | null;
  autonomyLevel?: number;
  workers?: WorkerInfo[];
  thinkingUpdates?: ThinkingUpdate[];
  consciousnessEvents?: ConsciousnessEvent[];
  onApproveProposal?: (id: number) => void;
  onDenyProposal?: (id: number, reason: string) => void;
  onSetAutonomy?: (level: number) => void;
  onTriggerDeepThink?: () => void;
}

/* ─── Helpers ─────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const priorityColors = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  low: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400' },
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending' },
  running: { icon: Loader2, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Done' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
  paused: { icon: Pause, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Paused' },
};

const PHASE_BADGE: Record<string, { color: string; label: string }> = {
  idle: { color: 'text-gray-500 bg-gray-500/10', label: 'Idle' },
  quick: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Quick' },
  medium: { color: 'text-amber-400 bg-amber-500/10', label: 'Medium' },
  deep: { color: 'text-fuchsia-400 bg-fuchsia-500/10', label: 'Deep' },
};

/* ─── Sub-sections ────────────────────────────── */

type Section = 'tasks' | 'proposals' | 'consciousness';

/* ─── Component ───────────────────────────────── */

export function JarvisPanel({
  tasks, status, onStartJarvis, onStopJarvis, onPauseJarvis, onResumeJarvis,
  onAddTask, onClearCompleted, isConnected,
  proposals = [], identity = null, autonomyLevel = 2, workers = [],
  thinkingUpdates = [], consciousnessEvents = [],
  onApproveProposal, onDenyProposal, onSetAutonomy, onTriggerDeepThink,
}: JarvisPanelProps) {
  const t = useTranslations('app');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [section, setSection] = useState<Section>('tasks');

  const isRunning = status?.daemonState === 'running';
  const isPaused = status?.daemonState === 'paused';
  const thinkingPhase = status?.thinkingPhase ?? 'idle';
  const phaseBadge = PHASE_BADGE[thinkingPhase] ?? PHASE_BADGE.idle;
  const jarvisName = status?.jarvisName || 'Jarvis';
  const jarvisScope = status?.scope;

  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const runningTasks = tasks.filter(t => t.status === 'running');
  const pendingTasks = tasks.filter(t => t.status === 'pending').sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
  });
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAddTask(title.trim(), description.trim() || title.trim(), priority);
    setTitle('');
    setDescription('');
    setPriority('medium');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* ─── AGI Status Header ─── */}
        {isRunning || isPaused ? (
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isRunning
                    ? 'bg-fuchsia-500/10 border border-fuchsia-500/20'
                    : 'bg-gray-500/10 border border-gray-500/20'
                }`}>
                  <Bot size={18} className={isRunning ? 'text-fuchsia-400 animate-pulse' : 'text-gray-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-200">
                      {jarvisName}: <span className={isRunning ? 'text-fuchsia-400' : 'text-gray-400'}>
                        {isRunning ? t('jarvisRunning') : t('jarvisPaused')}
                      </span>
                    </p>
                    {/* Scope badge */}
                    {jarvisScope && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        jarvisScope === 'local'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-blue-400 bg-blue-500/10'
                      }`}>
                        {jarvisScope === 'local' ? t('jarvisLocal') : t('jarvisGlobal')}
                      </span>
                    )}
                    {/* Thinking phase badge */}
                    {isRunning && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${phaseBadge.color}`}>
                        <Brain size={8} className="inline mr-0.5" />
                        {phaseBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {status?.currentTaskId ? `Task #${status.currentTaskId}` : t('jarvisIdleHint')}
                    {status?.uptimeMs ? ` · ${formatTime(status.uptimeMs)}` : ''}
                    {status ? ` · ${status.pendingCount} pending` : ''}
                    {(status?.activeWorkers ?? 0) > 0 && ` · ${status!.activeWorkers} workers`}
                    {pendingProposals.length > 0 && ` · ${pendingProposals.length} proposals`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {onTriggerDeepThink && isRunning && (
                  <button
                    onClick={onTriggerDeepThink}
                    className="px-3 py-1.5 rounded-lg text-xs text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all"
                    title="Trigger deep thinking cycle"
                  >
                    <Sparkles size={12} className="inline mr-1" />
                    Think
                  </button>
                )}
                {isRunning ? (
                  <button
                    onClick={onPauseJarvis}
                    className="px-3 py-1.5 rounded-lg text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                  >
                    <Pause size={12} className="inline mr-1" />
                    {t('jarvisPause')}
                  </button>
                ) : (
                  <button
                    onClick={onResumeJarvis}
                    className="px-3 py-1.5 rounded-lg text-xs text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all"
                  >
                    <Play size={12} className="inline mr-1" />
                    {t('jarvisResume')}
                  </button>
                )}
                <button
                  onClick={onStopJarvis}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <Square size={12} className="inline mr-1" />
                  {t('jarvisStop')}
                </button>
              </div>
            </div>

            {/* Workers bar */}
            {workers.filter(w => w.status === 'running').length > 0 && (
              <div className="mt-3 pt-2 border-t border-white/5">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Users size={10} />
                  Active Workers
                </p>
                <div className="flex gap-2">
                  {workers.filter(w => w.status === 'running').map((w) => (
                    <div key={w.workerId} className="text-[10px] px-2 py-1 rounded bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                      W{w.workerId}: {w.taskTitle}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <TabInfoPage
            icon={<Bot size={28} />}
            title={t('jarvisInfoTitle')}
            description={t('jarvisInfoDesc')}
            accentColor="fuchsia"
            docsHref="/docs/jarvis"
            docsLabel={t('jarvisInfoDocs')}
            features={[
              { icon: <Zap size={16} />, title: t('jarvisInfoFeature1Title'), description: t('jarvisInfoFeature1Desc') },
              { icon: <Brain size={16} />, title: t('jarvisInfoFeature2Title'), description: t('jarvisInfoFeature2Desc') },
              { icon: <Users size={16} />, title: t('jarvisInfoFeature3Title'), description: t('jarvisInfoFeature3Desc') },
            ]}
            actions={
              isConnected ? (
                <button
                  onClick={onStartJarvis}
                  className="px-4 py-2 rounded-lg text-sm text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all"
                >
                  <Play size={14} className="inline mr-1.5" />
                  {t('jarvisStart')}
                </button>
              ) : undefined
            }
          />
        )}

        {/* ─── Identity Card ─── */}
        {onSetAutonomy && (
          <IdentityCard
            identity={identity}
            autonomyLevel={autonomyLevel}
            onSetAutonomy={onSetAutonomy}
          />
        )}

        {/* ─── Section tabs ─── */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/5">
          {([
            { key: 'tasks' as const, icon: Zap, label: 'Tasks', count: tasks.length },
            { key: 'proposals' as const, icon: Sparkles, label: 'Proposals', count: pendingProposals.length },
            { key: 'consciousness' as const, icon: Eye, label: 'Consciousness', count: thinkingUpdates.length + consciousnessEvents.length },
          ]).map(({ key, icon: Icon, label, count }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-all ${
                section === key
                  ? 'bg-white/10 text-gray-200 font-medium'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <Icon size={12} />
              {label}
              {count > 0 && (
                <span className={`text-[9px] px-1 rounded-full ${
                  section === key ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-white/5 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tasks Section ─── */}
        {section === 'tasks' && (
          <>
            {/* Add Task */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
              <h3 className="text-xs font-medium text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={12} />
                {t('jarvisAddTask')}
              </h3>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('jarvisTaskTitle')}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:border-fuchsia-500/30 focus:outline-none transition-all"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('jarvisTaskDescription')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:border-fuchsia-500/30 focus:outline-none transition-all resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {(['high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all ${
                        priority === p
                          ? `${priorityColors[p].bg} ${priorityColors[p].border} ${priorityColors[p].text}`
                          : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t(`jarvisTask${p.charAt(0).toUpperCase() + p.slice(1)}` as any)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || !isConnected}
                  className="px-3 py-1.5 rounded-lg text-xs text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={12} className="inline mr-1" />
                  Add
                </button>
              </div>
            </div>

            {/* Running Tasks */}
            {runningTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {t('jarvisTaskRunning')} ({runningTasks.length})
                </h3>
                {runningTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}

            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} />
                  {t('jarvisTaskPending')} ({pendingTasks.length})
                </h3>
                {pendingTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}

            {/* Completed/Failed */}
            {completedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    {t('jarvisTaskCompleted')} ({completedTasks.length})
                  </h3>
                  <button
                    onClick={onClearCompleted}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-gray-500 hover:text-gray-300 transition-all"
                  >
                    <Trash2 size={10} />
                    {t('jarvisClearCompleted')}
                  </button>
                </div>
                {completedTasks.slice().reverse().slice(0, 10).map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {tasks.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-gray-600">{t('jarvisNoTasks')}</p>
                <p className="text-xs text-gray-700 mt-1">{t('jarvisNoTasksHint')}</p>
              </div>
            )}
          </>
        )}

        {/* ─── Proposals Section ─── */}
        {section === 'proposals' && (
          <div className="space-y-3">
            {/* Pending proposals */}
            {pendingProposals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} />
                  Pending Proposals ({pendingProposals.length})
                </h3>
                {pendingProposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onApprove={onApproveProposal ?? (() => {})}
                    onDeny={onDenyProposal ?? (() => {})}
                  />
                ))}
              </div>
            )}

            {/* Decided proposals */}
            {proposals.filter(p => p.status !== 'pending').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  History ({proposals.filter(p => p.status !== 'pending').length})
                </h3>
                {proposals.filter(p => p.status !== 'pending').slice().reverse().slice(0, 10).map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onApprove={onApproveProposal ?? (() => {})}
                    onDeny={onDenyProposal ?? (() => {})}
                  />
                ))}
              </div>
            )}

            {proposals.length === 0 && (
              <div className="text-center py-6">
                <Sparkles size={16} className="mx-auto text-fuchsia-500/30 mb-2" />
                <p className="text-xs text-gray-600">No proposals yet</p>
                <p className="text-xs text-gray-700 mt-1">Jarvis will generate proposals during thinking cycles.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Consciousness Section ─── */}
        {section === 'consciousness' && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <h3 className="text-xs font-medium text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Eye size={12} />
                Consciousness Stream
              </h3>
              <ConsciousnessStream
                thinkingUpdates={thinkingUpdates}
                consciousnessEvents={consciousnessEvents}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Task Card ───────────────────────────────── */

function TaskCard({ task }: { task: JarvisTaskInfo }) {
  const cfg = statusConfig[task.status] || statusConfig.pending;
  const Icon = cfg.icon;
  const pri = priorityColors[task.priority] || priorityColors.medium;

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
      <div className="flex items-start gap-2">
        <Icon size={14} className={`${cfg.color} flex-shrink-0 mt-0.5 ${task.status === 'running' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-600 font-mono">#{task.id}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${pri.bg} ${pri.text}`}>
              {task.priority}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-0.5">{task.title}</p>
          {task.description !== task.title && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          {task.result && (
            <p className="text-xs text-emerald-400/70 mt-1 line-clamp-2">{task.result}</p>
          )}
          {task.error && (
            <p className="text-xs text-red-400/70 mt-1 flex items-center gap-1">
              <AlertTriangle size={10} />
              {task.error}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-600">
              {new Date(task.createdAt).toLocaleTimeString()}
            </span>
            {task.retries > 0 && (
              <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                <RotateCcw size={8} />
                {task.retries}/{task.maxRetries}
              </span>
            )}
            {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
              <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
