'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChatSidebar } from './ChatSidebar';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { InstancePicker } from './InstancePicker';
import { SpawnDialog } from './SpawnDialog';
import { useCliContext } from './CliConnectionProvider';
import { useCliOutput } from '@/hooks/use-cli-output';
import { useBrainstormChat } from '@/hooks/use-brainstorm-chat';
import { TerminalViewer } from '@/components/cli/TerminalViewer';
import { SessionSidebar } from './SessionSidebar';
// BugJournal tab removed — bugs now shown inline in ChatView
import type { DiscoveredInstance } from '@/lib/cli-types';
import {
  Brain, PanelLeftClose, PanelLeft, Menu, ChevronDown,
  Wifi, WifiOff, RefreshCw, Terminal, Plus,
  Cpu, Clock, Plug, Shield, Zap,
  AlertTriangle, Activity, X, MessageSquare,
  Eye, ShieldAlert, CheckCircle2, XCircle, Radio, FileText, Loader2,
  Bug, Bot, Search, ListChecks, ShieldCheck,
} from 'lucide-react';
import { JarvisPanel } from '@/components/jarvis/JarvisPanel';
import { TabInfoPage } from './TabInfoPage';

/* ─── Tab color scheme ──────────────────────── */

const TAB_COLORS = {
  chat:    { active: 'bg-cyan-500/15 text-cyan-400',    inactive: 'text-cyan-400/40 hover:text-cyan-400/70',    dot: 'bg-cyan-400' },
  console: { active: 'bg-emerald-500/15 text-emerald-400', inactive: 'text-emerald-400/40 hover:text-emerald-400/70', dot: 'bg-emerald-400' },
  monitor: { active: 'bg-purple-500/15 text-purple-400',  inactive: 'text-purple-400/40 hover:text-purple-400/70',  dot: 'bg-purple-400' },
  jarvis:  { active: 'bg-fuchsia-500/15 text-fuchsia-400', inactive: 'text-fuchsia-400/40 hover:text-fuchsia-400/70', dot: 'bg-fuchsia-400' },
} as const;

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

/* ─── Session tab assignment helper ──────────── */

function getSessionTab(name: string): 'console' | 'monitor' | 'jarvis' {
  const lower = name.toLowerCase();
  if (lower.includes('monitor')) return 'monitor';
  if (lower.includes('jarvis')) return 'jarvis';
  return 'console'; // auto, security, etc. → Console
}

/* ─── Session icon helper ────────────────────── */

function SessionIcon({ name, size = 12, className = '' }: { name: string; size?: number; className?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('security') || lower.includes('audit')) return <Shield size={size} className={className} />;
  if (lower.includes('auto')) return <Zap size={size} className={className} />;
  if (lower.includes('monitor')) return <Activity size={size} className={className} />;
  if (lower.includes('jarvis')) return <Bot size={size} className={className} />;
  return <MessageSquare size={size} className={className} />;
}

/* ─── Component ───────────────────────────────── */

interface AppShellProps {
  initialTab?: string;
  initialSession?: string;
}

export function AppShell({ initialTab, initialSession }: AppShellProps = {}) {
  const t = useTranslations('app');
  const {
    connection, chat: cliChat,
    instances, scanning, rescan, connectTo, disconnectCli,
    connectedPort, registerOnComplete,
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
  const [activeTab, setActiveTab] = useState<'chat' | 'console' | 'monitor' | 'jarvis'>(
    (initialTab === 'console' || initialTab === 'monitor' || initialTab === 'jarvis') ? initialTab as any : 'chat'
  );
  const [consoleSessionId, setConsoleSessionId] = useState<string | null>(initialSession || null);
  const [showInstancePicker, setShowInstancePicker] = useState(false);
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);
  const [showBugPanel, setShowBugPanel] = useState(false);
  const [showConnectPopover, setShowConnectPopover] = useState(false);
  const connectPopoverRef = useRef<HTMLDivElement>(null);
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [hasLLMKey, setHasLLMKey] = useState(false);
  const [pendingExecPrompt, setPendingExecPrompt] = useState<{ prompt: string; chatId: string; mode: 'normal' | 'skip-permissions' } | null>(null);

  const brainstormChat = useBrainstormChat();

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

  // CLI execution state (only when user confirms prompt execution)
  const [cliExecuting, setCliExecuting] = useState(false);

  // Chat ALWAYS uses brainstorm; CLI only for on-demand execution
  const isAgentRunning = brainstormChat.state.isProcessing || cliExecuting;
  const streamingContent = brainstormChat.state.streamingText || (cliExecuting ? cliChat.state.streamingText : '');

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

  // ── Close connect popover on outside click ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (connectPopoverRef.current && !connectPopoverRef.current.contains(e.target as Node)) {
        setShowConnectPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Auto-create or select chat on CLI connect ─────────
  useEffect(() => {
    if (!isConnected) return;
    if (chats.length === 0 && !activeChatId) {
      createChat();
    } else if (!activeChatId && chats.length > 0) {
      // Select most recent chat so user doesn't need to press New Chat
      loadChat(chats[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // ── Auto-detect mode on CLI connect ──────────
  const hasAutoDetectedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasAutoDetectedRef.current) return;
    hasAutoDetectedRef.current = true;

    // Fetch Jarvis status to check if daemon is running
    connection.getJarvisStatus().then(() => {
      // Navigate to Jarvis tab if daemon is running
      if (connection.jarvisStatus?.daemonState === 'running') {
        setActiveTab('jarvis');
        return;
      }
    }).catch(() => {});
    connection.listJarvisTasks().catch(() => {});

    // Check active sessions and navigate to appropriate tab
    const runningSessions = connection.sessions.filter(s => s.status === 'running' && s.id !== 'main');
    if (runningSessions.length > 0) {
      const firstSession = runningSessions[0];
      const tab = getSessionTab(firstSession.name);
      setActiveTab(tab);
      if (tab === 'console') setConsoleSessionId(firstSession.id);
      if (tab === 'monitor') setMonitorSessionId(firstSession.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Reset auto-detect flag on disconnect
  useEffect(() => {
    if (!isConnected) hasAutoDetectedRef.current = false;
  }, [isConnected]);

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

  // ── Active sessions (auto, security, monitor) — exclude main "Chat" session ──
  const activeSessions = connection.sessions.filter(s => s.status === 'running' && s.id !== 'main');
  const threatCount = connection.threats.length;

  // ── Sessions filtered by tab type ──
  const consoleSessions = connection.sessions.filter(s => s.id !== 'main' && getSessionTab(s.name) === 'console');
  const monitorSessions = connection.sessions.filter(s => s.id !== 'main' && getSessionTab(s.name) === 'monitor');
  const jarvisSessions = connection.sessions.filter(s => s.id !== 'main' && getSessionTab(s.name) === 'jarvis');

  // ── Selected session IDs for sidebar tabs ──
  const [monitorSessionId, setMonitorSessionId] = useState<string | null>(null);

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

  // ── Brain: open in popup window ───────────────
  const handleBrainClick = useCallback(() => {
    window.open('/brain.html', 'helix-brain', 'width=1200,height=800,menubar=no,toolbar=no');
  }, []);

  // ── Auto-select first console-type session for console tab ─────
  useEffect(() => {
    if (activeTab === 'console' && !consoleSessionId) {
      if (consoleSessions.length > 0) {
        const running = consoleSessions.find(s => s.status === 'running');
        setConsoleSessionId(running?.id ?? consoleSessions[0].id);
      }
    }
  }, [activeTab, consoleSessionId, consoleSessions]);

  // ── Open session in correct tab ────────────────
  const openSessionInTab = useCallback((sessionId: string) => {
    const session = connection.sessions.find(s => s.id === sessionId);
    if (!session) return;
    const tab = getSessionTab(session.name);
    if (tab === 'monitor') {
      setMonitorSessionId(sessionId);
      setActiveTab('monitor');
    } else if (tab === 'jarvis') {
      setActiveTab('jarvis');
    } else {
      setConsoleSessionId(sessionId);
      setActiveTab('console');
    }
  }, [connection.sessions]);

  // ── Auto-switch tab when session mode changes ──
  useEffect(() => {
    if (!consoleSessionId) return;
    const session = connection.sessions.find(s => s.id === consoleSessionId);
    if (!session) return;
    const expectedTab = getSessionTab(session.name);
    if (expectedTab !== 'console' && activeTab === 'console') {
      setActiveTab(expectedTab);
      setConsoleSessionId(null);
    }
  }, [connection.sessions, consoleSessionId, activeTab]);

  // ── Auto-switch to correct tab when new session created ──
  const prevSessionCountRef = useRef(connection.sessions.length);
  useEffect(() => {
    const currentCount = connection.sessions.length;
    if (currentCount > prevSessionCountRef.current) {
      // New session added — find it (last one)
      const newSession = connection.sessions[connection.sessions.length - 1];
      if (newSession && newSession.id !== 'main') {
        const tab = getSessionTab(newSession.name);
        setActiveTab(tab);
        if (tab === 'console') setConsoleSessionId(newSession.id);
        if (tab === 'monitor') setMonitorSessionId(newSession.id);
      }
    }
    prevSessionCountRef.current = currentCount;
  }, [connection.sessions]);

  // ── Bug fix handlers ────────────────────────
  const sendBugFixMessage = useCallback(async (fixPrompt: string) => {
    if (!isConnected) return;

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

    if (activeTab !== 'chat') setActiveTab('chat');

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chatId,
      role: 'user',
      content: fixPrompt,
      createdAt: new Date().toISOString(),
    };
    setActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, userMsg] } : null);

    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: fixPrompt }),
      });
    } catch { /* silent */ }

    setCliExecuting(true);
    cliChat.sendMessage(fixPrompt, chatId, mode);
  }, [activeChatId, isConnected, cliChat, mode, fetchChats, loadChat, activeTab]);

  const handleFixBug = useCallback((bugId: number) => {
    const bug = connection.bugs.find(b => b.id === bugId);
    if (!bug) return;
    const fixPrompt = `Fix bug #${bug.id}: ${bug.description}${bug.file ? `\nFile: ${bug.file}${bug.line ? `:${bug.line}` : ''}` : ''}\n\nInvestigate the root cause, implement the fix, and verify it's resolved.`;
    sendBugFixMessage(fixPrompt);
  }, [connection.bugs, sendBugFixMessage]);

  const handleFixAllBugs = useCallback(() => {
    const openBugs = connection.bugs.filter(b => b.status === 'open');
    if (openBugs.length === 0) return;
    const bugSummary = openBugs
      .map(b => `#${b.id}: ${b.description}${b.file ? ` (${b.file}${b.line ? `:${b.line}` : ''})` : ''}`)
      .join('\n');
    const fixPrompt = `Fix ALL of the following open bugs:\n\n${bugSummary}\n\nInvestigate each bug, implement fixes, and verify they are resolved.`;
    sendBugFixMessage(fixPrompt);
  }, [connection.bugs, sendBugFixMessage]);

  // ── Fetch bugs on connect ──────────────────
  useEffect(() => {
    if (isConnected) {
      connection.getBugs().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // ── Bug notifications in chat ──────────────
  const prevBugCountRef = useRef(0);
  useEffect(() => {
    const prevCount = prevBugCountRef.current;
    const currentCount = connection.bugs.length;
    prevBugCountRef.current = currentCount;

    // New bug added
    if (currentCount > prevCount && prevCount > 0 && activeChatId && activeChat) {
      const newBug = connection.bugs[connection.bugs.length - 1];
      if (newBug) {
        const notifMsg: ChatMessage = {
          id: `bug-notif-${Date.now()}`,
          chatId: activeChatId,
          role: 'assistant',
          content: `🐛 **${t('bugNewDetected')}** #${newBug.id}: ${newBug.description}${newBug.file ? `\n📄 \`${newBug.file}${newBug.line ? `:${newBug.line}` : ''}\`` : ''}`,
          metadata: { isBugNotification: true },
          createdAt: new Date().toISOString(),
        };
        setActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, notifMsg] } : null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.bugs.length]);

  // ── Add local system message to chat ───────────
  const addSystemMessage = useCallback((content: string) => {
    if (!activeChat) return;
    const sysMsg: ChatMessage = {
      id: `system-${Date.now()}`,
      chatId: activeChat.id,
      role: 'assistant',
      content,
      metadata: { isSystemMessage: true },
      createdAt: new Date().toISOString(),
    };
    setActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, sysMsg] } : null);
  }, [activeChat]);

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
        case 'jarvis':
          if (arg.startsWith('task ')) {
            const taskTitle = arg.slice(5).replace(/^["']|["']$/g, '').trim();
            if (taskTitle && isConnected) {
              connection.addJarvisTask(taskTitle, '', 'medium').catch(() => {});
              addSystemMessage(`Task added: "${taskTitle}"`);
            }
          }
          setActiveTab('jarvis');
          connection.listJarvisTasks().catch(() => {});
          connection.getJarvisStatus().catch(() => {});
          return;
        case 'journal':
        case 'bugs':
          // Fetch bugs if connected, then toggle inline bug panel
          if (isConnected) {
            connection.getBugs().catch(() => {});
          }
          setActiveTab('chat');
          setShowBugPanel(prev => !prev);
          return;
        case 'bugfix': {
          // Fix all open bugs via CLI
          if (isConnected && connection.bugs.filter(b => b.status === 'open').length > 0) {
            handleFixAllBugs();
          }
          return;
        }
        case 'disconnect':
          disconnectCli();
          return;
        case 'connect': {
          if (isConnected) {
            addSystemMessage(t('alreadyConnected'));
          } else if (instances.length > 0) {
            addSystemMessage(t('connectingTo', { name: instances[0].meta.projectName }));
            connectTo(instances[0]);
          } else {
            rescan();
            addSystemMessage(t('noCliFound'));
          }
          return;
        }
        case 'help': {
          addSystemMessage(t('helpCommands'));
          return;
        }
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

    // Route to CLI agent if connected, otherwise brainstorm
    if (isConnected) {
      setCliExecuting(true);
      cliChat.sendMessage(trimmed, chatId, mode);
    } else if (hasLLMKey) {
      brainstormChat.sendMessage(trimmed, chatId);
    }
  }, [activeChatId, brainstormChat, mode, hasLLMKey, isConnected, cliChat, fetchChats, loadChat, activeTab,
      handleStartAuto, handleStartSecurity, handleStartMonitor, handleAbortSession,
      handleBrainClick, activeSessions, disconnectCli, addSystemMessage, instances, connectTo, rescan, t]);

  // ── CLI completion callback (event-based, not ref-tracking) ──
  const handleCliComplete = useCallback((text: string, tools: import('@/hooks/use-cli-chat').ActiveTool[]) => {
    if (!activeChatId) return;

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      chatId: activeChatId,
      role: 'assistant',
      content: text,
      metadata: {
        isCliExecution: true,
        tools: tools.map(t => ({ name: t.toolName, status: t.status, result: t.result })),
      },
      createdAt: new Date().toISOString(),
    };

    setActiveChat(prev => prev ? {
      ...prev,
      messages: [...prev.messages, assistantMsg],
    } : null);

    fetch(`/api/chats/${activeChatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'assistant',
        content: text,
        metadata: {
          isCliExecution: true,
          tools: tools.map(t => ({ name: t.toolName, status: t.status, result: t.result })),
        },
      }),
    }).catch(() => {});

    setCliExecuting(false);
    cliChat.reset();
    fetchChats();
  }, [activeChatId, fetchChats, cliChat]);

  // Register CLI completion callback
  useEffect(() => {
    registerOnComplete(handleCliComplete);
  }, [registerOnComplete, handleCliComplete]);

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
    if (cliExecuting) {
      cliChat.abort();
      setCliExecuting(false);
      // Also abort on CLI side
      if (isConnected) {
        connection.abortSession('main').catch(() => {});
      }
    }
    if (brainstormChat.state.isProcessing) {
      brainstormChat.abort();
    }
  }, [cliExecuting, cliChat, brainstormChat, isConnected, connection]);

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

  // ── Execute prompt directly (already connected) ──
  const handleExecutePrompt = useCallback(async (prompt: string) => {
    if (!activeChatId || !isConnected) return;

    try {
      await fetch(`/api/chats/${activeChatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'executing' }),
      });
      setActiveChat(prev => prev ? { ...prev, status: 'executing' } : null);
    } catch { /* silent */ }

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

    try {
      await fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: prompt, metadata: { isAgentPrompt: true } }),
      });
    } catch { /* silent */ }

    setCliExecuting(true);
    cliChat.sendMessage(prompt, activeChatId, mode);
  }, [activeChatId, isConnected, cliChat, mode]);

  // ── Connect Instance & Execute ──────────────
  const handleConnectAndExecute = useCallback(async (instance: DiscoveredInstance, execMode: 'normal' | 'skip-permissions') => {
    setShowInstancePicker(false);
    setMode(execMode);

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

      // Store pending prompt — will be sent when connection establishes
      setPendingExecPrompt({ prompt, chatId: activeChatId, mode: execMode });
    }

    // Connect to instance (triggers re-render → useEffect below fires)
    connectTo(instance);
  }, [activeChat?.agentPrompt, activeChatId, connectTo]);

  // ── Execute pending prompt when connection establishes ──
  useEffect(() => {
    if (!pendingExecPrompt || !isConnected) return;

    const { prompt, chatId, mode: execMode } = pendingExecPrompt;
    setPendingExecPrompt(null);

    const userMsg: ChatMessage = {
      id: `agent-prompt-${Date.now()}`,
      chatId,
      role: 'user',
      content: prompt,
      metadata: { isAgentPrompt: true },
      createdAt: new Date().toISOString(),
    };

    setActiveChat(prev => prev ? {
      ...prev,
      messages: [...prev.messages, userMsg],
    } : null);

    fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: prompt, metadata: { isAgentPrompt: true } }),
    }).catch(() => {});

    setCliExecuting(true);
    cliChat.sendMessage(prompt, chatId, execMode);
  }, [pendingExecPrompt, isConnected, cliChat]);

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
          {activeTab === 'chat' ? (
            <ChatSidebar
              chats={chats}
              sessions={isConnected ? connection.sessions : undefined}
              activeChatId={activeChatId}
              onSelect={handleChatSelect}
              onSessionClick={openSessionInTab}
              onCreate={createChat}
              onDelete={deleteChat}
              onRename={renameChat}
            />
          ) : activeTab === 'console' ? (
            <SessionSidebar
              sessions={consoleSessions}
              selectedId={consoleSessionId}
              onSelect={(id) => setConsoleSessionId(id)}
              onAbort={handleAbortSession}
              emptyLabel={t('consoleNoSessions')}
              emptyHint={t('consoleTabHint')}
              actions={[
                { label: 'Start Auto', icon: Zap, onClick: () => handleStartAuto(), color: 'text-gray-400', hoverColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
                { label: 'Start Security', icon: Shield, onClick: handleStartSecurity, color: 'text-gray-400', hoverColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
              ]}
            />
          ) : activeTab === 'monitor' ? (
            <SessionSidebar
              sessions={monitorSessions}
              selectedId={monitorSessionId}
              onSelect={(id) => setMonitorSessionId(id)}
              onAbort={handleAbortSession}
              emptyLabel={t('monitorIdle')}
              emptyHint={t('monitorTabHint')}
              actions={[
                { label: t('monitorStartPassive'), icon: Eye, onClick: () => handleStartMonitor('passive'), color: 'text-gray-400', hoverColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                { label: t('monitorStartDefensive'), icon: Shield, onClick: () => handleStartMonitor('defensive'), color: 'text-gray-400', hoverColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                { label: t('monitorStartActive'), icon: ShieldAlert, onClick: () => handleStartMonitor('active'), color: 'text-gray-400', hoverColor: 'bg-red-500/10 text-red-400 border-red-500/20' },
              ]}
            />
          ) : activeTab === 'jarvis' ? (
            <SessionSidebar
              sessions={jarvisSessions}
              selectedId={null}
              onSelect={() => {}}
              onAbort={handleAbortSession}
              emptyLabel={t('jarvisNoTasks')}
            />
          ) : null}
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

            {/* Use in Helix button — always visible when >= 2 messages */}
            {activeTab === 'chat' && activeChat &&
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
                {creatingPrompt ? t('creatingPrompt') : t('useInHelix')}
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
            <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5 overflow-x-auto scrollbar-none flex-nowrap">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'chat' ? TAB_COLORS.chat.active : TAB_COLORS.chat.inactive
                }`}
              >
                <MessageSquare size={11} />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('console')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'console' ? TAB_COLORS.console.active : TAB_COLORS.console.inactive
                }`}
              >
                <Terminal size={11} />
                Console
                {consoleSessions.some(s => s.status === 'running') && (
                  <span className={`w-1.5 h-1.5 rounded-full ${TAB_COLORS.console.dot} animate-pulse`} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('monitor')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'monitor' ? TAB_COLORS.monitor.active : TAB_COLORS.monitor.inactive
                }`}
              >
                <Eye size={11} />
                {t('monitorTab')}
                {(monitorSessions.some(s => s.status === 'running') || threatCount > 0 || connection.approvals.length > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('jarvis');
                  connection.listJarvisTasks().catch(() => {});
                  connection.getJarvisStatus().catch(() => {});
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'jarvis' ? TAB_COLORS.jarvis.active : TAB_COLORS.jarvis.inactive
                }`}
              >
                <Bot size={11} />
                {t('jarvisTab')}
                {connection.jarvisStatus?.daemonState === 'running' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${TAB_COLORS.jarvis.dot} animate-pulse`} />
                )}
              </button>
            </div>
          )}

          {/* Bug panel toggle — visible when connected and in chat tab */}
          {isConnected && activeTab === 'chat' && (
            <button
              onClick={() => { setShowBugPanel(prev => !prev); connection.getBugs().catch(() => {}); }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                showBugPanel
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : connection.bugs.filter(b => b.status === 'open').length > 0
                    ? 'bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500/10'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/10'
              }`}
            >
              <Bug size={11} />
              {connection.bugs.filter(b => b.status === 'open').length > 0 && (
                <span className="min-w-[12px] h-[12px] flex items-center justify-center rounded-full bg-red-500/20 text-[8px] text-red-400 font-bold px-0.5">
                  {connection.bugs.filter(b => b.status === 'open').length}
                </span>
              )}
            </button>
          )}

          {/* CLI Connection badge */}
          {isConnected && connection.instanceMeta ? (
            activeTab === 'chat' ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] bg-emerald-500/5 border border-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <div className="hidden sm:flex items-center gap-1 text-emerald-400">
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
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] bg-emerald-500/5 border border-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">{connection.instanceMeta.projectName}</span>
                <span className="text-gray-600">:{connectedPort}</span>
              </div>
            )
          ) : isConnecting ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-cyan-400/80 bg-cyan-500/5 border border-cyan-500/10 animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              {t('connecting')}
            </div>
          ) : (
            <div className="relative" ref={connectPopoverRef}>
              <button
                onClick={() => { rescan(); setShowConnectPopover(p => !p); }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-gray-500 bg-white/5 border border-white/5 hover:text-gray-300 hover:border-white/10 transition-colors"
              >
                <WifiOff size={11} />
                {t('cliDisconnected')}
                <ChevronDown size={9} className="opacity-50" />
              </button>
              {showConnectPopover && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl p-3 z-50">
                  {instances.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-500 mb-2">{t('connectCli')}</p>
                      {instances.map(inst => (
                        <button
                          key={inst.port}
                          onClick={() => { connectTo(inst); setShowConnectPopover(false); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/20 text-left transition-all"
                        >
                          <Terminal size={12} className="text-gray-500" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-300 truncate">{inst.meta.projectName}</div>
                            <div className="text-[10px] text-gray-600">{inst.meta.model} · :{inst.port}</div>
                          </div>
                          <Plug size={10} className="text-gray-600" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-[10px] text-gray-500">{t('noInstances')}</p>
                      <button
                        onClick={rescan}
                        disabled={scanning}
                        className="mt-2 flex items-center gap-1 mx-auto px-2.5 py-1 rounded-md text-[10px] text-gray-400 bg-white/5 hover:bg-white/10 border border-white/5 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={10} className={scanning ? 'animate-spin' : ''} />
                        Scan
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Spawn agent button */}
          <button
            onClick={() => setShowSpawnDialog(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors"
            title="Spawn Agent"
          >
            <Plus size={18} />
          </button>

          {/* Brain button — glow when chat active + CLI, grayed when not connected */}
          <button
            onClick={handleBrainClick}
            disabled={!isConnected}
            className={`p-1.5 rounded-lg transition-all ${
              isConnected && activeTab === 'chat' && activeChat
                ? 'text-cyan-400 bg-cyan-400/10 animate-brain-glow'
                : isConnected
                  ? 'text-cyan-400/60 hover:text-cyan-400 hover:bg-cyan-400/5'
                  : 'text-gray-700 cursor-not-allowed'
            }`}
            title={t('brain')}
          >
            <Brain size={18} />
          </button>
        </div>

        {/* Active sessions strip + Jarvis tile */}
        {isConnected && (activeSessions.length > 0 || connection.jarvisStatus?.daemonState === 'running') && (
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/5 bg-surface/30 overflow-x-auto">
            {/* Jarvis daemon tile */}
            {connection.jarvisStatus?.daemonState === 'running' && (
              <button
                onClick={() => {
                  setActiveTab('jarvis');
                  connection.listJarvisTasks().catch(() => {});
                }}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border flex-shrink-0 transition-all ${
                  activeTab === 'jarvis'
                    ? 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-400'
                    : 'bg-fuchsia-500/5 border-fuchsia-500/15 text-fuchsia-400/80 hover:bg-fuchsia-500/10'
                }`}
              >
                <Bot size={10} className="text-fuchsia-400" />
                <span className="font-medium">Jarvis</span>
                <span className={`text-[9px] px-1 rounded-full ${
                  connection.jarvisStatus.thinkingPhase === 'deep' ? 'bg-fuchsia-500/20' :
                  connection.jarvisStatus.thinkingPhase === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {connection.jarvisStatus.thinkingPhase ?? 'idle'}
                </span>
                <Activity size={8} className="text-fuchsia-400 animate-pulse" />
                {connection.jarvisStatus.pendingCount > 0 && (
                  <span className="text-fuchsia-400/60">{connection.jarvisStatus.pendingCount} tasks</span>
                )}
              </button>
            )}
            {activeSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => openSessionInTab(session.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border flex-shrink-0 transition-all ${
                  consoleSessionId === session.id && activeTab === 'console'
                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-cyan-500/5 hover:border-cyan-500/10'
                }`}
              >
                <SessionIcon name={session.name} size={10} className="text-gray-400" />
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
              activeTools={cliExecuting ? cliChat.state.activeTools : []}
              hasChat={!!activeChat}
              agentPrompt={activeChat?.agentPrompt}
              chatStatus={activeChat?.status}
              onEditPrompt={handleEditPrompt}
              onConnectInstance={() => setShowInstancePicker(true)}
              onExecutePrompt={handleExecutePrompt}
              isConnected={isConnected}
              isExecuting={cliExecuting}
              bugs={connection.bugs}
              showBugPanel={showBugPanel}
              onCloseBugPanel={() => setShowBugPanel(false)}
              onFixBug={handleFixBug}
              onFixAll={handleFixAllBugs}
            />
          </div>
        ) : activeTab === 'console' ? (
          <div className="flex-1 overflow-hidden">
            {consoleSessionId ? (
              <TerminalViewer lines={cliOutput.lines} fullHeight />
            ) : (
              <TabInfoPage
                icon={<Terminal size={28} />}
                title={t('consoleInfoTitle')}
                description={t('consoleInfoDesc')}
                accentColor="cyan"
                features={[
                  { icon: <Zap size={16} />, title: t('consoleInfoFeature1Title'), description: t('consoleInfoFeature1Desc') },
                  { icon: <ShieldCheck size={16} />, title: t('consoleInfoFeature2Title'), description: t('consoleInfoFeature2Desc') },
                  { icon: <ListChecks size={16} />, title: t('consoleInfoFeature3Title'), description: t('consoleInfoFeature3Desc') },
                ]}
                actions={
                  isConnected ? (
                    <>
                      <button onClick={() => handleStartAuto()} className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/20 hover:text-cyan-400 transition-all">
                        <Zap size={12} className="inline mr-1.5" />Auto
                      </button>
                      <button onClick={handleStartSecurity} className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition-all">
                        <Shield size={12} className="inline mr-1.5" />Security
                      </button>
                    </>
                  ) : undefined
                }
              />
            )}
          </div>
        ) : activeTab === 'monitor' ? (
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
                <TabInfoPage
                  icon={<Eye size={28} />}
                  title={t('monitorInfoTitle')}
                  description={t('monitorInfoDesc')}
                  accentColor="purple"
                  features={[
                    { icon: <Eye size={16} />, title: t('monitorInfoFeature1Title'), description: t('monitorInfoFeature1Desc') },
                    { icon: <Shield size={16} />, title: t('monitorInfoFeature2Title'), description: t('monitorInfoFeature2Desc') },
                    { icon: <ShieldAlert size={16} />, title: t('monitorInfoFeature3Title'), description: t('monitorInfoFeature3Desc') },
                  ]}
                  actions={isConnected ? (
                    <>
                      <button onClick={() => handleStartMonitor('passive')} className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/20 hover:text-purple-400 transition-all">
                        <Eye size={12} className="inline mr-1.5" />{t('monitorStartPassive')}
                      </button>
                      <button onClick={() => handleStartMonitor('defensive')} className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition-all">
                        <Shield size={12} className="inline mr-1.5" />{t('monitorStartDefensive')}
                      </button>
                      <button onClick={() => handleStartMonitor('active')} className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all">
                        <ShieldAlert size={12} className="inline mr-1.5" />{t('monitorStartActive')}
                      </button>
                    </>
                  ) : undefined}
                />
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
        ) : activeTab === 'jarvis' ? (
          /* ─── Jarvis Tab ─── */
          <div className="flex-1 overflow-hidden">
            <JarvisPanel
              tasks={connection.jarvisTasks}
              status={connection.jarvisStatus}
              onStartJarvis={() => connection.startJarvis().catch(() => {})}
              onStopJarvis={() => connection.stopJarvis().catch(() => {})}
              onPauseJarvis={() => connection.pauseJarvis().catch(() => {})}
              onResumeJarvis={() => connection.resumeJarvis().catch(() => {})}
              onAddTask={(title, desc, pri) => connection.addJarvisTask(title, desc, pri).catch(() => {})}
              onClearCompleted={() => {
                connection.sendRequest('clear_jarvis_completed').catch(() => {});
                connection.listJarvisTasks().catch(() => {});
              }}
              isConnected={isConnected}
              proposals={connection.proposals}
              identity={connection.identity}
              autonomyLevel={connection.autonomyLevel}
              workers={connection.workers}
              thinkingUpdates={connection.thinkingUpdates}
              consciousnessEvents={connection.consciousnessEvents}
              onApproveProposal={(id) => connection.approveProposal(id).catch(() => {})}
              onDenyProposal={(id, reason) => connection.denyProposal(id, reason).catch(() => {})}
              onSetAutonomy={(level) => connection.setAutonomyLevel(level).catch(() => {})}
              onTriggerDeepThink={() => connection.triggerDeepThink().catch(() => {})}
            />
          </div>
        ) : null}

        {/* Input — always visible */}
        <ChatInput
          onSend={sendMessage}
          isAgentRunning={isAgentRunning}
          onStop={handleStop}
          mode={mode}
          onModeChange={setMode}
          disabled={!isConnected && !hasLLMKey}
          hasLLMKey={isConnected || hasLLMKey}
          hasChat={!!activeChat}
          isConnected={isConnected}
        />
      </div>

      {/* Instance Picker Modal */}
      <InstancePicker
        open={showInstancePicker}
        onClose={() => setShowInstancePicker(false)}
        onConnect={handleConnectAndExecute}
      />

      {/* Spawn Dialog */}
      <SpawnDialog
        open={showSpawnDialog}
        onClose={() => setShowSpawnDialog(false)}
        onSpawned={() => {
          // Trigger rescan so discovery finds the new instance
          rescan();
        }}
        instances={instances}
        onConnect={(inst) => { connectTo(inst); setShowSpawnDialog(false); }}
      />
    </div>
  );
}
