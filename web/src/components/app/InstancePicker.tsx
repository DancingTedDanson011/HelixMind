'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCliContext } from './CliConnectionProvider';
import {
  X, Terminal, Cpu, Clock, Plug, Shield, ShieldOff, AlertTriangle,
} from 'lucide-react';
import type { DiscoveredInstance } from '@/lib/cli-types';

interface InstancePickerProps {
  open: boolean;
  onClose: () => void;
  onConnect: (instance: DiscoveredInstance, mode: 'normal' | 'skip-permissions') => void;
}

export function InstancePicker({ open, onClose, onConnect }: InstancePickerProps) {
  const t = useTranslations('app');
  const { instances, scanning, rescan, connection } = useCliContext();
  const [selectedMode, setSelectedMode] = useState<'normal' | 'skip-permissions'>('normal');

  if (!open) return null;

  const isAlreadyConnected = connection.connectionState === 'connected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plug size={15} className="text-cyan-400" />
            {t('instancePicker')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-5 py-3 border-b border-white/5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-2">Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedMode('normal')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                selectedMode === 'normal'
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Shield size={12} />
              {t('modeNormal')}
            </button>
            <button
              onClick={() => setSelectedMode('skip-permissions')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                selectedMode === 'skip-permissions'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <ShieldOff size={12} />
              Skip Permissions
            </button>
          </div>
          {selectedMode === 'skip-permissions' && (
            <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400/80">{t('skipPermissionsWarning')}</p>
            </div>
          )}
        </div>

        {/* Instance list */}
        <div className="px-5 py-3 max-h-[300px] overflow-y-auto">
          {instances.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Terminal size={28} className="mx-auto text-gray-700" />
              <p className="text-xs text-gray-500">{t('noInstances')}</p>
              <button
                onClick={rescan}
                disabled={scanning}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {scanning ? 'Scanning...' : 'Scan again'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => (
                <button
                  key={inst.port}
                  onClick={() => onConnect(inst, selectedMode)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-cyan-500/5 border border-white/5 hover:border-cyan-500/15 transition-all group text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Terminal size={16} className="text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors truncate">
                      {inst.meta.projectName}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Cpu size={9} /> {inst.meta.model}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock size={9} /> Port {inst.port}
                      </span>
                    </div>
                  </div>
                  <Plug size={14} className="text-gray-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                </button>
              ))}

              {isAlreadyConnected && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] text-gray-600 mb-1">
                    Already connected — selecting a new instance will reconnect.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
