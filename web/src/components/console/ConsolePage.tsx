'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  MessageSquare,
  Clock,
} from 'lucide-react';
import type { DiscoveredInstance, SessionInfo, SessionStatus } from '@/lib/cli-types';

/* ─── Types ──────────────────────────────────── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/* ─── Animation ──────────────────────────────── */

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

/* ─── Session sidebar helpers ────────────────── */

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

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<DiscoveredInstance | null>(null);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [confirmAction, setConfirmAction] = useState<'disconnect' | 'stopAll' | null>(null);
  const connectAfterRenderRef = useRef(false);
  const hasAutoConnectedRef = useRef(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const processedLinesRef = useRef(0);

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

  // ── Track output lines → chat messages ──

  useEffect(() => {
    const newCount = output.lines.length;
    if (newCount > processedLinesRef.current) {
      const newLines = output.lines.slice(processedLinesRef.current);
      processedLinesRef.current = newCount;

      const content = newLines.join('\n');
      if (content.trim()) {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + '\n' + content },
            ];
          }
          return [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content,
            timestamp: Date.now(),
          }];
        });
      }
    }
  }, [output.lines]);

  // ── Reset chat when session changes ──

  useEffect(() => {
    setChatMessages([]);
    processedLinesRef.current = 0;
  }, [selectedSessionId]);

  // ── Auto-scroll chat ──

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
    setSelectedSessionId(null);
    setChatMessages([]);
    processedLinesRef.current = 0;
  }, [connection]);

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: chatText.trim(),
        timestamp: Date.now(),
      }]);
      connection.sendChat(chatText.trim()).catch(() => {});
      setChatText('');
    }
  }, [chatText, connection]);

  const handleAbortSession = useCallback(
    (id: string) => { connection.abortSession(id).catch(() => {}); },
    [connection],
  );

  // ── Render: Connected — Chat Layout ─────────

  if (isConnected) {
    const meta = connection.instanceMeta;
    const hasRunningSessions = connection.sessions.some(s => s.status === 'running');

    return (
      <motion.div variants={fadeIn} initial="hidden" animate="show" className="flex flex-col h-[calc(100vh-120px)]">
        {/* ── Connection bar ── */}
        <GlassPanel className="px-4 py-2 flex-shrink-0">
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
            <div className="flex items-center gap-1.5">
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

        {/* ── Confirmation dialog ── */}
        {confirmAction && (
          <GlassPanel className="px-4 py-3 flex-shrink-0 border-warning/20 bg-warning/[0.03]">
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
                    if (confirmAction === 'disconnect') {
                      handleDisconnect();
                    } else {
                      for (const s of connection.sessions) {
                        if (s.status === 'running') connection.abortSession(s.id).catch(() => {});
                      }
                    }
                    setConfirmAction(null);
                  }}
                >
                  {tCli('confirm')}
                </Button>
              </div>
            </div>
          </GlassPanel>
        )}

        {/* ── Main: Sidebar + Chat ── */}
        <div className="flex gap-3 flex-1 min-h-0 mt-3">

          {/* ── Left sidebar: Sessions ── */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-2">
            <GlassPanel className="flex-1 overflow-hidden flex flex-col">
              <div className="px-3 py-2.5 border-b border-white/5">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {tCli('sessions')}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto">
                {connection.sessions.length === 0 ? (
                  <div className="p-4 text-center">
                    <MessageSquare size={16} className="text-gray-600 mx-auto mb-1" />
                    <p className="text-[11px] text-gray-600">{tCli('noSessions')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {connection.sessions.map((session: SessionInfo) => {
                      const isSelected = session.id === selectedSessionId;
                      const Icon = sessionIcon(session.name);

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`
                            w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all
                            ${isSelected
                              ? 'bg-primary/5 border-l-2 border-primary'
                              : 'border-l-2 border-transparent hover:bg-white/[0.02]'
                            }
                          `}
                        >
                          <div className={`
                            w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                            ${isSelected ? 'bg-primary/10' : 'bg-white/[0.03]'}
                          `}>
                            <Icon size={12} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-white font-medium truncate">
                                {session.name}
                              </span>
                              <Badge variant={statusBadgeVariant[session.status]} className="text-[9px] px-1 py-0">
                                {session.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-600">
                              <Clock size={8} />
                              <span>{formatElapsed(session.elapsed)}</span>
                            </div>
                          </div>
                          {session.status === 'running' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAbortSession(session.id); }}
                              className="text-error/60 hover:text-error p-0.5"
                            >
                              <StopCircle size={12} />
                            </button>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Quick actions ── */}
              <div className="p-2 border-t border-white/5 space-y-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-[11px] justify-start"
                  onClick={() => { connection.startAuto().catch(() => {}); }}
                >
                  <Zap size={11} />
                  {tCli('startAuto')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-[11px] justify-start"
                  onClick={() => { connection.startSecurity().catch(() => {}); }}
                >
                  <Shield size={11} />
                  {tCli('startSecurity')}
                </Button>
                {hasRunningSessions && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full text-[11px] justify-start"
                    onClick={() => {
                      for (const s of connection.sessions) {
                        if (s.status === 'running') connection.abortSession(s.id).catch(() => {});
                      }
                    }}
                  >
                    <StopCircle size={11} />
                    {tCli('stopAll')}
                  </Button>
                )}
              </div>
            </GlassPanel>
          </div>

          {/* ── Right: Chat area ── */}
          <div className="flex-1 flex flex-col min-w-0">
            <GlassPanel className="flex-1 flex flex-col overflow-hidden">

              {/* ── Chat messages ── */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <MessageSquare size={28} className="text-gray-700 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{tCli('chatPlaceholder')}</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`
                          max-w-[85%] rounded-xl px-3.5 py-2.5
                          ${msg.role === 'user'
                            ? 'bg-primary/15 border border-primary/20 text-white'
                            : 'bg-white/[0.03] border border-white/5 text-gray-300'
                          }
                        `}
                      >
                        {msg.role === 'assistant' ? (
                          <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-5">
                            {msg.content}
                          </pre>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary/40 text-right' : 'text-gray-600'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* ── Chat input ── */}
              <div className="p-3 border-t border-white/5">
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <Input
                    ref={chatInputRef}
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder={tCli('chatPlaceholder')}
                    className="flex-1"
                  />
                  {hasRunningSessions && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="px-2"
                      onClick={() => setConfirmAction('stopAll')}
                      title={tCli('stopAll')}
                    >
                      <StopCircle size={14} />
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!chatText.trim()}
                    className="px-3"
                  >
                    <SendHorizontal size={14} />
                  </Button>
                </form>
              </div>
            </GlassPanel>
          </div>
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

  // ── Render: Disconnected / Connecting ────────

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="space-y-6">
      {/* Header — always present, stable */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Terminal size={20} className="text-primary" />
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        </div>
        {/* Status line — fixed height to prevent layout shift */}
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

      {/* Error banner */}
      {connection.error && (
        <GlassPanel className="p-3 border-error/20 bg-error/[0.03]">
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle size={14} />
            <span>{connection.error}</span>
          </div>
        </GlassPanel>
      )}

      {/* Instance tiles or empty state — stable container */}
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
