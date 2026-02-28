'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChatSidebar } from './ChatSidebar';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { BrainOverlay } from './BrainOverlay';
import { useCliContext } from './CliConnectionProvider';
import {
  Brain, PanelLeftClose, PanelLeft,
  Wifi, WifiOff, RefreshCw, Terminal,
  Cpu, Clock, Plug, Play, Shield, Zap,
  AlertTriangle, CheckCircle2, Activity,
  X,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

export interface ChatSummary {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  messages: { content: string; createdAt: string; role: string }[];
  _count: { messages: number };
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatFull {
  id: string;
  title: string;
  mode: string;
  messages: ChatMessage[];
}

/* ─── Component ───────────────────────────────── */

export function AppShell() {
  const t = useTranslations('app');
  const {
    connection, chat: cliChat,
    instances, scanning, rescan, connectTo, disconnectCli,
  } = useCliContext();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatFull | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [brainOpen, setBrainOpen] = useState(false);
  const [mode, setMode] = useState<'normal' | 'skip-permissions'>('normal');

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';
  const isAgentRunning = cliChat.state.isProcessing;
  const streamingContent = cliChat.state.streamingText;

  // Track chat completion to save assistant messages
  const prevProcessingRef = useRef(false);

  // ── Fetch chats ─────────────────────────────
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  // ── Load chat messages ──────────────────────
  const loadChat = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data: ChatFull = await res.json();
        setActiveChat(data);
        setActiveChatId(chatId);
        setMode(data.mode as 'normal' | 'skip-permissions');
      }
    } catch { /* silent */ }
  }, []);

  // ── Create chat ─────────────────────────────
  const createChat = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const chat = await res.json();
        await fetchChats();
        await loadChat(chat.id);
      }
    } catch { /* silent */ }
  }, [mode, fetchChats, loadChat]);

  // ── Delete chat ─────────────────────────────
  const deleteChat = useCallback(async (chatId: string) => {
    try {
      await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      if (activeChatId === chatId) {
        setActiveChat(null);
        setActiveChatId(null);
      }
      await fetchChats();
    } catch { /* silent */ }
  }, [activeChatId, fetchChats]);

  // ── Rename chat ─────────────────────────────
  const renameChat = useCallback(async (chatId: string, title: string) => {
    try {
      await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      await fetchChats();
      if (activeChat?.id === chatId) {
        setActiveChat(prev => prev ? { ...prev, title } : null);
      }
    } catch { /* silent */ }
  }, [fetchChats, activeChat?.id]);

  // ── Send message ────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Auto-create chat if none selected
    let chatId = activeChatId;
    if (!chatId) {
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
        if (res.ok) {
          const newChat = await res.json();
          chatId = newChat.id;
          await fetchChats();
          await loadChat(chatId!);
        }
      } catch { return; }
    }

    if (!chatId) return;

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chatId,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    setActiveChat(prev => prev ? {
      ...prev,
      messages: [...prev.messages, userMsg],
    } : null);

    // Save user message to DB
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: content.trim() }),
      });
    } catch { /* silent */ }

    // Send to CLI via WebSocket (with user-selected mode)
    if (isConnected) {
      cliChat.sendMessage(content.trim(), chatId, mode);
    }
  }, [activeChatId, isConnected, cliChat, mode, fetchChats, loadChat]);

  // ── Save assistant message when chat_complete fires ──
  useEffect(() => {
    const wasProcessing = prevProcessingRef.current;
    prevProcessingRef.current = cliChat.state.isProcessing;

    // Transition: processing → done, with text available
    if (wasProcessing && !cliChat.state.isProcessing && cliChat.state.streamingText && activeChatId) {
      const assistantContent = cliChat.state.streamingText;

      // Add to local messages
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        chatId: activeChatId,
        role: 'assistant',
        content: assistantContent,
        createdAt: new Date().toISOString(),
      };

      setActiveChat(prev => prev ? {
        ...prev,
        messages: [...prev.messages, assistantMsg],
      } : null);

      // Persist to DB
      fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'assistant',
          content: assistantContent,
          metadata: {
            tools: cliChat.state.activeTools.map(t => ({ name: t.toolName, status: t.status })),
          },
        }),
      }).catch(() => {});

      // Refresh sidebar
      fetchChats();

      // Reset chat hook state for next round
      cliChat.reset();
    }
  }, [cliChat.state.isProcessing, cliChat.state.streamingText, activeChatId, fetchChats, cliChat]);

  // ── Auto-title after first message ──────────
  useEffect(() => {
    if (activeChat && activeChat.messages.length === 1 && activeChat.title === 'New Chat') {
      const firstMsg = activeChat.messages[0].content;
      const autoTitle = firstMsg.length > 40 ? firstMsg.slice(0, 40) + '...' : firstMsg;
      renameChat(activeChat.id, autoTitle);
    }
  }, [activeChat?.messages.length, activeChat?.id, activeChat?.title, renameChat, activeChat]);

  // ── Mobile: close sidebar on chat select ────
  const handleChatSelect = useCallback((chatId: string) => {
    loadChat(chatId);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [loadChat]);

  // ── Stop handler ─────────────────────────────
  const handleStop = useCallback(() => {
    cliChat.abort();
  }, [cliChat]);

  // ── Format uptime ────────────────────────────
  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // ── Active sessions (auto, security, monitor) ──
  const activeSessions = connection.sessions.filter(s => s.status === 'running');
  const recentFindings = connection.findings.slice(-5);
  const threatCount = connection.threats.length;

  // ── Session actions ───────────────────────────
  const handleStartAuto = useCallback((goal?: string) => {
    connection.startAuto(goal).catch(() => {});
  }, [connection]);

  const handleStartSecurity = useCallback(() => {
    connection.startSecurity().catch(() => {});
  }, [connection]);

  const handleStartMonitor = useCallback((monitorMode: string) => {
    connection.startMonitor(monitorMode).catch(() => {});
  }, [connection]);

  const handleAbortSession = useCallback((sessionId: string) => {
    connection.abortSession(sessionId).catch(() => {});
  }, [connection]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div
        className={`
          ${sidebarOpen ? 'w-72 border-r border-white/5' : 'w-0'}
          flex-shrink-0 transition-all duration-200 overflow-hidden
          md:relative absolute z-30 h-full bg-background
        `}
      >
        <div className="flex flex-col h-full">
          <ChatSidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelect={handleChatSelect}
            onCreate={createChat}
            onDelete={deleteChat}
            onRename={renameChat}
          />

          {/* Sessions & Quick Actions (bottom of sidebar) */}
          {isConnected && (
            <div className="border-t border-white/5 p-3 space-y-2 flex-shrink-0">
              {/* Active sessions */}
              {activeSessions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Sessions</p>
                  {activeSessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.03] border border-white/5 group">
                      <span className="text-xs">{session.icon}</span>
                      <span className="flex-1 text-[11px] text-gray-300 truncate">{session.name}</span>
                      <Activity size={10} className="text-emerald-400 animate-pulse" />
                      <button
                        onClick={() => handleAbortSession(session.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleStartAuto()}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] text-gray-400 bg-white/5 hover:bg-cyan-500/10 hover:text-cyan-400 border border-white/5 hover:border-cyan-500/20 transition-all"
                  title="Auto Agent"
                >
                  <Zap size={10} />
                  Auto
                </button>
                <button
                  onClick={handleStartSecurity}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] text-gray-400 bg-white/5 hover:bg-amber-500/10 hover:text-amber-400 border border-white/5 hover:border-amber-500/20 transition-all"
                  title="Security Audit"
                >
                  <Shield size={10} />
                  Security
                </button>
                <button
                  onClick={() => handleStartMonitor('passive')}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] text-gray-400 bg-white/5 hover:bg-purple-500/10 hover:text-purple-400 border border-white/5 hover:border-purple-500/20 transition-all"
                  title="Monitor"
                >
                  <Activity size={10} />
                  Monitor
                </button>
              </div>

              {/* Findings badge */}
              {recentFindings.length > 0 && (
                <div className="px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                  <p className="text-[10px] text-amber-400 font-medium">{connection.findings.length} Findings</p>
                  <p className="text-[10px] text-gray-500 truncate">{recentFindings[recentFindings.length - 1]?.finding}</p>
                </div>
              )}

              {/* Threat badge */}
              {threatCount > 0 && (
                <div className="px-2 py-1.5 rounded-md bg-red-500/5 border border-red-500/10">
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={10} className="text-red-400" />
                    <p className="text-[10px] text-red-400 font-medium">{threatCount} Threats</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-surface/50 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-200 truncate">
              {activeChat?.title || t('noMessages')}
            </h2>
          </div>

          {/* CLI Connection badge */}
          {isConnected && connection.instanceMeta ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-1 text-emerald-400">
                <Wifi size={11} />
                <span className="font-medium">{t('cliConnected')}</span>
              </div>
              <span className="text-gray-500">|</span>
              <div className="flex items-center gap-1 text-gray-400">
                <Cpu size={10} />
                <span>{connection.instanceMeta.model}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-500">
                <Clock size={10} />
                <span>{formatUptime(connection.instanceMeta.uptime)}</span>
              </div>
            </div>
          ) : isConnecting ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-cyan-400/80 bg-cyan-500/5 border border-cyan-500/10 animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              {t('connecting')}
            </div>
          ) : (
            <button
              onClick={rescan}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-gray-500 bg-white/5 border border-white/5 hover:text-gray-300 hover:border-white/10 transition-colors"
            >
              <WifiOff size={11} />
              {t('cliDisconnected')}
            </button>
          )}

          <button
            onClick={() => setBrainOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors"
            title={t('brain')}
          >
            <Brain size={18} />
          </button>
        </div>

        {/* Connection panel when disconnected (shown inline above messages) */}
        {!isConnected && !isConnecting && (
          <div className="border-b border-white/5 bg-surface/30 px-4 py-3">
            <div className="max-w-3xl mx-auto">
              {instances.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{t('connectCli')}</p>
                  <div className="flex flex-wrap gap-2">
                    {instances.map((inst) => (
                      <button
                        key={inst.port}
                        onClick={() => connectTo(inst)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/20 text-left transition-all group"
                      >
                        <Terminal size={14} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                        <div>
                          <div className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                            {inst.meta.projectName}
                          </div>
                          <div className="text-[10px] text-gray-600">
                            {inst.meta.model} · Port {inst.port}
                          </div>
                        </div>
                        <Plug size={12} className="text-gray-600 group-hover:text-cyan-400 ml-2 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <WifiOff size={12} />
                    {t('notConnected')}
                  </div>
                  <button
                    onClick={rescan}
                    disabled={scanning}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] text-gray-400 bg-white/5 hover:bg-white/10 border border-white/5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={10} className={scanning ? 'animate-spin' : ''} />
                    {scanning ? t('connecting') : 'Scan'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active sessions strip */}
        {isConnected && activeSessions.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/5 bg-surface/30 overflow-x-auto">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 flex-shrink-0"
              >
                <span>{session.icon}</span>
                <span className="text-gray-300">{session.name}</span>
                <Activity size={8} className="text-emerald-400 animate-pulse" />
                {session.result && (
                  <span className="text-gray-500">
                    {session.result.stepsCount} steps
                  </span>
                )}
              </div>
            ))}
            {connection.findings.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/5 border border-amber-500/10 flex-shrink-0">
                <AlertTriangle size={8} className="text-amber-400" />
                <span className="text-amber-400">{connection.findings.length} findings</span>
              </div>
            )}
            {threatCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/5 border border-red-500/10 flex-shrink-0">
                <Shield size={8} className="text-red-400" />
                <span className="text-red-400">{threatCount} threats</span>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ChatView
            messages={activeChat?.messages || []}
            isAgentRunning={isAgentRunning}
            streamingContent={streamingContent}
            activeTools={cliChat.state.activeTools}
            hasChat={!!activeChat}
          />
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          isAgentRunning={isAgentRunning}
          onStop={handleStop}
          mode={mode}
          onModeChange={setMode}
          disabled={false}
          isConnected={isConnected}
        />
      </div>

      {/* Brain overlay */}
      {brainOpen && <BrainOverlay onClose={() => setBrainOpen(false)} />}
    </div>
  );
}
