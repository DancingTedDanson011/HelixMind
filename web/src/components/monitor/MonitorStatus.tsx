'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Shield, Search, Swords, Square, RotateCw } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import type { MonitorStatus as MonitorStatusType } from '@/lib/cli-types';

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface MonitorStatusProps {
  status: MonitorStatusType | null;
  isConnected: boolean;
  onStop: () => void;
  onRescan: () => void;
  onChangeMode: (mode: string) => void;
}

const MODE_CONFIG = {
  passive: { icon: Search, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', label: 'Passive' },
  defensive: { icon: Shield, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', label: 'Defensive' },
  active: { icon: Swords, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Active' },
} as const;

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function MonitorStatusBar({ status, isConnected, onStop, onRescan, onChangeMode }: MonitorStatusProps) {
  const t = useTranslations('monitor');
  const mode = (status?.mode || 'passive') as keyof typeof MODE_CONFIG;
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.passive;
  const ModeIcon = cfg.icon;

  return (
    <motion.div variants={item}>
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Mode badge */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.border} border`}>
              <ModeIcon size={16} className={cfg.color} />
              <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>

            {isConnected && status ? (
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{t('uptime')}: {formatUptime(status.uptime)}</span>
                <span>{t('threats.detected')}: <span className="text-red-400 font-medium">{status.threatCount}</span></span>
                <span>{t('defenses.activated')}: <span className="text-blue-400 font-medium">{status.defenseCount}</span></span>
              </div>
            ) : (
              <span className="text-sm text-gray-500">{t('status.disconnected')}</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRescan}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              title={t('actions.rescan')}
            >
              <RotateCw size={12} />
              {t('actions.rescan')}
            </button>
            <button
              onClick={onStop}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
              title={t('actions.stop')}
            >
              <Square size={12} />
              {t('actions.stop')}
            </button>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
