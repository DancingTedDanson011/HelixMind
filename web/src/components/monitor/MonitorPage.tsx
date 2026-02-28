'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import type { ConnectionMode, DiscoveredInstance } from '@/lib/cli-types';
import { MonitorDashboard } from './MonitorDashboard';

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
  const [pendingInstance, setPendingInstance] = useState<DiscoveredInstance | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const connectAfterRenderRef = useRef(false);

  const { instances, scanning, scan: rescan } = useCliDiscovery();

  const connection = useCliConnection({
    mode: connectionMode,
    port: pendingInstance?.port,
    token: authToken,
  });

  const isConnected = connection.connectionState === 'connected';

  // Connect after React state has settled
  useEffect(() => {
    if (connectAfterRenderRef.current) {
      connectAfterRenderRef.current = false;
      connection.connect();
    }
  });

  // Auto-connect with discovered token
  const handleConnect = useCallback((instance: DiscoveredInstance) => {
    setPendingInstance(instance);
    setAuthToken(instance.token || undefined);
    connection.disconnect();
    connectAfterRenderRef.current = true;
  }, [connection]);

  // Not connected yet — show discovery
  if (!isConnected) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-2xl mx-auto">
        <motion.div variants={item} className="text-center">
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
        </motion.div>

        <motion.div variants={item}>
          <GlassPanel className="p-6 text-center">
            <p className="text-gray-400 mb-4">{t('connectFirst')}</p>

            {scanning && <p className="text-sm text-gray-500">{t('scanning')}</p>}

            {instances.length > 0 ? (
              <div className="space-y-2">
                {instances.map((inst) => (
                  <button
                    key={inst.port}
                    onClick={() => handleConnect(inst)}
                    className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-200">{inst.meta.projectName}</div>
                    <div className="text-xs text-gray-500">Port {inst.port} &middot; {inst.meta.model}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">{t('noInstances')}</p>
                <button
                  onClick={rescan}
                  className="px-4 py-2 text-sm rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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

  return <MonitorDashboard connection={connection} />;
}
