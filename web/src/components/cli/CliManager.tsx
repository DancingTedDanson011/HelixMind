'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import { useCliOutput } from '@/hooks/use-cli-output';
import { InstanceCard } from './InstanceCard';
import { TokenDialog } from './TokenDialog';
import { SessionList } from './SessionList';
import { SessionDetail } from './SessionDetail';
import { CommandPanel } from './CommandPanel';
import { FindingsPanel } from './FindingsPanel';
import {
  Monitor,
  Globe,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import type { ConnectionMode, DiscoveredInstance } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

type TabKey = 'local' | 'remote' | 'active';

interface TabDef {
  key: TabKey;
  icon: typeof Monitor;
}

/* ─── Constants ───────────────────────────────── */

const tabs: TabDef[] = [
  { key: 'local', icon: Monitor },
  { key: 'remote', icon: Globe },
  { key: 'active', icon: Activity },
];

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ─── Component ───────────────────────────────── */

export function CliManager() {
  const t = useTranslations('cli');

  // ── State ───────────────────────────────────────

  const [activeTab, setActiveTab] = useState<TabKey>('local');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<DiscoveredInstance | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('local');

  // ── Hooks ───────────────────────────────────────

  const discovery = useCliDiscovery();

  const connection = useCliConnection({
    mode: connectionMode,
    port: pendingInstance?.port,
    token: undefined, // set on connect
  });

  const output = useCliOutput({
    connection,
    sessionId: selectedSessionId,
  });

  // ── Derived ─────────────────────────────────────

  const isConnected = connection.connectionState === 'connected';

  const selectedSession = useMemo(
    () => connection.sessions.find((s) => s.id === selectedSessionId) ?? null,
    [connection.sessions, selectedSessionId],
  );

  // ── Handlers ────────────────────────────────────

  const handleConnectClick = useCallback((instance: DiscoveredInstance) => {
    setPendingInstance(instance);
    setConnectionMode('local');
    setTokenDialogOpen(true);
  }, []);

  const handleTokenSubmit = useCallback(
    (token: string, _remember: boolean) => {
      setTokenDialogOpen(false);

      if (pendingInstance) {
        // Re-create connection with the correct params by connecting
        // We need to store port & token, then trigger connect
        connection.disconnect();

        // Small delay to allow cleanup
        setTimeout(() => {
          // The hook uses params ref, so we update state then connect
          // For the connection hook, we need to reconnect with new params
          // This is handled by the hook's internal paramsRef
          connection.connect();
        }, 100);
      }
    },
    [pendingInstance, connection],
  );

  const handleDisconnect = useCallback(() => {
    connection.disconnect();
    setSelectedSessionId(null);
  }, [connection]);

  const handleSelectSession = useCallback((id: string) => {
    setSelectedSessionId(id);
  }, []);

  const handleAbortSession = useCallback(
    (id: string) => {
      connection.abortSession(id).catch(() => {
        // Error handled by connection hook
      });
    },
    [connection],
  );

  const handleStartAuto = useCallback(
    (goal?: string) => {
      connection.startAuto(goal).catch(() => {
        // Error handled by connection hook
      });
    },
    [connection],
  );

  const handleStartSecurity = useCallback(() => {
    connection.startSecurity().catch(() => {
      // Error handled by connection hook
    });
  }, [connection]);

  const handleStopAll = useCallback(() => {
    // Abort all running sessions
    for (const session of connection.sessions) {
      if (session.status === 'running') {
        connection.abortSession(session.id).catch(() => {
          // Best effort
        });
      }
    }
  }, [connection]);

  const handleSendChat = useCallback(
    (text: string) => {
      connection.sendChat(text).catch(() => {
        // Error handled by connection hook
      });
    },
    [connection],
  );

  // ── Render ──────────────────────────────────────

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Page Header ── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection state indicator */}
            <Badge
              variant={
                isConnected ? 'success' : connection.connectionState === 'error' ? 'error' : 'default'
              }
            >
              {isConnected ? (
                <span className="flex items-center gap-1.5">
                  <Wifi size={10} /> {t('connected')}
                </span>
              ) : connection.connectionState === 'connecting' || connection.connectionState === 'authenticating' ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={10} className="animate-spin" /> {t('connecting')}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <WifiOff size={10} /> {t('disconnected')}
                </span>
              )}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* ── Error Banner ── */}
      {connection.error && (
        <motion.div variants={item}>
          <GlassPanel className="p-3 border-error/20 bg-error/[0.03]">
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle size={14} />
              <span>{connection.error}</span>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <motion.div variants={item}>
        <GlassPanel className="p-1.5 inline-flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.key
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <tab.icon size={14} />
              {t(`tab_${tab.key}`)}
              {tab.key === 'local' && discovery.instances.length > 0 && (
                <Badge variant="primary" className="text-[10px] ml-1">
                  {discovery.instances.length}
                </Badge>
              )}
              {tab.key === 'active' && isConnected && connection.sessions.length > 0 && (
                <Badge variant="success" className="text-[10px] ml-1">
                  {connection.sessions.length}
                </Badge>
              )}
            </button>
          ))}
        </GlassPanel>
      </motion.div>

      {/* ── Tab Content ── */}
      <motion.div variants={item}>
        {/* ── Local Tab ── */}
        {activeTab === 'local' && (
          <div className="space-y-4">
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
                    connected={
                      isConnected &&
                      connection.instanceMeta?.instanceId === inst.meta.instanceId
                    }
                    onConnect={() => handleConnectClick(inst)}
                    onDisconnect={handleDisconnect}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Remote Tab ── */}
        {activeTab === 'remote' && (
          <GlassPanel intensity="subtle" className="p-8 text-center">
            <Globe size={24} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{t('remoteComingSoon')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('remoteComingSoonHint')}</p>
          </GlassPanel>
        )}

        {/* ── Active Tab ── */}
        {activeTab === 'active' && (
          <>
            {!isConnected ? (
              <GlassPanel intensity="subtle" className="p-8 text-center">
                <WifiOff size={24} className="text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{t('notConnected')}</p>
                <p className="text-xs text-gray-600 mt-1">{t('notConnectedHint')}</p>
              </GlassPanel>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left column: instance info, sessions, commands */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Connected instance card */}
                  {connection.instanceMeta && (
                    <InstanceCard
                      instance={{
                        instanceId: connection.instanceMeta.instanceId,
                        meta: connection.instanceMeta,
                      }}
                      connected
                      onConnect={() => {}}
                      onDisconnect={handleDisconnect}
                    />
                  )}

                  {/* Session list */}
                  <SessionList
                    sessions={connection.sessions}
                    selectedId={selectedSessionId}
                    onSelect={handleSelectSession}
                    onAbort={handleAbortSession}
                  />

                  {/* Command panel */}
                  <CommandPanel
                    onStartAuto={handleStartAuto}
                    onStartSecurity={handleStartSecurity}
                    onStopAll={handleStopAll}
                    onSendChat={handleSendChat}
                    disabled={!isConnected}
                  />
                </div>

                {/* Right column: session detail + findings */}
                <div className="lg:col-span-8 space-y-4">
                  <SessionDetail
                    session={selectedSession}
                    outputLines={output.lines}
                    onAbort={handleAbortSession}
                  />

                  {connection.findings.length > 0 && (
                    <FindingsPanel findings={connection.findings} />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* ── Token Dialog ── */}
      <TokenDialog
        open={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSubmit={handleTokenSubmit}
        tokenHint={pendingInstance?.tokenHint}
      />
    </motion.div>
  );
}
