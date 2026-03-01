'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import { useCliOutput } from '@/hooks/use-cli-output';
import { InstanceCard } from '@/components/cli/InstanceCard';
import { SessionList } from '@/components/cli/SessionList';
import { TerminalViewer } from '@/components/cli/TerminalViewer';
import { FindingsPanel } from '@/components/cli/FindingsPanel';
import { BugJournalPanel } from '@/components/cli/BugJournalPanel';
import { BrowserPreview } from '@/components/cli/BrowserPreview';
import { TokenDialog } from '@/components/cli/TokenDialog';
import {
  Terminal,
  RefreshCw,
  AlertCircle,
  SendHorizontal,
  Zap,
  Shield,
  StopCircle,
  Unplug,
  Cpu,
  FolderOpen,
} from 'lucide-react';
import type { DiscoveredInstance } from '@/lib/cli-types';

/* ─── Animation ──────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
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
  const [chatText, setChatText] = useState('');
  const [autoGoal, setAutoGoal] = useState('');
  const connectAfterRenderRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

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

  // ── Auto-connect to first discovered instance ──

  useEffect(() => {
    if (
      !hasAutoConnectedRef.current &&
      discovery.instances.length > 0 &&
      connection.connectionState === 'disconnected'
    ) {
      hasAutoConnectedRef.current = true;
      const inst = discovery.instances[0];
      setPendingInstance(inst);
      setAuthToken(inst.token || undefined);
      connectAfterRenderRef.current = true;
    }
  }, [discovery.instances, connection.connectionState]);

  // ── Fetch sessions + data when connected ──

  useEffect(() => {
    if (connection.connectionState === 'connected') {
      connection.listSessions().catch(() => {});
      connection.getFindings().catch(() => {});
      connection.getBugs().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.connectionState]);

  // ── Auto-select first session when connected ──

  useEffect(() => {
    if (connection.connectionState === 'connected' && connection.sessions.length > 0 && !selectedSessionId) {
      // Pick first running session, or first session
      const running = connection.sessions.find(s => s.status === 'running');
      setSelectedSessionId(running?.id || connection.sessions[0].id);
    }
  }, [connection.connectionState, connection.sessions, selectedSessionId]);

  // ── Focus chat input when connected ──

  useEffect(() => {
    if (connection.connectionState === 'connected') {
      setTimeout(() => chatInputRef.current?.focus(), 300);
    }
  }, [connection.connectionState]);

  // ── Derived ─────────────────────────────────────

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

  const selectedSession = useMemo(
    () => connection.sessions.find((s) => s.id === selectedSessionId) ?? null,
    [connection.sessions, selectedSessionId],
  );

  // ── Handlers ────────────────────────────────────

  const handleConnectClick = useCallback((instance: DiscoveredInstance) => {
    hasAutoConnectedRef.current = true;
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
        try { sessionStorage.setItem(`hx-token-${pendingInstance.port}`, token); } catch { /* */ }
      }
      connection.disconnect();
      connectAfterRenderRef.current = true;
    },
    [pendingInstance, connection],
  );

  const handleDisconnect = useCallback(() => {
    hasAutoConnectedRef.current = true; // Don't auto-reconnect after manual disconnect
    connection.disconnect();
    setSelectedSessionId(null);
  }, [connection]);

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      connection.sendChat(chatText.trim()).catch(() => {});
      setChatText('');
    }
  }, [chatText, connection]);

  const handleStartAuto = useCallback(() => {
    connection.startAuto(autoGoal.trim() || undefined).catch(() => {});
    setAutoGoal('');
  }, [autoGoal, connection]);

  const handleAbortSession = useCallback(
    (id: string) => { connection.abortSession(id).catch(() => {}); },
    [connection],
  );

  const handleStopAll = useCallback(() => {
    for (const session of connection.sessions) {
      if (session.status === 'running') {
        connection.abortSession(session.id).catch(() => {});
      }
    }
  }, [connection]);

  // ── Render: Connected ─────────────────────────

  if (isConnected) {
    const meta = connection.instanceMeta;
    const hasRunningSessions = connection.sessions.some(s => s.status === 'running');

    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {/* ── Compact connection bar ── */}
        <motion.div variants={item}>
          <GlassPanel className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_rgba(0,255,136,0.5)]" />
                <span className="text-sm font-medium text-white">{meta?.projectName}</span>
                {meta && (
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    <Cpu size={10} className="inline mr-1" />
                    {meta.model}
                    <span className="mx-1.5 text-gray-700">·</span>
                    <FolderOpen size={10} className="inline mr-1" />
                    {meta.projectPath.split(/[/\\]/).slice(-2).join('/')}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                <Unplug size={12} />
                {tCli('disconnect')}
              </Button>
            </div>
          </GlassPanel>
        </motion.div>

        {/* ── Chat Input — ALWAYS VISIBLE ── */}
        <motion.div variants={item}>
          <GlassPanel className="p-4">
            <form onSubmit={handleSendChat} className="flex gap-2">
              <Input
                ref={chatInputRef}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder={tCli('chatPlaceholder')}
                className="flex-1 text-base"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!chatText.trim()}
                className="px-4"
              >
                <SendHorizontal size={16} />
              </Button>
            </form>

            {/* Quick actions */}
            <div className="flex gap-2 mt-3">
              <div className="flex gap-2 flex-1">
                <Input
                  value={autoGoal}
                  onChange={(e) => setAutoGoal(e.target.value)}
                  placeholder={tCli('autoGoalPlaceholder')}
                  className="flex-1 text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleStartAuto(); } }}
                />
                <Button variant="secondary" size="sm" onClick={handleStartAuto} className="flex-shrink-0 text-xs">
                  <Zap size={12} />
                  {tCli('startAuto')}
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={() => connection.startSecurity().catch(() => {})} className="flex-shrink-0 text-xs">
                <Shield size={12} />
              </Button>
              {hasRunningSessions && (
                <Button variant="danger" size="sm" onClick={handleStopAll} className="flex-shrink-0 text-xs">
                  <StopCircle size={12} />
                </Button>
              )}
            </div>
          </GlassPanel>
        </motion.div>

        {/* ── Main area: Terminal + Sidebar ── */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Terminal output — main area */}
          <div className="lg:col-span-8 space-y-4">
            {selectedSession ? (
              <>
                {/* Session header */}
                <GlassPanel className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{selectedSession.icon}</span>
                      <span className="text-sm font-medium text-white">{selectedSession.name}</span>
                      <Badge variant={selectedSession.status === 'running' ? 'primary' : selectedSession.status === 'done' ? 'success' : selectedSession.status === 'error' ? 'error' : 'default'}>
                        {selectedSession.status}
                      </Badge>
                    </div>
                    {selectedSession.status === 'running' && (
                      <Button variant="danger" size="sm" onClick={() => handleAbortSession(selectedSession.id)}>
                        <StopCircle size={12} />
                        {tCli('abort')}
                      </Button>
                    )}
                  </div>
                </GlassPanel>

                {/* Terminal */}
                <TerminalViewer lines={output.lines} />

                {/* Result */}
                {(selectedSession.status === 'done' || selectedSession.status === 'error') && selectedSession.result && (
                  <GlassPanel
                    intensity="subtle"
                    className={`p-3 border ${selectedSession.status === 'error' ? 'border-error/20 bg-error/[0.03]' : 'border-success/20 bg-success/[0.03]'}`}
                  >
                    <p className="text-xs text-gray-400 break-words">{selectedSession.result.text}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span>{selectedSession.result.stepsCount} {tCli('steps')}</span>
                      {selectedSession.result.errorsCount > 0 && (
                        <span className="text-error">{selectedSession.result.errorsCount} {tCli('errors')}</span>
                      )}
                    </div>
                  </GlassPanel>
                )}
              </>
            ) : (
              <GlassPanel intensity="subtle" className="p-8 text-center">
                <Terminal size={24} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">{tCli('noOutput')}</p>
              </GlassPanel>
            )}

            {/* Findings + Bugs inline */}
            {connection.findings.length > 0 && <FindingsPanel findings={connection.findings} />}
            {connection.bugs.length > 0 && <BugJournalPanel bugs={connection.bugs} />}
            {connection.lastScreenshot && <BrowserPreview screenshot={connection.lastScreenshot} />}
          </div>

          {/* Sidebar: Session list */}
          <div className="lg:col-span-4">
            <SessionList
              sessions={connection.sessions}
              selectedId={selectedSessionId}
              onSelect={setSelectedSessionId}
              onAbort={handleAbortSession}
            />
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

  // ── Render: Connecting ────────────────────────

  if (isConnecting) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Terminal size={20} className="text-primary" />
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-cyan-400">
            <RefreshCw size={14} className="animate-spin" />
            {tCli('connecting')}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ── Render: Disconnected — Instance Tiles ─────

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

      {/* Scanning indicator */}
      {discovery.scanning && (
        <motion.div variants={item} className="flex items-center justify-center gap-2 text-sm text-cyan-400">
          <RefreshCw size={14} className="animate-spin" />
          {t('scanning')}
        </motion.div>
      )}

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

      {/* Empty state when no instances */}
      {discovery.instances.length === 0 && !discovery.scanning && (
        <motion.div variants={item}>
          <GlassPanel intensity="subtle" className="p-12 text-center">
            <Terminal size={32} className="text-gray-600 mx-auto mb-4" />
            <p className="text-sm text-gray-400">{t('noInstances')}</p>
            <p className="text-xs text-gray-600 mt-2">{t('noInstancesHint')}</p>
            <Button variant="ghost" size="sm" onClick={discovery.scan} className="mt-4">
              <RefreshCw size={12} />
              {tCli('rescan')}
            </Button>
          </GlassPanel>
        </motion.div>
      )}

      {/* Instance tiles (shown only when multiple or auto-connect failed) */}
      {discovery.instances.length > 0 && !discovery.scanning && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400">
              {discovery.instances.length} {t('instancesFound')}
            </p>
            <Button variant="ghost" size="sm" onClick={discovery.scan}>
              <RefreshCw size={12} />
              {tCli('rescan')}
            </Button>
          </div>
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
        </motion.div>
      )}

      <TokenDialog
        open={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSubmit={handleTokenSubmit}
        tokenHint={pendingInstance?.tokenHint}
      />
    </motion.div>
  );
}
