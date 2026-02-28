'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bug, CheckCircle2, Search, Wrench, AlertTriangle,
  ChevronDown, ChevronUp, Zap, X, FileCode,
} from 'lucide-react';
import type { BugInfo, BugStatus } from '@/lib/cli-types';

interface BugJournalProps {
  bugs: BugInfo[];
  isConnected: boolean;
  onFixBug: (bugId: number) => void;
  onFixAll: () => void;
  onClose: () => void;
}

const STATUS_CONFIG: Record<BugStatus, { icon: typeof Bug; color: string; bg: string; label: string }> = {
  open: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Open' },
  investigating: { icon: Search, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Investigating' },
  fixed: { icon: Wrench, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', label: 'Fixed' },
  verified: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Verified' },
};

export function BugJournal({ bugs, isConnected, onFixBug, onFixAll, onClose }: BugJournalProps) {
  const t = useTranslations('app');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | BugStatus>('all');

  const filtered = filter === 'all' ? bugs : bugs.filter(b => b.status === filter);
  const openCount = bugs.filter(b => b.status === 'open').length;
  const investigatingCount = bugs.filter(b => b.status === 'investigating').length;
  const fixedCount = bugs.filter(b => b.status === 'fixed' || b.status === 'verified').length;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-amber-500/20 border border-white/10 flex items-center justify-center">
            <Bug size={16} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-200">{t('bugJournal')}</h3>
            <p className="text-[10px] text-gray-500">
              {openCount} {t('bugOpen')} · {investigatingCount} {t('bugInvestigating')} · {fixedCount} {t('bugFixed')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && openCount > 0 && (
            <button
              onClick={onFixAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
            >
              <Zap size={10} />
              {t('bugFixAll')}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/5 overflow-x-auto">
        {(['all', 'open', 'investigating', 'fixed', 'verified'] as const).map(f => {
          const count = f === 'all' ? bugs.length : bugs.filter(b => b.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all flex-shrink-0 border ${
                filter === f
                  ? 'bg-white/10 border-white/15 text-white'
                  : 'bg-white/[0.03] border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {f === 'all' ? t('bugFilterAll') : STATUS_CONFIG[f].label}
              <span className="text-[9px] text-gray-600">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Bug list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-emerald-500/40" />
            </div>
            <p className="text-sm text-gray-400">{t('bugNoBugs')}</p>
            <p className="text-[10px] text-gray-600 mt-1">{t('bugNoBugsHint')}</p>
          </div>
        ) : (
          filtered.map(bug => {
            const config = STATUS_CONFIG[bug.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedId === bug.id;

            return (
              <div
                key={bug.id}
                className={`rounded-xl border transition-all ${config.bg}`}
              >
                {/* Bug header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : bug.id)}
                  className="w-full flex items-start gap-2.5 p-3 text-left"
                >
                  <StatusIcon size={14} className={`${config.color} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 leading-snug">{bug.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
                        #{bug.id} · {config.label}
                      </span>
                      {bug.file && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500 truncate max-w-[200px]">
                          <FileCode size={9} />
                          {bug.file}{bug.line ? `:${bug.line}` : ''}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-600">{formatDate(bug.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isConnected && bug.status === 'open' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onFixBug(bug.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                      >
                        <Wrench size={9} />
                        Fix
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/5 ml-6">
                    {bug.fixDescription && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('bugFixDescription')}</p>
                        <p className="text-xs text-gray-300">{bug.fixDescription}</p>
                      </div>
                    )}
                    {bug.fixedAt && (
                      <p className="text-[10px] text-gray-500">
                        {t('bugFixedAt')}: {formatDate(bug.fixedAt)}
                      </p>
                    )}
                    {bug.updatedAt !== bug.createdAt && (
                      <p className="text-[10px] text-gray-500">
                        {t('bugUpdatedAt')}: {formatDate(bug.updatedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-surface/30">
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: bugs.length > 0 ? `${(fixedCount / bugs.length) * 100}%` : '0%',
                  background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500">
              {fixedCount}/{bugs.length}
            </span>
          </div>
        </div>
        {!isConnected && openCount > 0 && (
          <p className="text-[10px] text-gray-600">{t('bugConnectToFix')}</p>
        )}
      </div>
    </div>
  );
}
