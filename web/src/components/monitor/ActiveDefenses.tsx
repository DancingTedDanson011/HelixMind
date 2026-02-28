'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ShieldCheck, Undo2 } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import type { DefenseRecord } from '@/lib/cli-types';

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface ActiveDefensesProps {
  defenses: DefenseRecord[];
  onUndo: (defenseId: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  block_ip: 'IP Blocked',
  kill_process: 'Process Killed',
  close_port: 'Port Closed',
  rotate_secret: 'Secret Rotated',
  isolate_service: 'Service Isolated',
  deploy_honeypot: 'Honeypot Deployed',
};

function formatElapsed(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ActiveDefenses({ defenses, onUndo }: ActiveDefensesProps) {
  const t = useTranslations('monitor');

  return (
    <motion.div variants={item}>
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-300">{t('defenses.active')}</h3>
        </div>

        <div className="space-y-2">
          {defenses.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{t('defenses.noDefenses')}</p>
          ) : (
            defenses.map((defense) => (
              <div
                key={defense.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-blue-500/10"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="primary">
                    {ACTION_LABELS[defense.action] || defense.action}
                  </Badge>
                  <span className="text-sm text-gray-300 truncate">{defense.target}</span>
                  <span className="text-xs text-gray-500 shrink-0">{formatElapsed(defense.timestamp)}</span>
                </div>
                {defense.reversible && (
                  <button
                    onClick={() => onUndo(defense.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white/5 hover:bg-white/10 text-gray-400 transition-colors shrink-0 ml-2"
                    title={t('actions.undo')}
                  >
                    <Undo2 size={10} />
                    {t('actions.undo')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
