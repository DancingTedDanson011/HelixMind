'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { ConnectionState, InstanceMeta } from '@/lib/cli-types';

interface ConnectionStatusBarProps {
  connectionState: ConnectionState;
  instanceMeta: InstanceMeta | null;
  error: string | null;
  onDisconnect: () => void;
}

export function ConnectionStatusBar({
  connectionState,
  instanceMeta,
  error,
  onDisconnect,
}: ConnectionStatusBarProps) {
  const t = useTranslations('cli');

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting' || connectionState === 'authenticating';

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <Badge
        variant={isConnected ? 'success' : error ? 'error' : 'default'}
      >
        {isConnected ? (
          <span className="flex items-center gap-1.5">
            <Wifi size={10} /> {t('connected')}
          </span>
        ) : isConnecting ? (
          <span className="flex items-center gap-1.5">
            <RefreshCw size={10} className="animate-spin" /> {t('connecting')}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <WifiOff size={10} /> {t('disconnected')}
          </span>
        )}
      </Badge>

      {isConnected && instanceMeta && (
        <>
          <span className="text-xs text-gray-500">
            {instanceMeta.projectName || 'Unknown'} — {instanceMeta.model || 'N/A'}
          </span>
          <Button variant="ghost" size="sm" onClick={onDisconnect}>
            {t('disconnect')}
          </Button>
        </>
      )}

      {error && (
        <span className="text-xs text-error">{error}</span>
      )}
    </div>
  );
}
