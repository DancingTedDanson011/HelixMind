'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import { useCliOutput } from '@/hooks/use-cli-output';
import { ConnectionToggle } from './ConnectionToggle';
import { ConnectionStatusBar } from './ConnectionStatusBar';
import { LocalConnectionView } from './LocalConnectionView';
import { RelayConnectionView } from './RelayConnectionView';
import { TokenDialog } from './TokenDialog';
import { AlertCircle } from 'lucide-react';
import type { ConnectionMode, DiscoveredInstance } from '@/lib/cli-types';

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

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('local');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<DiscoveredInstance | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);

  // ── Hooks ───────────────────────────────────────

  const discovery = useCliDiscovery();

  const connection = useCliConnection({
    mode: connectionMode,
    port: pendingInstance?.port,
    token: authToken,
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

  const handleModeChange = useCallback(
    (mode: 'local' | 'relay') => {
      if (isConnected) {
        connection.disconnect();
        setSelectedSessionId(null);
      }
      setConnectionMode(mode);
    },
    [isConnected, connection],
  );

  const handleConnectClick = useCallback((instance: DiscoveredInstance) => {
    setPendingInstance(instance);
    setConnectionMode('local');
    setTokenDialogOpen(true);
  }, []);

  const handleRelayConnect = useCallback(() => {
    setConnectionMode('relay');
    connection.connect();
  }, [connection]);

  const handleTokenSubmit = useCallback(
    (token: string, remember: boolean) => {
      setTokenDialogOpen(false);
      setAuthToken(token);

      // Store token if user wants to remember it
      if (remember && pendingInstance) {
        try {
          sessionStorage.setItem(`hx-token-${pendingInstance.port}`, token);
        } catch { /* ignore storage errors */ }
      }

      // Reconnect with the new token (needs brief delay for state to settle)
      connection.disconnect();
      setTimeout(() => {
        connection.connect();
      }, 100);
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
      connection.abortSession(id).catch(() => {});
    },
    [connection],
  );

  const handleStartAuto = useCallback(
    (goal?: string) => {
      connection.startAuto(goal).catch(() => {});
    },
    [connection],
  );

  const handleStartSecurity = useCallback(() => {
    connection.startSecurity().catch(() => {});
  }, [connection]);

  const handleStopAll = useCallback(() => {
    for (const session of connection.sessions) {
      if (session.status === 'running') {
        connection.abortSession(session.id).catch(() => {});
      }
    }
  }, [connection]);

  const handleSendChat = useCallback(
    (text: string) => {
      connection.sendChat(text).catch(() => {});
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
      {/* ── Title ── */}
      <motion.div variants={item} className="text-center">
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      </motion.div>

      {/* ── Connection Toggle ── */}
      <motion.div variants={item}>
        <ConnectionToggle mode={connectionMode} onModeChange={handleModeChange} />
      </motion.div>

      {/* ── Connection Status Bar ── */}
      <motion.div variants={item}>
        <ConnectionStatusBar
          connectionState={connection.connectionState}
          instanceMeta={connection.instanceMeta}
          error={connection.error}
          onDisconnect={handleDisconnect}
        />
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

      {/* ── Mode Content ── */}
      {connectionMode === 'local' ? (
        <LocalConnectionView
          discovery={discovery}
          connection={connection}
          output={output}
          selectedSessionId={selectedSessionId}
          selectedSession={selectedSession}
          onConnectClick={handleConnectClick}
          onDisconnect={handleDisconnect}
          onSelectSession={handleSelectSession}
          onAbortSession={handleAbortSession}
          onStartAuto={handleStartAuto}
          onStartSecurity={handleStartSecurity}
          onStopAll={handleStopAll}
          onSendChat={handleSendChat}
        />
      ) : (
        <RelayConnectionView
          connection={connection}
          output={output}
          selectedSessionId={selectedSessionId}
          selectedSession={selectedSession}
          onConnect={handleRelayConnect}
          onDisconnect={handleDisconnect}
          onSelectSession={handleSelectSession}
          onAbortSession={handleAbortSession}
          onStartAuto={handleStartAuto}
          onStartSecurity={handleStartSecurity}
          onStopAll={handleStopAll}
          onSendChat={handleSendChat}
        />
      )}

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
