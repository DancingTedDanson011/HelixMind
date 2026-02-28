'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InstanceCard } from './InstanceCard';
import { SessionList } from './SessionList';
import { SessionDetail } from './SessionDetail';
import { CommandPanel } from './CommandPanel';
import { FindingsPanel } from './FindingsPanel';
import { Monitor, RefreshCw, WifiOff } from 'lucide-react';
import type { UseCliConnectionReturn } from '@/hooks/use-cli-connection';
import type { UseCliOutputReturn } from '@/hooks/use-cli-output';
import type { DiscoveredInstance, SessionInfo } from '@/lib/cli-types';

interface LocalConnectionViewProps {
  discovery: {
    instances: DiscoveredInstance[];
    scanning: boolean;
    scan: () => void;
  };
  connection: UseCliConnectionReturn;
  output: UseCliOutputReturn;
  selectedSessionId: string | null;
  selectedSession: SessionInfo | null;
  onConnectClick: (instance: DiscoveredInstance) => void;
  onDisconnect: () => void;
  onSelectSession: (id: string) => void;
  onAbortSession: (id: string) => void;
  onStartAuto: (goal?: string) => void;
  onStartSecurity: () => void;
  onStopAll: () => void;
  onSendChat: (text: string) => void;
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function LocalConnectionView({
  discovery,
  connection,
  output,
  selectedSessionId,
  selectedSession,
  onConnectClick,
  onDisconnect,
  onSelectSession,
  onAbortSession,
  onStartAuto,
  onStartSecurity,
  onStopAll,
  onSendChat,
}: LocalConnectionViewProps) {
  const t = useTranslations('cli');
  const isConnected = connection.connectionState === 'connected';

  // When connected → show split view with sessions
  if (isConnected) {
    return (
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-4">
          {connection.instanceMeta && (
            <InstanceCard
              instance={{
                instanceId: connection.instanceMeta.instanceId,
                meta: connection.instanceMeta,
              }}
              connected
              onConnect={() => {}}
              onDisconnect={onDisconnect}
            />
          )}

          <SessionList
            sessions={connection.sessions}
            selectedId={selectedSessionId}
            onSelect={onSelectSession}
            onAbort={onAbortSession}
          />

          <CommandPanel
            onStartAuto={onStartAuto}
            onStartSecurity={onStartSecurity}
            onStopAll={onStopAll}
            onSendChat={onSendChat}
            disabled={!isConnected}
          />
        </div>

        {/* Right column */}
        <div className="lg:col-span-8 space-y-4">
          <SessionDetail
            session={selectedSession}
            outputLines={output.lines}
            onAbort={onAbortSession}
          />

          {connection.findings.length > 0 && (
            <FindingsPanel findings={connection.findings} />
          )}
        </div>
      </motion.div>
    );
  }

  // Not connected → show instance grid
  return (
    <motion.div variants={item} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {discovery.scanning
            ? t('scanning')
            : `${discovery.instances.length} ${t('instancesFound')}`}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={discovery.scan}
          loading={discovery.scanning}
        >
          <RefreshCw size={12} />
          {t('rescan')}
        </Button>
      </div>

      {discovery.instances.length === 0 && !discovery.scanning ? (
        <GlassPanel intensity="subtle" className="p-8 text-center">
          <Monitor size={24} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('noInstances')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('noInstancesHint')}</p>
        </GlassPanel>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {discovery.instances.map((inst) => (
            <InstanceCard
              key={inst.port}
              instance={inst}
              connected={false}
              onConnect={() => onConnectClick(inst)}
              onDisconnect={onDisconnect}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
