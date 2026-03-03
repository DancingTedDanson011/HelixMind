'use client';

import { useState } from 'react';
import {
  Clock, Loader2, CheckCircle2, XCircle, Pause,
  ChevronDown, ChevronUp, Plus, RotateCcw, Trash2,
} from 'lucide-react';
import type { JarvisTaskInfo, JarvisTaskPriority } from '@/lib/cli-types';

interface JarvisTaskListProps {
  tasks: JarvisTaskInfo[];
  isConnected: boolean;
  onAddTask: (title: string, description: string, priority: JarvisTaskPriority) => void;
  onDeleteTask: (taskId: number) => void;
}

const priorityColors = {
  high: 'text-red-400 bg-red-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  low: 'text-gray-400 bg-gray-500/10',
};

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', spin: false },
  running: { icon: Loader2, color: 'text-red-400', spin: true },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', spin: false },
  failed: { icon: XCircle, color: 'text-red-400', spin: false },
  paused: { icon: Pause, color: 'text-gray-400', spin: false },
};

function elapsed(task: JarvisTaskInfo): string {
  const start = task.startedAt ?? task.createdAt;
  const end = task.completedAt ?? Date.now();
  const s = Math.floor((end - start) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function JarvisTaskList({ tasks, isConnected, onAddTask, onDeleteTask }: JarvisTaskListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<JarvisTaskPriority>('medium');

  const running = tasks.filter(t => t.status === 'running');
  const pending = tasks.filter(t => t.status === 'pending').sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return (pri[a.priority] ?? 1) - (pri[b.priority] ?? 1);
  });
  const done = tasks.filter(t => t.status === 'completed' || t.status === 'failed').slice(-5).reverse();

  const sorted = [...running, ...pending, ...done];

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAddTask(title.trim(), title.trim(), priority);
    setTitle('');
    setPriority('medium');
    setShowForm(false);
  };

  if (tasks.length === 0 && !showForm) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] mb-2 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/[0.02] transition-colors"
      >
        <Loader2 size={11} className={`text-red-400 flex-shrink-0 ${running.length > 0 ? 'animate-spin' : ''}`} />
        <span className="text-gray-300 font-medium">Tasks ({tasks.length})</span>
        {running.length > 0 && (
          <span className="text-red-400 text-[10px]">({running.length} running)</span>
        )}
        {pending.length > 0 && (
          <span className="text-yellow-400 text-[10px]">({pending.length} pending)</span>
        )}
        <div className="flex-1" />
        {collapsed ? <ChevronDown size={11} className="text-gray-500" /> : <ChevronUp size={11} className="text-gray-500" />}
      </button>

      {/* Task list */}
      {!collapsed && (
        <div className="border-t border-white/5 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {sorted.map(task => {
            const cfg = statusConfig[task.status] || statusConfig.pending;
            const Icon = cfg.icon;
            return (
              <div
                key={task.id}
                className="group flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <Icon size={11} className={`${cfg.color} flex-shrink-0 ${cfg.spin ? 'animate-spin' : ''}`} />
                <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">#{task.id}</span>
                <span className="text-xs text-gray-300 truncate flex-1">{task.title}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded-full flex-shrink-0 ${priorityColors[task.priority] || priorityColors.medium}`}>
                  {task.priority}
                </span>
                {task.retries > 0 && (
                  <span className="text-[9px] text-gray-600 flex items-center gap-0.5 flex-shrink-0">
                    <RotateCcw size={7} />
                    {task.retries}
                  </span>
                )}
                {(task.status === 'running' || task.status === 'completed' || task.status === 'failed') && (
                  <span className="text-[10px] text-gray-600 flex-shrink-0">{elapsed(task)}</span>
                )}
                {task.status !== 'running' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                    className="p-0.5 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete task"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Task button / form */}
          {isConnected && !showForm && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowForm(true); }}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-colors"
            >
              <Plus size={10} />
              Add Task
            </button>
          )}

          {showForm && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-white/5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="flex-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-gray-200 placeholder-gray-600 focus:border-red-500/30 focus:outline-none"
                autoFocus
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as JarvisTaskPriority)}
                className="px-1.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-gray-400 focus:outline-none"
              >
                <option value="high">High</option>
                <option value="medium">Med</option>
                <option value="low">Low</option>
              </select>
              <button
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="px-2 py-1 rounded-md text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40"
              >
                <Plus size={10} />
              </button>
              <button
                onClick={() => { setShowForm(false); setTitle(''); }}
                className="px-1 py-1 rounded-md text-[10px] text-gray-500 hover:text-gray-300 transition-all"
              >
                <XCircle size={10} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
