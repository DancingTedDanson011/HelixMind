'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCliDiscovery } from '@/hooks/use-cli-discovery';
import { useCliConnection } from '@/hooks/use-cli-connection';
import { InstanceCard } from '@/components/cli/InstanceCard';
import { TokenDialog } from '@/components/cli/TokenDialog';
import {
  Terminal,
  RefreshCw,
  AlertCircle,
  Zap,
  Shield,
  StopCircle,
  Unplug,
  Cpu,
  FolderOpen,
  MessageSquare,
  Clock,
  Activity,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import type { DiscoveredInstance, SessionInfo, SessionStatus } from '@/lib/cli-types';

/* ─── Animation ──────────────────────────────── */

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

/* ─── Session helpers ────────────────────────── */

const statusBadgeVariant: Record<SessionStatus, 'primary' | 'success' | 'error' | 'default' | 'warning'> = {
  running: 'primary',
  done: 'success',
  error: 'error',
  idle: 'default',
  paused: 'warning',
};

function sessionIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('security') || lower.includes('audit')) return Shield;
  if (lower.includes('auto')) return Zap;
  if (lower.includes('monitor')) return Activity;
  return MessageSquare;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/* ─── Component ──────────────────────────────── */

export function ConsolePage() {
  const t = useTranslations('console');
  const tCli = useTranslations('cli');

  // ── State ───────────────────────────────────────

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<DiscoveredInstance | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [confirmAction, setConfirmAction] = useState<'disconnect' | 'stopAll' | null>(null);
  const connectAfterRenderRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);

  // ── Hooks ───────────────────────────────────────

  const discovery = useCliDiscovery();

  const connection = useCliConnection({
    mode: 'local',
    port: pendingInstance?.port,
    token: authToken,
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

  // ── Fetch sessions when connected ──

  useEffect(() => {
    if (connection.connectionState === 'connected') {
      connection.listSessions().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.connectionState]);

  // ── Derived ─────────────────────────────────────

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

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
    hasAutoConnectedRef.current = true;
    connection.disconnect();
  }, [connection]);

  const handleStopAll = useCallback(() => {
    for (const s of connection.sessions) {
      if (s.status === 'running') connection.abortSession(s.id).catch(() => {});
    }
  }, [connection]);

  const handleAbortSession = useCallback(
    (id: string) => { connection.abortSession(id).catch(() => {}); },
    [connection],
  );

  // ── Render: Connected — Control Panel ─────────

  if (isConnected) {
    const meta = connection.instanceMeta;
    const hasRunningSessions = connection.sessions.some(s => s.status === 'running');

    return (
      <motion.div variants={fadeIn} initial="hidden" animate="show" className="space-y-4">
        {/* ── Connection bar ── */}
        <GlassPanel className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,136,0.5)]" />
              <div>
                <span className="text-sm font-medium text-white">{meta?.projectName || 'CLI'}</span>
                {meta && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Cpu size={10} />
                      {meta.model}
                    </span>
                    <span className="text-gray-700">·</span>
                    <span className="flex items-center gap-1">
                      <FolderOpen size={10} />
                      {meta.projectPath.split(/[/\\]/).slice(-2).join('/')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasRunningSessions && (
                <Button variant="danger" size="sm" onClick={() => setConfirmAction('stopAll')}>
                  <StopCircle size={12} />
                  {tCli('stopAll')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction('disconnect')}>
                <Unplug size={12} />
                {tCli('disconnect')}
              </Button>
            </div>
          </div>
        </GlassPanel>

        {/* ── Confirmation ── */}
        {confirmAction && (
          <GlassPanel className="px-4 py-3 border-warning/20 bg-warning/[0.03]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-warning">
                {confirmAction === 'disconnect'
                  ? tCli('confirmDisconnect')
                  : tCli('confirmStopAll')}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                  {tCli('cancel')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirmAction === 'disconnect') handleDisconnect();
                    else handleStopAll();
                    setConfirmAction(null);
                  }}
                >
                  {tCli('confirm')}
                </Button>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* ── Actions ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => { connection.startAuto().catch(() => {}); }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-cyan-500/5 border border-white/5 hover:border-cyan-500/15 transition-all group"
          >
            <Zap size={16} className="text-cyan-400" />
            <span className="text-sm text-gray-300 group-hover:text-white">{tCli('startAuto')}</span>
          </button>
          <button
            onClick={() => { connection.startSecurity().catch(() => {}); }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-amber-500/5 border border-white/5 hover:border-amber-500/15 transition-all group"
          >
            <Shield size={16} className="text-amber-400" />
            <span className="text-sm text-gray-300 group-hover:text-white">{tCli('startSecurity')}</span>
          </button>
        </div>

        {/* ── Sessions ── */}
        {connection.sessions.length > 0 && (
          <GlassPanel className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {tCli('sessions')} ({connection.sessions.length})
              </h3>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {connection.sessions.map((session: SessionInfo) => {
                const Icon = sessionIcon(session.name);
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/5">
                      <Icon size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">{session.name}</span>
                        <Badge variant={statusBadgeVariant[session.status]} className="text-[10px]">
                          {session.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                        <Clock size={10} />
                        <span>{formatElapsed(session.elapsed)}</span>
                        {session.result && (
                          <>
                            <span className="mx-1 text-gray-700">·</span>
                            <span>{session.result.stepsCount} steps</span>
                            {session.result.errorsCount > 0 && (
                              <span className="text-error ml-1">{session.result.errorsCount} errors</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/app?tab=console&session=${session.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      >
                        <MessageSquare size={12} />
                        Chat
                      </Link>
                      {session.status === 'running' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleAbortSession(session.id)}
                        >
                          <StopCircle size={12} />
                          {tCli('abort')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        )}

        {/* ── Empty sessions ── */}
        {connection.sessions.length === 0 && (
          <GlassPanel intensity="subtle" className="p-8 text-center">
            <Terminal size={24} className="text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{tCli('noSessions')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('useActionsHint')}</p>
          </GlassPanel>
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

  // ── Render: Disconnected / Connecting ────────

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="space-y-6">
      {/* Header — stable layout */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Terminal size={20} className="text-primary" />
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        </div>
        <div className="h-6 flex items-center justify-center">
          {isConnecting ? (
            <span className="flex items-center gap-2 text-sm text-cyan-400">
              <RefreshCw size={14} className="animate-spin" />
              {tCli('connecting')}
            </span>
          ) : discovery.scanning ? (
            <span className="flex items-center gap-2 text-sm text-cyan-400">
              <RefreshCw size={14} className="animate-spin" />
              {t('scanning')}
            </span>
          ) : (
            <p className="text-sm text-gray-500">{t('subtitle')}</p>
          )}
        </div>
      </div>

      {connection.error && (
        <GlassPanel className="p-3 border-error/20 bg-error/[0.03]">
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle size={14} />
            <span>{connection.error}</span>
          </div>
        </GlassPanel>
      )}

      <div className="min-h-[200px]">
        {discovery.instances.length === 0 && !discovery.scanning && !isConnecting ? (
          <GlassPanel intensity="subtle" className="p-12 text-center">
            <Terminal size={32} className="text-gray-600 mx-auto mb-4" />
            <p className="text-sm text-gray-400">{t('noInstances')}</p>
            <p className="text-xs text-gray-600 mt-2">{t('noInstancesHint')}</p>
            <Button variant="ghost" size="sm" onClick={discovery.scan} className="mt-4">
              <RefreshCw size={12} />
              {tCli('rescan')}
            </Button>
          </GlassPanel>
        ) : discovery.instances.length > 0 ? (
          <>
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
          </>
        ) : null}
      </div>

      <TokenDialog
        open={tokenDialogOpen}
        onClose={() => setTokenDialogOpen(false)}
        onSubmit={handleTokenSubmit}
        tokenHint={pendingInstance?.tokenHint}
      />
    </motion.div>
  );
}
