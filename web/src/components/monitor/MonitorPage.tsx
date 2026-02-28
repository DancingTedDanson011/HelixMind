'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import type { ConnectionMode, DiscoveredInstance } from '@/lib/cli-types';
import { MonitorDashboard } from './MonitorDashboard';
import { RefreshCw, Terminal, Plug } from 'lucide-react';

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

  // Manual connect
  const handleConnect = useCallback((instance: DiscoveredInstance) => {
    hasAutoConnectedRef.current = true;
    connection.disconnect();
    setSelectedPort(instance.port);
    setAuthToken(instance.token || undefined);
    connectPendingRef.current = true;
  }, [connection]);

  // Not connected yet — show discovery
  if (!isConnected && !isConnecting) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-2xl mx-auto">
        <motion.div variants={item} className="text-center">
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </motion.div>

        <motion.div variants={item}>
          <GlassPanel className="p-6">
            {scanning && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                <RefreshCw size={14} className="animate-spin" />
                {t('scanning')}
              </div>
            )}

            {instances.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 text-center mb-3">{t('connectFirst')}</p>
                {instances.map((inst) => (
                  <button
                    key={inst.port}
                    onClick={() => handleConnect(inst)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/20 text-left transition-all group"
                  >
                    <Terminal size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                        {inst.meta.projectName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {inst.meta.model} · Port {inst.port}
                      </div>
                    </div>
                    <Plug size={14} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">{t('noInstances')}</p>
                <button
                  onClick={rescan}
                  disabled={scanning}
                  className="px-4 py-2 text-sm rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {t('actions.rescan')}
                </button>
              </div>
            )}
          </GlassPanel>
        </motion.div>
      </motion.div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-2xl mx-auto">
        <motion.div variants={item} className="text-center">
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
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
