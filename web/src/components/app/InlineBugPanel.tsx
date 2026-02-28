'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bug, CheckCircle2, Search, Wrench, AlertTriangle,
  ChevronDown, ChevronUp, Zap, X, FileCode,
} from 'lucide-react';
import type { BugInfo, BugStatus } from '@/lib/cli-types';

interface InlineBugPanelProps {
  bugs: BugInfo[];
  isConnected: boolean;
  onFixBug: (bugId: number) => void;
  onFixAll: () => void;
  onClose: () => void;
}

const STATUS_ICON: Record<BugStatus, { icon: typeof Bug; color: string }> = {
  open: { icon: AlertTriangle, color: 'text-red-400' },
  investigating: { icon: Search, color: 'text-amber-400' },
  fixed: { icon: Wrench, color: 'text-cyan-400' },
  verified: { icon: CheckCircle2, color: 'text-emerald-400' },
};

export function InlineBugPanel({ bugs, isConnected, onFixBug, onFixAll, onClose }: InlineBugPanelProps) {
  const t = useTranslations('app');
  const [expanded, setExpanded] = useState(true);

  const openCount = bugs.filter(b => b.status === 'open').length;
  const fixedCount = bugs.filter(b => b.status === 'fixed' || b.status === 'verified').length;

  if (bugs.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl mb-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors"
        >
          <Bug size={13} className="text-red-400 flex-shrink-0" />
          <span className="text-gray-300 font-medium">
            {bugs.length} {bugs.length === 1 ? 'Bug' : 'Bugs'}
          </span>
          {openCount > 0 && (
            <span className="text-red-400 text-[10px]">({openCount} open)</span>
          )}
          {fixedCount > 0 && (
            <span className="text-emerald-400 text-[10px]">
              <CheckCircle2 size={9} className="inline mr-0.5" />
              {fixedCount}
            </span>
          )}

          {/* Progress bar */}
          <div className="flex-1 mx-2">
            <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(fixedCount / bugs.length) * 100}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isConnected && openCount > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); onFixAll(); }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all cursor-pointer"
              >
                <Zap size={8} />
                {t('bugFixAll')}
              </span>
            )}
            <span
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
            >
              <X size={12} />
            </span>
            {expanded ? <ChevronUp size={11} className="text-gray-500" /> : <ChevronDown size={11} className="text-gray-500" />}
          </div>
        </button>

        {/* Bug list */}
        {expanded && (
          <div className="border-t border-white/5 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {bugs.map(bug => {
              const { icon: StatusIcon, color } = STATUS_ICON[bug.status];
              return (
                <div
                  key={bug.id}
                  className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <StatusIcon size={11} className={`${color} flex-shrink-0`} />
                  <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">#{bug.id}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{bug.description}</span>
                  {bug.file && (
                    <span className="hidden sm:flex items-center gap-0.5 text-[9px] text-gray-600 truncate max-w-[150px] flex-shrink-0">
                      <FileCode size={8} />
                      {bug.file}{bug.line ? `:${bug.line}` : ''}
                    </span>
                  )}
                  {isConnected && bug.status === 'open' && (
                    <button
                      onClick={() => onFixBug(bug.id)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all flex-shrink-0"
                    >
                      <Wrench size={8} />
                      Fix
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
