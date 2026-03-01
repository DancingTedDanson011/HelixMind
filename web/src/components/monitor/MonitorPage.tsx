'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import { InstanceCard } from '@/components/cli/InstanceCard';
import type { ConnectionMode, DiscoveredInstance } from '@/lib/cli-types';
import { MonitorDashboard } from './MonitorDashboard';
import { RefreshCw, Shield } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function MonitorPageClient() {
  const t = useTranslations('monitor');
  const [connectionMode] = useState<ConnectionMode>('local');
  const [selectedPort, setSelectedPort] = useState<number | undefined>();
  const [authToken, setAuthToken] = useState<string | undefined>();
  const connectPendingRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);

  const { instances, scanning, scan: rescan } = useCliDiscovery();

  const connection = useCliConnection({
    mode: connectionMode,
    port: selectedPort,
    token: authToken,
  });

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

  // Connect after React state has settled
  useEffect(() => {
    if (connectPendingRef.current) {
      connectPendingRef.current = false;
      connection.connect();
    }
  });

  // Auto-connect to first discovered instance
  useEffect(() => {
    if (
      !hasAutoConnectedRef.current &&
      instances.length > 0 &&
      connection.connectionState === 'disconnected'
    ) {
      hasAutoConnectedRef.current = true;
      const inst = instances[0];
      setSelectedPort(inst.port);
      setAuthToken(inst.token || undefined);
      connectPendingRef.current = true;
    }
  }, [instances, connection.connectionState]);

  // Manual connect via InstanceCard
  const handleConnect = useCallback((instance: DiscoveredInstance) => {
    hasAutoConnectedRef.current = true;
    connection.disconnect();
    setSelectedPort(instance.port);
    setAuthToken(instance.token || undefined);
    connectPendingRef.current = true;
  }, [connection]);

  const handleDisconnect = useCallback(() => {
    connection.disconnect();
  }, [connection]);

  // Not connected — show instance tiles
  if (!isConnected && !isConnecting) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Shield size={20} className="text-primary" />
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </motion.div>

        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">
              {scanning
                ? t('scanning')
                : `${instances.length} ${t('instancesFound')}`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={rescan}
              loading={scanning}
            >
              <RefreshCw size={12} />
              {t('actions.rescan')}
            </Button>
          </div>

          {instances.length === 0 && !scanning ? (
            <GlassPanel intensity="subtle" className="p-12 text-center">
              <Shield size={32} className="text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-400">{t('noInstances')}</p>
              <p className="text-xs text-gray-600 mt-2">{t('noInstancesHint')}</p>
            </GlassPanel>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {instances.map((inst) => (
                <InstanceCard
                  key={inst.port}
                  instance={inst}
                  connected={false}
                  onConnect={() => handleConnect(inst)}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Shield size={20} className="text-primary" />
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-cyan-400">
            <RefreshCw size={14} className="animate-spin" />
            {t('scanning')}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return <MonitorDashboard connection={connection} />;
}
