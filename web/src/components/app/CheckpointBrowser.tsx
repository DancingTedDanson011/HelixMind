'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  X, History, RotateCcw, FileCode, MessageSquare,
  Layers, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import type { CheckpointInfo } from '@/lib/cli-types';

/* ─── Type icon helper ────────────────────────── */

function CheckpointIcon({ type, size = 14 }: { type: string; size?: number }) {
  switch (type) {
    case 'tool': return <FileCode size={size} className="text-cyan-400" />;
    case 'chat': return <MessageSquare size={size} className="text-emerald-400" />;
    default:     return <Layers size={size} className="text-gray-400" />;
  }
}

/* ─── Relative time ───────────────────────────── */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ─── Component ───────────────────────────────── */

interface CheckpointBrowserProps {
  checkpoints: CheckpointInfo[];
  onRevert: (id: number, mode: 'chat' | 'code' | 'both') => void;
  onClose: () => void;
}

export function CheckpointBrowser({ checkpoints, onRevert, onClose }: CheckpointBrowserProps) {
  const t = useTranslations('app');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [revertMode, setRevertMode] = useState<'chat' | 'code' | 'both'>('both');

  const sorted = [...checkpoints].sort((a, b) => b.timestamp - a.timestamp);

  const handleRevert = useCallback((id: number) => {
    onRevert(id, revertMode);
    setConfirmingId(null);
  }, [onRevert, revertMode]);

  return (
    <div className="flex flex-col h-full max-h-[60vh] bg-[#0a0a14]/95 backdrop-blur-xl border-l border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <History size={16} className="text-cyan-400" />
          <h3 className="text-sm font-medium text-gray-200">{t('checkpointTitle')}</h3>
          <span className="text-[10px] text-gray-600 bg-white/5 rounded-full px-1.5 py-0.5">
            {checkpoints.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-gray-600">{t('checkpointEmpty')}</p>
          </div>
        ) : (
          <div className="py-2">
            {sorted.map((cp) => {
              const isExpanded = expandedId === cp.id;
              const isConfirming = confirmingId === cp.id;

              return (
                <div key={cp.id} className="group">
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cp.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-gray-600 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
                    )}
                    <CheckpointIcon type={cp.type} size={14} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{cp.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-600">{relativeTime(cp.timestamp)}</span>
                        <span className="text-[10px] text-gray-700 px-1 rounded bg-white/5">{cp.type}</span>
                        {cp.toolName && (
                          <span className="text-[10px] text-cyan-400/50 font-mono">{cp.toolName}</span>
                        )}
                      </div>
                    </div>
                    {cp.hasFileSnapshots && (
                      <span className="text-[10px] text-gray-600 flex-shrink-0">
                        {cp.fileCount} {cp.fileCount === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-12">
                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-center gap-3 text-gray-500">
                          <span>ID: #{cp.id}</span>
                          <span>Msg #{cp.messageIndex}</span>
                          {cp.hasFileSnapshots && <span>{cp.fileCount} file snapshots</span>}
                        </div>

                        {isConfirming ? (
                          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-2">
                            <div className="flex items-center gap-1.5 text-amber-400">
                              <AlertTriangle size={12} />
                              <span className="font-medium">{t('checkpointConfirm')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={revertMode}
                                onChange={(e) => setRevertMode(e.target.value as 'chat' | 'code' | 'both')}
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-gray-300 outline-none focus:border-cyan-500/30"
                              >
                                <option value="both">{t('checkpointModeBoth')}</option>
                                <option value="code">{t('checkpointModeCode')}</option>
                                <option value="chat">{t('checkpointModeChat')}</option>
                              </select>
                              <button
                                onClick={() => handleRevert(cp.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                              >
                                <RotateCcw size={10} />
                                {t('checkpointRevert')}
                              </button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="px-2.5 py-1 rounded-lg text-gray-500 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                              >
                                {t('cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingId(cp.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-400 bg-white/5 border border-white/10 hover:bg-red-500/5 hover:border-red-500/20 hover:text-red-400 transition-all"
                          >
                            <RotateCcw size={10} />
                            {t('checkpointRevertTo')}
                          </button>
                        )}
                      </div>
                    </div>
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
