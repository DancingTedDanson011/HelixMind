'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, FolderOpen, Loader2, Terminal, CheckCircle2, AlertTriangle, Plug, Cpu } from 'lucide-react';
import type { DiscoveredInstance } from '@/lib/cli-types';

interface SpawnDialogProps {
  open: boolean;
  onClose: () => void;
  onSpawned: (port: number) => void;
  instances?: DiscoveredInstance[];
  onConnect?: (instance: DiscoveredInstance) => void;
}

export function SpawnDialog({ open, onClose, onSpawned, instances = [], onConnect }: SpawnDialogProps) {
  const t = useTranslations('app');
  const [directory, setDirectory] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spawnedPort, setSpawnedPort] = useState<number | null>(null);

  const handleSpawn = async () => {
    if (!directory.trim()) return;
    setSpawning(true);
    setError(null);
    setSpawnedPort(null);

    try {
      const res = await fetch('/api/cli/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: directory.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Spawn failed' }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { port } = await res.json();
      setSpawnedPort(port);

      // Auto-connect after short delay for CLI to boot
      setTimeout(() => {
        onSpawned(port);
        onClose();
        setDirectory('');
        setSpawnedPort(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spawn failed');
    } finally {
      setSpawning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-surface border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-cyan-400" />
            <h3 className="text-sm font-medium text-white">Spawn Agent</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Active Instances */}
          {instances.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">{t('activeInstances')}</label>
              <div className="space-y-1.5">
                {instances.map((inst) => (
                  <button
                    key={inst.port}
                    onClick={() => onConnect?.(inst)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/20 text-left transition-all group"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-300 group-hover:text-white truncate">
                        {inst.meta.projectName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                        <Cpu size={9} />
                        <span>{inst.meta.model}</span>
                        <span className="text-gray-700">·</span>
                        <span>:{inst.port}</span>
                      </div>
                    </div>
                    <Plug size={12} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Separator */}
          {instances.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-gray-600">{t('orSeparator')}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          )}

          {/* Start New Agent */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium">{t('startNewAgent')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={directory}
                  onChange={(e) => setDirectory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !spawning) handleSpawn(); }}
                  placeholder="/path/to/project"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 transition-colors"
                  autoFocus={instances.length === 0}
                  disabled={spawning}
                />
              </div>
              <button
                onClick={handleSpawn}
                disabled={!directory.trim() || spawning || !!spawnedPort}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {spawning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Terminal size={12} />
                )}
                Start
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Success */}
          {spawnedPort && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-400">
                Agent started on port {spawnedPort} — connecting...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
