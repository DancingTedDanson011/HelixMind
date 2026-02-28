'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChatSidebar } from './ChatSidebar';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { InstancePicker } from './InstancePicker';
import { useCliContext } from './CliConnectionProvider';
import { useCliOutput } from '@/hooks/use-cli-output';
import { useBrainstormChat } from '@/hooks/use-brainstorm-chat';
import { TerminalViewer } from '@/components/cli/TerminalViewer';
import type { DiscoveredInstance } from '@/lib/cli-types';
import {
  Brain, PanelLeftClose, PanelLeft, Menu,
  Wifi, WifiOff, RefreshCw, Terminal,
  Cpu, Clock, Plug, Shield, Zap, Sparkles,
  AlertTriangle, Activity, X, MessageSquare,
  Eye, ShieldAlert, CheckCircle2, XCircle, Radio, FileText, Loader2,
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
  agentPrompt?: string | null;
  status: string;
  messages: ChatMessage[];
}

/* ─── Component ───────────────────────────────── */

export function AppShell() {
  const t = useTranslations('app');
  const {
    connection, chat: cliChat,
    instances, scanning, rescan, connectTo, disconnectCli,
    connectedPort,
  } = useCliContext();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatFull | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Close sidebar by default on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);
  const [mode, setMode] = useState<'normal' | 'skip-permissions'>('normal');
  const [activeTab, setActiveTab] = useState<'chat' | 'console' | 'monitor'>('chat');
  const [consoleSessionId, setConsoleSessionId] = useState<string | null>(null);
  const [showInstancePicker, setShowInstancePicker] = useState(false);
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [hasLLMKey, setHasLLMKey] = useState(false);

  const brainstormChat = useBrainstormChat();

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

  // Dual-mode: CLI chat when connected, brainstorm when not
  const activeChat$ = isConnected ? cliChat : brainstormChat;
  const isAgentRunning = activeChat$.state.isProcessing;
  const streamingContent = activeChat$.state.streamingText;

  // Track chat completion to save assistant messages
  const prevProcessingRef = useRef(false);

  // Console output — always call hook (React rules), subscribe only on console tab
  const cliOutput = useCliOutput({
    connection,
    sessionId: activeTab === 'console' ? consoleSessionId : null,
  });

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

  // ── Check for LLM key ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/llm-keys');
        if (res.ok) {
          const keys = await res.json();
          setHasLLMKey(keys.some((k: { provider: string }) => k.provider === 'anthropic'));
        }
      } catch { /* silent */ }
    })();
  }, []);

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

  // ── Brain: open in new tab ────────────────────
  const handleBrainClick = useCallback(() => {
    if (connectedPort) {
      window.open(`http://127.0.0.1:${connectedPort}`, '_blank');
    }
  }, [connectedPort]);

  // ── Auto-select first session for console ─────
  useEffect(() => {
    if (activeTab === 'console' && !consoleSessionId && connection.sessions.length > 0) {
      // Prefer a running session
      const running = connection.sessions.find(s => s.status === 'running');
      setConsoleSessionId(running?.id ?? connection.sessions[0].id);
    }
  }, [activeTab, consoleSessionId, connection.sessions]);

  // ── Open session in console ────────────────────
  const openSessionConsole = useCallback((sessionId: string) => {
    setConsoleSessionId(sessionId);
    setActiveTab('console');
  }, []);

  // ── Send message (with slash command support) ──
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const trimmed = content.trim();

    // Handle slash commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');

      switch (cmd) {
        case 'auto':
          handleStartAuto(arg || undefined);
          return;
        case 'security':
          handleStartSecurity();
          return;
        case 'monitor':
          if (arg) {
            handleStartMonitor(arg);
          }
          setActiveTab('monitor');
          return;
        case 'stop': {
          if (arg) {
            handleAbortSession(arg);
          } else {
            activeSessions.forEach(s => handleAbortSession(s.id));
          }
          return;
        }
        case 'brain':
          handleBrainClick();
          return;
        case 'console':
          setActiveTab('console');
          return;
        case 'chat':
          setActiveTab('chat');
          return;
        case 'disconnect':
          disconnectCli();
          return;
        case 'help':
          // Show help as system message in chat
          break; // fall through to send as regular message
        default:
          // Unknown slash command — send as regular message to CLI
          break;
      }
    }

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

    // Switch to chat tab when sending a message
    if (activeTab !== 'chat') {
      setActiveTab('chat');
    }

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chatId,
      role: 'user',
      content: trimmed,
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
        body: JSON.stringify({ role: 'user', content: trimmed }),
      });
    } catch { /* silent */ }

    // Send to CLI via WebSocket (with user-selected mode) or brainstorm
    if (isConnected) {
      cliChat.sendMessage(trimmed, chatId, mode);
    } else if (hasLLMKey) {
      brainstormChat.sendMessage(trimmed, chatId);
    }
  }, [activeChatId, isConnected, cliChat, brainstormChat, mode, hasLLMKey, fetchChats, loadChat, activeTab,
      handleStartAuto, handleStartSecurity, handleStartMonitor, handleAbortSession,
      handleBrainClick, activeSessions, disconnectCli]);

  // ── Save assistant message when CLI chat_complete fires ──
  useEffect(() => {
    const wasProcessing = prevProcessingRef.current;
    prevProcessingRef.current = cliChat.state.isProcessing;

    // Transition: processing -> done, with text available
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

  // ── Save assistant message when brainstorm completes ──
  const prevBrainstormRef = useRef(false);
  useEffect(() => {
    const wasProcessing = prevBrainstormRef.current;
    prevBrainstormRef.current = brainstormChat.state.isProcessing;

    if (wasProcessing && !brainstormChat.state.isProcessing && brainstormChat.state.streamingText && activeChatId) {
      const assistantContent = brainstormChat.state.streamingText;

      // Add to local messages (brainstorm API already saved to DB)
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

      fetchChats();
      brainstormChat.reset();
    }
  }, [brainstormChat.state.isProcessing, brainstormChat.state.streamingText, activeChatId, fetchChats, brainstormChat]);

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
    setActiveTab('chat');
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [loadChat]);

  // ── Stop handler ─────────────────────────────
  const handleStop = useCallback(() => {
    if (isConnected) {
      cliChat.abort();
    } else {
      brainstormChat.abort();
    }
  }, [isConnected, cliChat, brainstormChat]);

  // ── Create Agent Prompt ─────────────────────
  const handleCreatePrompt = useCallback(async () => {
    if (!activeChatId) return;
    setCreatingPrompt(true);
    try {
      const res = await fetch(`/api/chats/${activeChatId}/create-prompt`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActiveChat(prev => prev ? { ...prev, agentPrompt: data.agentPrompt, status: 'prompt_ready' } : null);
      }
    } catch { /* silent */ }
    setCreatingPrompt(false);
  }, [activeChatId]);

  // ── Edit Agent Prompt ───────────────────────
  const handleEditPrompt = useCallback(async (newPrompt: string) => {
    if (!activeChatId) return;
    try {
      await fetch(`/api/chats/${activeChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentPrompt: newPrompt }),
      });
      setActiveChat(prev => prev ? { ...prev, agentPrompt: newPrompt } : null);
    } catch { /* silent */ }
  }, [activeChatId]);

  // ── Connect Instance & Execute ──────────────
  const handleConnectAndExecute = useCallback(async (instance: DiscoveredInstance, execMode: 'normal' | 'skip-permissions') => {
    setShowInstancePicker(false);
    setMode(execMode);

    // Connect to instance
    connectTo(instance);

    // Wait for connection then send the agent prompt
    const prompt = activeChat?.agentPrompt;
    if (prompt && activeChatId) {
      // Update chat status
      try {
        await fetch(`/api/chats/${activeChatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'executing' }),
        });
        setActiveChat(prev => prev ? { ...prev, status: 'executing' } : null);
      } catch { /* silent */ }

      // Wait a bit for connection to establish, then send
      const waitForConnection = () => {
        return new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (connection.connectionState === 'connected') {
              clearInterval(check);
              resolve();
            }
          }, 200);
          // Timeout after 10s
          setTimeout(() => { clearInterval(check); resolve(); }, 10000);
        });
      };

      await waitForConnection();

      // Send agent prompt as chat message
      const userMsg: ChatMessage = {
        id: `agent-prompt-${Date.now()}`,
        chatId: activeChatId,
        role: 'user',
        content: prompt,
        metadata: { isAgentPrompt: true },
        createdAt: new Date().toISOString(),
      };

      setActiveChat(prev => prev ? {
        ...prev,
        messages: [...prev.messages, userMsg],
      } : null);

      // Save to DB
      try {
        await fetch(`/api/chats/${activeChatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'user', content: prompt, metadata: { isAgentPrompt: true } }),
        });
      } catch { /* silent */ }

      // Send to CLI
      cliChat.sendMessage(prompt, activeChatId, execMode);
    }
  }, [activeChat?.agentPrompt, activeChatId, connectTo, connection.connectionState, cliChat]);

  // ── Format uptime ────────────────────────────
  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

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
              {/* Active sessions — clickable to open console */}
              {activeSessions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Sessions</p>
                  {activeSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => openSessionConsole(session.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.03] hover:bg-cyan-500/5 border border-white/5 hover:border-cyan-500/10 group text-left transition-all"
                    >
                      <span className="text-xs">{session.icon}</span>
                      <span className="flex-1 text-[11px] text-gray-300 truncate">{session.name}</span>
                      <Activity size={10} className="text-emerald-400 animate-pulse" />
                      <span
                        onClick={(e) => { e.stopPropagation(); handleAbortSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <X size={10} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* All sessions (completed too) */}
              {connection.sessions.filter(s => s.status !== 'running').length > 0 && (
                <div className="space-y-1">
                  {connection.sessions.filter(s => s.status !== 'running').map((session) => (
                    <button
                      key={session.id}
                      onClick={() => openSessionConsole(session.id)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.03] text-left transition-all"
                    >
                      <span className="text-xs opacity-50">{session.icon}</span>
                      <span className="flex-1 text-[10px] text-gray-500 truncate">{session.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        session.status === 'done' ? 'bg-emerald-500/5 text-emerald-500' :
                        session.status === 'error' ? 'bg-red-500/5 text-red-400' :
                        'bg-white/5 text-gray-500'
                      }`}>
                        {session.status}
                      </span>
                    </button>
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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-surface/50 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 md:p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : (
              <>
                <Menu size={20} className="md:hidden" />
                <PanelLeft size={18} className="hidden md:block" />
              </>
            )}
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-200 truncate">
              {activeTab === 'chat'
                ? (activeChat?.title || t('noMessages'))
                : (connection.sessions.find(s => s.id === consoleSessionId)?.name || 'Console')}
            </h2>

            {/* Brainstorm badge when not connected */}
            {activeTab === 'chat' && !isConnected && hasLLMKey && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Sparkles size={9} />
                {t('brainstormMode')}
              </span>
            )}

            {/* Create Agent Prompt button */}
            {activeTab === 'chat' && activeChat && !isConnected && hasLLMKey &&
              activeChat.messages.length >= 2 && !activeChat.agentPrompt && (
              <button
                onClick={handleCreatePrompt}
                disabled={creatingPrompt}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
              >
                {creatingPrompt ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <FileText size={10} />
                )}
                {creatingPrompt ? t('creatingPrompt') : t('createPrompt')}
              </button>
            )}

            {/* Prompt ready badge */}
            {activeChat?.status === 'prompt_ready' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={9} />
                {t('promptReady')}
              </span>
            )}
          </div>

          {/* Tab switcher */}
          {isConnected && (
            <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <MessageSquare size={11} />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('console')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'console'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Terminal size={11} />
                Console
                {activeSessions.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('monitor')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'monitor'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Eye size={11} />
                {t('monitorTab')}
                {(threatCount > 0 || connection.approvals.length > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                )}
              </button>
            </div>
          )}

          {/* CLI Connection badge */}
          {isConnected && connection.instanceMeta ? (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-1 text-emerald-400">
                <Wifi size={11} />
              </div>
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

          {/* Brain button — opens in new browser tab */}
          <button
            onClick={handleBrainClick}
            disabled={!connectedPort}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={connectedPort ? `${t('brain')} (127.0.0.1:${connectedPort})` : t('brain')}
          >
            <Brain size={18} />
          </button>
        </div>

        {/* Connection panel when disconnected */}
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
              <button
                key={session.id}
                onClick={() => openSessionConsole(session.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border flex-shrink-0 transition-all ${
                  consoleSessionId === session.id && activeTab === 'console'
                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-cyan-500/5 hover:border-cyan-500/10'
                }`}
              >
                <span>{session.icon}</span>
                <span>{session.name}</span>
                <Activity size={8} className="text-emerald-400 animate-pulse" />
                {session.result && (
                  <span className="text-gray-500">
                    {session.result.stepsCount} steps
                  </span>
                )}
              </button>
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

        {/* Main content — Chat, Console, or Monitor */}
        {activeTab === 'chat' ? (
          <div className="flex-1 overflow-hidden">
            <ChatView
              messages={activeChat?.messages || []}
              isAgentRunning={isAgentRunning}
              streamingContent={streamingContent}
              activeTools={isConnected ? cliChat.state.activeTools : []}
              hasChat={!!activeChat}
              agentPrompt={activeChat?.agentPrompt}
              chatStatus={activeChat?.status}
              onEditPrompt={handleEditPrompt}
              onConnectInstance={() => setShowInstancePicker(true)}
            />
          </div>
        ) : activeTab === 'console' ? (
          <>
            {/* Console session selector */}
            {connection.sessions.length > 0 && (
              <div className="flex gap-1.5 px-4 py-2 border-b border-white/5 overflow-x-auto bg-[#0a0a1a]/50">
                {connection.sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setConsoleSessionId(session.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all flex-shrink-0 border ${
                      consoleSessionId === session.id
                        ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    }`}
                  >
                    <span>{session.icon}</span>
                    <span>{session.name}</span>
                    {session.status === 'running' && (
                      <Activity size={8} className="text-emerald-400 animate-pulse" />
                    )}
                    {session.status === 'done' && (
                      <span className="text-[9px] text-emerald-500">done</span>
                    )}
                    {session.status === 'error' && (
                      <span className="text-[9px] text-red-400">error</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Terminal output */}
            <div className="flex-1 overflow-hidden">
              {consoleSessionId ? (
                <TerminalViewer lines={cliOutput.lines} fullHeight />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3 px-6">
                    <Terminal size={32} className="mx-auto text-gray-700" />
                    <p className="text-sm text-gray-500">
                      {connection.sessions.length === 0
                        ? t('consoleNoSessions')
                        : t('consoleSelectSession')}
                    </p>
                    {connection.sessions.length === 0 && (
                      <p className="text-xs text-gray-600">
                        {t('consoleHint')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ─── Monitor Tab ─── */
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="max-w-3xl mx-auto space-y-4">

              {/* Monitor status header */}
              {connection.monitorStatus ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Radio size={18} className="text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {t('monitorMode')}: <span className="text-cyan-400 capitalize">{connection.monitorStatus.mode}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('monitorUptime')}: {formatUptime(connection.monitorStatus.uptime)}
                        {' · '}{connection.monitorStatus.threatCount} {t('monitorThreats').toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => connection.stopMonitor().catch(() => {})}
                    className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    {t('monitorStop')}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-red-500/10 border border-white/5 flex items-center justify-center">
                    <Eye size={28} className="text-purple-500/50" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">{t('monitorIdle')}</p>
                    <p className="text-xs text-gray-600 mt-1">{t('monitorIdleHint')}</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => handleStartMonitor('passive')}
                      className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/20 hover:text-purple-400 transition-all"
                    >
                      <Eye size={12} className="inline mr-1.5" />
                      {t('monitorStartPassive')}
                    </button>
                    <button
                      onClick={() => handleStartMonitor('defensive')}
                      className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition-all"
                    >
                      <Shield size={12} className="inline mr-1.5" />
                      {t('monitorStartDefensive')}
                    </button>
                    <button
                      onClick={() => handleStartMonitor('active')}
                      className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all"
                    >
                      <ShieldAlert size={12} className="inline mr-1.5" />
                      {t('monitorStartActive')}
                    </button>
                  </div>
                </div>
              )}

              {/* Pending approvals */}
              {connection.approvals.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    {t('monitorApprovals')} ({connection.approvals.length})
                  </h3>
                  {connection.approvals.map((approval) => (
                    <div key={approval.id} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                      <p className="text-sm text-gray-300">{approval.action}: {approval.target}</p>
                      <p className="text-xs text-gray-500">{approval.reason}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => connection.respondApproval(approval.id, true).catch(() => {})}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                        >
                          <CheckCircle2 size={12} />
                          {t('monitorApprove')}
                        </button>
                        <button
                          onClick={() => connection.respondApproval(approval.id, false).catch(() => {})}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                          <XCircle size={12} />
                          {t('monitorDeny')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Threats */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={12} />
                  {t('monitorThreats')} ({connection.threats.length})
                </h3>
                {connection.threats.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <p className="text-xs text-gray-600">{t('monitorNoThreats')}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {connection.threats.slice().reverse().map((threat, i) => (
                      <div key={i} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300">{threat.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{threat.details}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                threat.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                threat.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                threat.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>{threat.severity}</span>
                              <span className="text-[10px] text-gray-600">{threat.source}</span>
                              <span className="text-[10px] text-gray-600">{new Date(threat.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Defenses */}
              {connection.defenses.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={12} />
                    {t('monitorDefenses')} ({connection.defenses.length})
                  </h3>
                  <div className="space-y-1.5">
                    {connection.defenses.slice().reverse().map((defense, i) => (
                      <div key={i} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300">{defense.action}: {defense.target}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{defense.reason}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {defense.autoApproved && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">auto</span>}
                              {defense.reversible && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">reversible</span>}
                              <span className="text-[10px] text-gray-600">{new Date(defense.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input — always visible */}
        <ChatInput
          onSend={sendMessage}
          isAgentRunning={isAgentRunning}
          onStop={handleStop}
          mode={mode}
          onModeChange={setMode}
          disabled={!isConnected && !hasLLMKey}
          isConnected={isConnected}
          hasLLMKey={hasLLMKey}
        />
      </div>

      {/* Instance Picker Modal */}
      <InstancePicker
        open={showInstancePicker}
        onClose={() => setShowInstancePicker(false)}
        onConnect={handleConnectAndExecute}
      />
    </div>
  );
}
