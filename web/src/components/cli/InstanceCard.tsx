'use client';

import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Monitor,
  FolderOpen,
  Cpu,
  Clock,
  Plug,
  Unplug,
} from 'lucide-react';
import type { DiscoveredInstance, InstanceMeta } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface InstanceCardProps {
  instance: DiscoveredInstance | { instanceId: string; meta: InstanceMeta };
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

/* ─── Helpers ─────────────────────────────────── */

function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  const parts = path.split(/[/\\]/);
  if (parts.length <= 3) return path;
  return `${parts[0]}/.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ─── Component ───────────────────────────────── */

export function InstanceCard({ instance, connected, onConnect, onDisconnect }: InstanceCardProps) {
  const t = useTranslations('cli');

  const meta = instance.meta;
  const port = 'port' in instance ? instance.port : null;

  return (
    <GlassPanel className="p-4 space-y-3">
      {/* Header row: project name + status dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Monitor size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-white truncate max-w-[200px]">
            {meta.projectName}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {port !== null && (
            <Badge variant="default" className="text-[10px] font-mono">
              :{port}
            </Badge>
          )}
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected
                ? 'bg-success shadow-[0_0_6px_rgba(0,255,136,0.5)]'
                : 'bg-gray-600'
            }`}
          />
        </div>
      </div>

      {/* Meta details */}
      <div className="space-y-1.5 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <FolderOpen size={12} className="text-gray-500 flex-shrink-0" />
          <span className="truncate font-mono" title={meta.projectPath}>
            {truncatePath(meta.projectPath)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-gray-500 flex-shrink-0" />
          <span>
            {meta.model}
            <span className="text-gray-600 ml-1">({meta.provider})</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-gray-500 flex-shrink-0" />
          <span>{t('uptime')}: {formatUptime(meta.uptime)}</span>
        </div>
      </div>

      {/* Connect / Disconnect */}
      <div className="pt-1">
        {connected ? (
          <Button variant="danger" size="sm" className="w-full" onClick={onDisconnect}>
            <Unplug size={14} />
            {t('disconnect')}
          </Button>
        ) : (
          <Button variant="primary" size="sm" className="w-full" onClick={onConnect}>
            <Plug size={14} />
            {t('connect')}
          </Button>
        )}
      </div>
    </GlassPanel>
  );
}
