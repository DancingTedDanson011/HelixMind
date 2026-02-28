'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { InstanceCard } from './InstanceCard';
import { SessionList } from './SessionList';
import { SessionDetail } from './SessionDetail';
import { CommandPanel } from './CommandPanel';
import { FindingsPanel } from './FindingsPanel';
import { Globe, WifiOff } from 'lucide-react';
import type { UseCliConnectionReturn } from '@/hooks/use-cli-connection';
import type { UseCliOutputReturn } from '@/hooks/use-cli-output';
import type { SessionInfo } from '@/lib/cli-types';

interface RelayConnectionViewProps {
  connection: UseCliConnectionReturn;
  output: UseCliOutputReturn;
  selectedSessionId: string | null;
  selectedSession: SessionInfo | null;
  onConnect: () => void;
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

export function RelayConnectionView({
  connection,
  output,
  selectedSessionId,
  selectedSession,
  onConnect,
  onDisconnect,
  onSelectSession,
  onAbortSession,
  onStartAuto,
  onStartSecurity,
  onStopAll,
  onSendChat,
}: RelayConnectionViewProps) {
  const t = useTranslations('cli');
  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

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

  // Not connected → relay connect UI
  return (
    <motion.div variants={item}>
      <GlassPanel intensity="subtle" className="p-8 text-center">
        <Globe size={28} className="text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">{t('mode_remote')}</h3>
        <p className="text-sm text-gray-400 mb-1">{t('relay_instructions')}</p>
        <p className="text-xs text-gray-600 mb-6">{t('remoteComingSoonHint')}</p>
        <Button
          onClick={onConnect}
          loading={isConnecting}
          disabled={isConnecting}
        >
          <Globe size={14} />
          {t('relay_connect')}
        </Button>
      </GlassPanel>
    </motion.div>
  );
}
