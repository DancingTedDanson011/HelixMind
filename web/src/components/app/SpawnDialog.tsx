'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, FolderOpen, Loader2, Terminal, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SpawnDialogProps {
  open: boolean;
  onClose: () => void;
  onSpawned: (port: number) => void;
}

export function SpawnDialog({ open, onClose, onSpawned }: SpawnDialogProps) {
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
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium">Project Directory</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={directory}
                  onChange={(e) => setDirectory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !spawning) handleSpawn(); }}
                  placeholder="/path/to/project"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 transition-colors"
                  autoFocus
                  disabled={spawning}
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-600">
              Starts a new HelixMind CLI agent in the specified directory
            </p>
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
        <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSpawn}
            disabled={!directory.trim() || spawning || !!spawnedPort}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {spawning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Terminal size={12} />
                Start Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
