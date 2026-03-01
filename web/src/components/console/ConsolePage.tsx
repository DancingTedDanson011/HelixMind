'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import { useCliOutput } from '@/hooks/use-cli-output';
import { InstanceCard } from '@/components/cli/InstanceCard';
import { SessionList } from '@/components/cli/SessionList';
import { SessionDetail } from '@/components/cli/SessionDetail';
import { CommandPanel } from '@/components/cli/CommandPanel';
import { FindingsPanel } from '@/components/cli/FindingsPanel';
import { BugJournalPanel } from '@/components/cli/BugJournalPanel';
import { BrowserPreview } from '@/components/cli/BrowserPreview';
import { ConnectionStatusBar } from '@/components/cli/ConnectionStatusBar';
import { TokenDialog } from '@/components/cli/TokenDialog';
import { Terminal, RefreshCw, AlertCircle } from 'lucide-react';
import type { DiscoveredInstance } from '@/lib/cli-types';

/* ─── Animation ──────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ─── Component ──────────────────────────────── */

export function ConsolePage() {
  const t = useTranslations('console');
  const tCli = useTranslations('cli');

  // ── State ───────────────────────────────────────

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<DiscoveredInstance | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const connectAfterRenderRef = useRef(false);

  // ── Hooks ───────────────────────────────────────

  const discovery = useCliDiscovery();

  const connection = useCliConnection({
    mode: 'local',
    port: pendingInstance?.port,
    token: authToken,
  });

  const output = useCliOutput({
    connection,
    sessionId: selectedSessionId,
  });

  // ── Auto-connect after state settles ──────────

  useEffect(() => {
    if (connectAfterRenderRef.current) {
      connectAfterRenderRef.current = false;
      connection.connect();
    }
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
    if (instance.token) {
      setAuthToken(instance.token);
      connection.disconnect();
      connectAfterRenderRef.current = true;
    } else {
      setTokenDialogOpen(true);
    }
  }, [connection]);

  const handleTokenSubmit = useCallback(
    (token: string, remember: boolean) => {
      setTokenDialogOpen(false);
      setAuthToken(token);
      if (remember && pendingInstance) {
        try {
          sessionStorage.setItem(`hx-token-${pendingInstance.port}`, token);
        } catch { /* ignore */ }
      }
      connection.disconnect();
      connectAfterRenderRef.current = true;
    },
    [pendingInstance, connection],
  );

  const handleDisconnect = useCallback(() => {
    connection.disconnect();
    setSelectedSessionId(null);
  }, [connection]);

  const handleAbortSession = useCallback(
    (id: string) => { connection.abortSession(id).catch(() => {}); },
    [connection],
  );

  const handleStartAuto = useCallback(
    (goal?: string) => { connection.startAuto(goal).catch(() => {}); },
    [connection],
  );

  const handleStartSecurity = useCallback(
    () => { connection.startSecurity().catch(() => {}); },
    [connection],
  );

  const handleStopAll = useCallback(() => {
    for (const session of connection.sessions) {
      if (session.status === 'running') {
        connection.abortSession(session.id).catch(() => {});
      }
    }
  }, [connection]);

  const handleSendChat = useCallback(
    (text: string) => { connection.sendChat(text).catch(() => {}); },
    [connection],
  );

  // ── Render: Connected → Chat/Session View ─────

  if (isConnected) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
          </div>
        </motion.div>

        {/* Connection status */}
        <motion.div variants={item}>
          <ConnectionStatusBar
            connectionState={connection.connectionState}
            instanceMeta={connection.instanceMeta}
            error={connection.error}
            onDisconnect={handleDisconnect}
          />
        </motion.div>

        {/* Main content */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Instance + Sessions + Commands */}
          <div className="lg:col-span-4 space-y-4">
            {connection.instanceMeta && (
              <InstanceCard
                instance={{ instanceId: connection.instanceMeta.instanceId, meta: connection.instanceMeta }}
                connected
                onConnect={() => {}}
                onDisconnect={handleDisconnect}
              />
            )}
            <SessionList
              sessions={connection.sessions}
              selectedId={selectedSessionId}
              onSelect={setSelectedSessionId}
              onAbort={handleAbortSession}
            />
            <CommandPanel
              onStartAuto={handleStartAuto}
              onStartSecurity={handleStartSecurity}
              onStopAll={handleStopAll}
              onSendChat={handleSendChat}
              disabled={false}
            />
          </div>

          {/* Right: Session Detail + Panels */}
          <div className="lg:col-span-8 space-y-4">
            <SessionDetail
              session={selectedSession}
              outputLines={output.lines}
              onAbort={handleAbortSession}
            />
            {connection.findings.length > 0 && (
              <FindingsPanel findings={connection.findings} />
            )}
            {connection.bugs.length > 0 && (
              <BugJournalPanel bugs={connection.bugs} />
            )}
            {connection.lastScreenshot && (
              <BrowserPreview screenshot={connection.lastScreenshot} />
            )}
          </div>
        </motion.div>

        <TokenDialog
          open={tokenDialogOpen}
          onClose={() => setTokenDialogOpen(false)}
          onSubmit={handleTokenSubmit}
          tokenHint={pendingInstance?.tokenHint}
        />
      </motion.div>
    );
  }

  // ── Render: Disconnected → Instance Tiles ─────

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Terminal size={20} className="text-primary" />
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        </div>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </motion.div>

      {/* Error banner */}
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

      {/* Instance tiles or empty state */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
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
            {tCli('rescan')}
          </Button>
        </div>

        {discovery.instances.length === 0 && !discovery.scanning ? (
          <GlassPanel intensity="subtle" className="p-12 text-center">
            <Terminal size={32} className="text-gray-600 mx-auto mb-4" />
            <p className="text-sm text-gray-400">{t('noInstances')}</p>
            <p className="text-xs text-gray-600 mt-2">{t('noInstancesHint')}</p>
          </GlassPanel>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discovery.instances.map((inst) => (
              <InstanceCard
                key={inst.port}
                instance={inst}
                connected={false}
                onConnect={() => handleConnectClick(inst)}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </motion.div>

      <TokenDialog
        open={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSubmit={handleTokenSubmit}
        tokenHint={pendingInstance?.tokenHint}
      />
    </motion.div>
  );
}
