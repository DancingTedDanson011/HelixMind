'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import type { DiscoveredInstance, ChatFileAttachment } from '@/lib/cli-types';
import type { FileInfo } from './FileAttachment';
import {
  Brain, PanelLeftClose, PanelLeft, Menu, ChevronDown,
  Wifi, WifiOff, RefreshCw, Terminal, Plus,
  Cpu, Clock, Plug, Shield, Zap,
  AlertTriangle, Activity, X, MessageSquare, Square,
  Eye, ShieldAlert, CheckCircle2, XCircle, Radio, FileText, Loader2,
  Bug, Bot, Search, ListChecks, ShieldCheck,
  Play, Pause, Sparkles, Users, Minimize2, Maximize2,
} from 'lucide-react';
import { JarvisPanel } from '@/components/jarvis/JarvisPanel';
import { JarvisTaskList } from '@/components/jarvis/JarvisTaskList';
import { JarvisBottomPanel } from '@/components/jarvis/JarvisBottomPanel';
import { InlineBugPanel } from './InlineBugPanel';
import { TabInfoPage } from './TabInfoPage';
import { PermissionRequestCard } from './PermissionRequestCard';
import { CliStatusBar } from './CliStatusBar';
import { CheckpointBrowser } from './CheckpointBrowser';
import { BrainCanvas } from '@/components/brain/BrainCanvas';
import { BrainOverlay } from './BrainOverlay';
import { useVoiceSession } from '@/hooks/use-voice-session';
import { stripAnsi } from '@/lib/ansi-to-spans';

/* ─── Tab color scheme ──────────────────────── */

const TAB_COLORS = {
  chat:    { active: 'bg-cyan-500/15 text-cyan-400',    inactive: 'text-cyan-400/40 hover:text-cyan-400/70',    dot: 'bg-cyan-400' },
  console: { active: 'bg-emerald-500/15 text-emerald-400', inactive: 'text-emerald-400/40 hover:text-emerald-400/70', dot: 'bg-emerald-400' },
  monitor: { active: 'bg-blue-500/15 text-blue-400',  inactive: 'text-blue-400/40 hover:text-blue-400/70',  dot: 'bg-blue-400' },
  jarvis:  { active: 'bg-red-500/15 text-red-400', inactive: 'text-red-400/40 hover:text-red-400/70', dot: 'bg-red-400' },
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

function getSessionTab(name: string, jarvisName?: string, _daemonRunning?: boolean): 'console' | 'monitor' | 'jarvis' {
  const lower = name.toLowerCase();
  if (lower.includes('monitor') || lower.includes('security') || lower.includes('audit')) return 'monitor';
  // 🤖 emoji → always Jarvis (all Jarvis sessions use this icon)
  if (name.includes('🤖')) return 'jarvis';
  if (lower.includes('jarvis')) return 'jarvis';
  // Match custom Jarvis name (min 2 chars, e.g. "Olfa" → jarvis)
  if (jarvisName && jarvisName.length >= 2 && lower.includes(jarvisName.toLowerCase())) return 'jarvis';
  return 'console'; // auto, everything else → Console
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

/* ─── Autonomy Picker (inline) ────────────────── */

const AUTONOMY_LEVELS: Record<number, { color: string; label: string }> = {
  0: { color: 'text-red-400', label: 'Observe' },
  1: { color: 'text-orange-400', label: 'Think' },
  2: { color: 'text-yellow-400', label: 'Propose' },
  3: { color: 'text-emerald-400', label: 'Act-Safe' },
  4: { color: 'text-cyan-400', label: 'Act-Ask' },
  5: { color: 'text-red-400', label: 'Critical' },
};

function AutonomyPicker({ level, onSet }: { level: number; onSet: (lvl: number) => void }) {
  const al = AUTONOMY_LEVELS[level] ?? AUTONOMY_LEVELS[2];
  return (
    <div className="relative group/aut">
      <button className={`text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 ${al.color} hover:bg-red-500/20 transition-colors cursor-pointer`}>
        L{level} {al.label}
      </button>
      <div className="absolute top-full left-0 mt-1 hidden group-hover/aut:flex gap-0.5 bg-gray-900/95 border border-white/10 rounded-lg p-1 z-50 shadow-xl">
        {[0, 1, 2, 3, 4, 5].map(lvl => {
          const a = AUTONOMY_LEVELS[lvl] ?? AUTONOMY_LEVELS[2];
          return (
            <button
              key={lvl}
              onClick={() => onSet(lvl)}
              className={`px-1.5 py-1 rounded text-[9px] font-medium transition-all whitespace-nowrap ${
                lvl === level
                  ? `${a.color} bg-white/10 border border-white/20`
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }`}
              title={a.label}
            >
              L{lvl}
            </button>
          );
        })}
      </div>
    </div>
  );
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
    isRelay, toast: cliToast,
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
  const [mode, setMode] = useState<'normal' | 'skip-permissions' | 'yolo'>('normal');
  const [activeTab, setActiveTab] = useState<'chat' | 'console' | 'monitor' | 'jarvis'>(
    (initialTab === 'console' || initialTab === 'monitor' || initialTab === 'jarvis') ? initialTab : 'chat'
  );
  const [consoleSessionId, setConsoleSessionId] = useState<string | null>(initialSession || null);
  const [monitorSessionId, setMonitorSessionId] = useState<string | null>(null);
  const [showInstancePicker, setShowInstancePicker] = useState(false);
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);
  const [showBugPanel, setShowBugPanel] = useState(false);
  const [cliOutputMessages, setCliOutputMessages] = useState<ChatMessage[]>([]);
  const [showJarvisPanel, setShowJarvisPanel] = useState(true);
  const [isFullscreenChat, setIsFullscreenChat] = useState(false);

  // Close fullscreen chat on Escape
  useEffect(() => {
    if (!isFullscreenChat) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreenChat(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isFullscreenChat]);

  const [showConnectPopover, setShowConnectPopover] = useState(false);
  const connectPopoverRef = useRef<HTMLDivElement>(null);
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [hasLLMKey, setHasLLMKey] = useState(false);
  const [pendingExecPrompt, setPendingExecPrompt] = useState<{ prompt: string; chatId: string; mode: 'normal' | 'skip-permissions' } | null>(null);

  const brainstormChat = useBrainstormChat();

  const isConnected = connection.connectionState === 'connected';
  const isConnecting = connection.connectionState === 'connecting' || connection.connectionState === 'authenticating';

  // Map 3-value permission mode to 2-value chat protocol mode (yolo → skip-permissions for wire)
  const chatMode: 'normal' | 'skip-permissions' = mode === 'normal' ? 'normal' : 'skip-permissions';

  // CLI execution state (only when user confirms prompt execution)
  const [cliExecuting, setCliExecuting] = useState(false);

  // Sync cliExecuting with the chat hook so incoming chat_started events
  // (e.g. CLI sends response without a local sendMessage call) also show the streaming UI.
  useEffect(() => {
    if (cliChat.state.isProcessing && !cliExecuting) {
      setCliExecuting(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliChat.state.isProcessing]);

  // isAgentRunning covers both brainstorm and CLI (local send + incoming events)
  const isAgentRunning = brainstormChat.state.isProcessing || cliExecuting || cliChat.state.isProcessing;
  const streamingContent = brainstormChat.state.streamingText || ((cliExecuting || cliChat.state.isProcessing) ? cliChat.state.streamingText : '');

  // Voice conversation
  const voice = useVoiceSession({
    sendRaw: connection.sendRaw,
    onWsMessage: connection.onWsMessage,
    isConnected,
  });

  // CLI output — subscribe to console OR jarvis session depending on active tab
  const jNameEarly = connection.jarvisStatus?.jarvisName;
  const jRunEarly = connection.jarvisStatus?.daemonState === 'running';
  const jarvisSessionIdForOutput = activeTab === 'jarvis'
    ? (connection.sessions.find(s => s.id !== 'main' && getSessionTab(s.name, jNameEarly, jRunEarly) === 'jarvis')?.id ?? null)
    : null;
  const cliOutput = useCliOutput({
    connection,
    sessionId: activeTab === 'chat' ? (isConnected ? 'main' : null)
      : activeTab === 'console' ? consoleSessionId
      : activeTab === 'monitor' ? monitorSessionId
      : jarvisSessionIdForOutput,
  });

  // ── Convert CLI output to chat messages (for chat tab) ──
  const lastOutputIdxRef = useRef<number>(0);
  useEffect(() => {
    if (activeTab !== 'chat' || !isConnected || cliOutput.lines.length === 0) return;

    const startIdx = lastOutputIdxRef.current;
    if (startIdx >= cliOutput.lines.length) return;
    lastOutputIdxRef.current = cliOutput.lines.length;

    // Collect new lines, strip ANSI, skip empty
    const newLines: string[] = [];
    for (let i = startIdx; i < cliOutput.lines.length; i++) {
      const clean = stripAnsi(cliOutput.lines[i]).trim();
      if (clean && clean.length >= 2) newLines.push(clean);
    }
    if (newLines.length === 0) return;

    // Batch into a single message (not one per line)
    const cliMsg: ChatMessage = {
      id: `cli-output-${Date.now()}`,
      chatId: activeChatId || 'cli',
      role: 'assistant',
      content: newLines.join('\n'),
      metadata: { isCliExecution: true },
      createdAt: new Date().toISOString(),
    };
    setCliOutputMessages(prev => [...prev.slice(-50), cliMsg]); // Keep last 50
  }, [cliOutput.lines, activeTab, isConnected, activeChatId]);

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

  // ── Auto-sync CLI config → web on connect ──
  const configSyncedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || configSyncedRef.current) return;
    configSyncedRef.current = true;

    connection.fetchConfig().then((cfg) => {
      if (cfg) {
        // Re-check hasLLMKey after syncing
        setHasLLMKey(true);
      }
    }).catch(() => {});

    // Read permission mode from instance meta
    const pm = connection.instanceMeta?.permissionMode;
    if (pm === 'yolo') setMode('yolo');
    else if (pm === 'skip-permissions') setMode('skip-permissions');
    else setMode('normal');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Reset config sync flag on disconnect
  useEffect(() => {
    if (!isConnected) configSyncedRef.current = false;
  }, [isConnected]);

  // Track permission mode changes from CLI (live updates via instance_meta events)
  useEffect(() => {
    if (!isConnected) return;
    const pm = connection.instanceMeta?.permissionMode;
    if (pm === 'yolo') setMode('yolo');
    else if (pm === 'skip-permissions') setMode('skip-permissions');
    else if (pm === 'safe') setMode('normal');
  }, [isConnected, connection.instanceMeta?.permissionMode]);

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

  // ── Per-instance chat mapping (port → chatId) ──
  const instanceChatMapRef = useRef<Map<number, string>>(new Map());

  // ── Auto-create or select chat on CLI connect ─────────
  const autoCreatedForPortRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isConnected) return;
    // Already have active chat — nothing to do
    if (activeChatId) return;

    const port = connectedPort;

    // Check if we have a saved chat for this CLI instance (from a previous switch)
    if (port && instanceChatMapRef.current.has(port)) {
      const savedChatId = instanceChatMapRef.current.get(port)!;
      loadChat(savedChatId);
      return;
    }

    // Select most recent existing chat (only when no multi-instance mapping exists)
    if (chats.length > 0 && instanceChatMapRef.current.size === 0) {
      loadChat(chats[0].id);
      return;
    }

    // Auto-create one for this CLI instance
    if (!port || autoCreatedForPortRef.current === port) return;
    autoCreatedForPortRef.current = port;

    const instanceName = connection.instanceMeta?.projectName || 'HelixMind';
    (async () => {
      try {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, title: instanceName }),
        });
        if (res.ok) {
          const chat = await res.json();
          if (port) instanceChatMapRef.current.set(port, chat.id);
          await fetchChats();
          await loadChat(chat.id);
        }
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, chats.length, activeChatId, connectedPort]);

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
      const tab = getSessionTab(firstSession.name, connection.jarvisStatus?.jarvisName, connection.jarvisStatus?.daemonState === 'running');
      setActiveTab(tab);
      if (tab === 'console') setConsoleSessionId(firstSession.id);
      if (tab === 'monitor') setMonitorSessionId(firstSession.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Reset auto-detect flag on disconnect
  useEffect(() => {
    if (!isConnected) {
      hasAutoDetectedRef.current = false;
      autoCreatedForPortRef.current = null;
    }
  }, [isConnected]);

  // ── Load chat messages ──────────────────────
  const loadChat = useCallback(async (chatId: string) => {
    setCliOutputMessages([]); // Clear CLI output on chat switch
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data: ChatFull = await res.json();
        setActiveChat(data);
        setActiveChatId(chatId);
        setMode(data.mode as 'normal' | 'skip-permissions' | 'yolo');
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

  // ── Sessions filtered by tab type ──
  const jName = connection.jarvisStatus?.jarvisName;
  const jRunning = connection.jarvisStatus?.daemonState === 'running';

  // ── Active sessions (auto, security, monitor) — exclude main "Chat" session ──
  const activeSessions = connection.sessions.filter(s => s.status === 'running' && s.id !== 'main' && getSessionTab(s.name, jName) !== 'jarvis');
  const threatCount = connection.threats.length;
  const consoleSessions = connection.sessions.filter(s => s.id === 'main' || getSessionTab(s.name, jName, jRunning) === 'console');
  const monitorSessions = connection.sessions.filter(s => s.id !== 'main' && getSessionTab(s.name, jName, jRunning) === 'monitor');
  const jarvisSessions = connection.sessions.filter(s => s.id !== 'main' && getSessionTab(s.name, jName, jRunning) === 'jarvis');

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

  // ── Checkpoints panel ──
  const [showCheckpoints, setShowCheckpoints] = useState(false);

  // ── Brain: in-app overlay (hidden / minimized / full) ──
  const [brainOverlayState, setBrainOverlayState] = useState<'hidden' | 'minimized' | 'full'>('hidden');
  // Use iframe only when locally connected via HTTP (not HTTPS/relay)
  const canUseIframe = connectedPort && typeof window !== 'undefined' && window.location.protocol === 'http:';
  const handleBrainClick = useCallback(() => {
    // Always allow opening — use embedded brain when no iframe possible
    if (isConnected) {
      setBrainOverlayState('full');
    }
  }, [isConnected]);

  // ── Auto-select console session (prefer main when connected) ─────
  useEffect(() => {
    if (activeTab === 'console' && !consoleSessionId) {
      // Prefer main session when connected
      if (isConnected) {
        setConsoleSessionId('main');
      } else if (consoleSessions.length > 0) {
        const running = consoleSessions.find(s => s.status === 'running');
        setConsoleSessionId(running?.id ?? consoleSessions[0].id);
      }
    }
  }, [activeTab, consoleSessionId, consoleSessions, isConnected]);

  // ── Auto-select first monitor session for monitor tab ─────
  useEffect(() => {
    if (activeTab === 'monitor' && !monitorSessionId && monitorSessions.length > 0) {
      const running = monitorSessions.find(s => s.status === 'running');
      setMonitorSessionId(running?.id ?? monitorSessions[0].id);
    }
  }, [activeTab, monitorSessionId, monitorSessions]);

  // ── Auto-switch to jarvis tab when daemon starts ─────
  const prevDaemonStateRef = useRef(connection.jarvisStatus?.daemonState);
  useEffect(() => {
    const prev = prevDaemonStateRef.current;
    const curr = connection.jarvisStatus?.daemonState;
    prevDaemonStateRef.current = curr;
    // Transition from not-running → running → switch to jarvis tab
    if (prev !== 'running' && curr === 'running') {
      setActiveTab('jarvis');
    }
  }, [connection.jarvisStatus?.daemonState]);

  // ── Auto-switch to console when monitor is stopped ─────
  const prevMonitorStatusRef = useRef(connection.monitorStatus);
  useEffect(() => {
    const prev = prevMonitorStatusRef.current;
    prevMonitorStatusRef.current = connection.monitorStatus;
    // Was running → now null = monitor stopped
    if (prev && !connection.monitorStatus && activeTab === 'monitor') {
      setActiveTab('console');
    }
  }, [connection.monitorStatus, activeTab]);

  // ── Open session in correct tab ────────────────
  const openSessionInTab = useCallback((sessionId: string) => {
    const session = connection.sessions.find(s => s.id === sessionId);
    if (!session) return;
    const tab = getSessionTab(session.name, connection.jarvisStatus?.jarvisName, connection.jarvisStatus?.daemonState === 'running');
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
    const expectedTab = getSessionTab(session.name, connection.jarvisStatus?.jarvisName, connection.jarvisStatus?.daemonState === 'running');
    if (expectedTab !== 'console' && activeTab === 'console') {
      setActiveTab(expectedTab);
      setConsoleSessionId(null);
    }
  }, [connection.sessions, consoleSessionId, activeTab, connection.jarvisStatus]);

  // ── Auto-switch to correct tab when new session created ──
  const prevSessionCountRef = useRef(connection.sessions.length);
  useEffect(() => {
    const currentCount = connection.sessions.length;
    if (currentCount > prevSessionCountRef.current) {
      // New session added — find it (last one)
      const newSession = connection.sessions[connection.sessions.length - 1];
      if (newSession && newSession.id !== 'main') {
        const tab = getSessionTab(newSession.name, connection.jarvisStatus?.jarvisName, connection.jarvisStatus?.daemonState === 'running');
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
    cliChat.sendMessage(fixPrompt, chatId, chatMode);
  }, [activeChatId, isConnected, cliChat, chatMode, fetchChats, loadChat, activeTab]);

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

  const handleDeleteBug = useCallback((bugId: number) => {
    connection.deleteBug(bugId).catch(() => {});
  }, [connection]);

  // ── Fetch bugs on connect ──────────────────
  useEffect(() => {
    if (isConnected) {
      connection.getBugs().catch(() => {});
      connection.getStatusBar().catch(() => {});
      connection.listCheckpoints().catch(() => {});
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

  // ── Switch between CLI instances (preserves per-instance chat) ──
  const handleInstanceSwitch = useCallback((inst: DiscoveredInstance) => {
    // Save current chat mapping before switching
    if (connectedPort && activeChatId) {
      instanceChatMapRef.current.set(connectedPort, activeChatId);
    }

    // Clear current state so auto-create useEffect picks up the new instance
    setActiveChatId(null);
    setActiveChat(null);

    // Connect to new instance
    connectTo(inst);
  }, [connectedPort, activeChatId, connectTo]);

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
            handleInstanceSwitch(instances[0]);
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
      cliChat.sendMessage(trimmed, chatId, chatMode);
    } else if (hasLLMKey) {
      brainstormChat.sendMessage(trimmed, chatId);
    }
  }, [activeChatId, brainstormChat, mode, hasLLMKey, isConnected, cliChat, fetchChats, loadChat, activeTab,
      handleStartAuto, handleStartSecurity, handleStartMonitor, handleAbortSession,
      handleBrainClick, activeSessions, disconnectCli, addSystemMessage, instances, handleInstanceSwitch, rescan, t]);

  // ── Send message with file attachments ──
  const handleSendWithFiles = useCallback(async (content: string, files: FileInfo[]) => {
    if (!isConnected || files.length === 0) {
      // Fallback to regular send
      sendMessage(content);
      return;
    }

    const trimmed = content.trim();

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

    if (activeTab !== 'chat') setActiveTab('chat');

    // Optimistic user message with file info
    const fileNames = files.map(f => f.name).join(', ');
    const displayContent = trimmed + (trimmed ? '\n' : '') + `[Files: ${fileNames}]`;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chatId,
      role: 'user',
      content: displayContent,
      createdAt: new Date().toISOString(),
      metadata: { files: files.map(f => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes })) },
    };

    setActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, userMsg] } : null);

    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: displayContent }),
      });
    } catch { /* silent */ }

    // Convert FileInfo → ChatFileAttachment
    const chatFiles: ChatFileAttachment[] = files
      .filter(f => f.dataBase64)
      .map(f => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes, dataBase64: f.dataBase64! }));

    setCliExecuting(true);
    cliChat.sendMessage(trimmed || 'Please analyze the attached files.', chatId, chatMode, chatFiles);
  }, [activeChatId, isConnected, cliChat, sendMessage, mode, fetchChats, loadChat, activeTab, chatMode]);

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
    // If this is the active CLI chat, switch to the tab with the active CLI mode
    if (isConnected && chatId === activeChatId) {
      const jName = connection.jarvisStatus?.jarvisName;
      const jRunning = connection.jarvisStatus?.daemonState === 'running';
      const sessions = connection.sessions.filter(s => s.id !== 'main' && s.status === 'running');
      const hasConsole = sessions.some(s => getSessionTab(s.name, jName, jRunning) === 'console');
      const hasMonitor = sessions.some(s => getSessionTab(s.name, jName, jRunning) === 'monitor');
      const hasJarvis = jRunning;
      // Priority: console > monitor > jarvis > chat
      if (hasConsole) setActiveTab('console');
      else if (hasMonitor) setActiveTab('monitor');
      else if (hasJarvis) setActiveTab('jarvis');
      else setActiveTab('chat');
    } else {
      setActiveTab('chat');
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [loadChat, isConnected, activeChatId, connection]);

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
    cliChat.sendMessage(prompt, activeChatId, chatMode);
  }, [activeChatId, isConnected, cliChat, mode]);

  // ── Connect Instance & Execute ──────────────
  const handleConnectAndExecute = useCallback(async (instance: DiscoveredInstance, execMode: 'normal' | 'skip-permissions' | 'yolo') => {
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
      setPendingExecPrompt({ prompt, chatId: activeChatId, mode: execMode === 'normal' ? 'normal' : 'skip-permissions' });
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
              sessions={isConnected ? consoleSessions : undefined}
              jarvisName={connection.jarvisStatus?.jarvisName}
              activeChatId={activeChatId}
              isConnected={isConnected}
              onSelect={handleChatSelect}
              onSessionClick={openSessionInTab}
              onSessionDismiss={connection.dismissSession}
              onCreate={createChat}
              onDelete={deleteChat}
              onRename={renameChat}
              instanceMeta={isConnected ? connection.instanceMeta ?? undefined : undefined}
              instanceMode={mode === 'yolo' ? 'yolo' : mode === 'skip-permissions' ? 'skip-permissions' : 'safe'}
              tabMode="chat"
            />
          ) : activeTab === 'console' ? (
            <SessionSidebar
              sessions={consoleSessions}
              selectedId={consoleSessionId}
              onSelect={(id) => setConsoleSessionId(id)}
              onAbort={handleAbortSession}
              onDismiss={connection.dismissSession}
              emptyLabel={isConnected ? t('consoleNoSessions') : t('cliDisconnected')}
              emptyHint={isConnected ? t('consoleTabHint') : t('setupDesc')}
              actions={isConnected ? [
                { label: 'Start Auto', icon: Zap, onClick: () => handleStartAuto(), color: 'text-gray-400', hoverColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
                { label: 'Start Security', icon: Shield, onClick: handleStartSecurity, color: 'text-gray-400', hoverColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
              ] : []}
            />
          ) : activeTab === 'monitor' ? (
            <SessionSidebar
              sessions={monitorSessions}
              selectedId={monitorSessionId}
              onSelect={(id) => setMonitorSessionId(id)}
              onAbort={handleAbortSession}
              onDismiss={connection.dismissSession}
              emptyLabel={isConnected ? t('monitorIdle') : t('cliDisconnected')}
              emptyHint={isConnected ? t('monitorTabHint') : t('setupDesc')}
              actions={isConnected ? [
                { label: t('monitorStartPassive'), icon: Eye, onClick: () => handleStartMonitor('passive'), color: 'text-gray-400', hoverColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                { label: t('monitorStartDefensive'), icon: Shield, onClick: () => handleStartMonitor('defensive'), color: 'text-gray-400', hoverColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                { label: t('monitorStartActive'), icon: ShieldAlert, onClick: () => handleStartMonitor('active'), color: 'text-gray-400', hoverColor: 'bg-red-500/10 text-red-400 border-red-500/20' },
              ] : []}
            />
          ) : activeTab === 'jarvis' ? (
            <ChatSidebar
              chats={chats}
              sessions={isConnected ? jarvisSessions : undefined}
              jarvisName={connection.jarvisStatus?.jarvisName}
              activeChatId={activeChatId}
              isConnected={isConnected}
              onSelect={(id) => { handleChatSelect(id); setActiveTab('chat'); }}
              onSessionClick={openSessionInTab}
              onSessionDismiss={connection.dismissSession}
              onCreate={() => { createChat(); setActiveTab('chat'); }}
              onDelete={deleteChat}
              onRename={renameChat}
              instanceMeta={isConnected ? connection.instanceMeta ?? undefined : undefined}
              instanceMode={mode === 'yolo' ? 'yolo' : mode === 'skip-permissions' ? 'skip-permissions' : 'safe'}
              tabMode="jarvis"
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
        <div className="border-b border-white/5 bg-surface/50 backdrop-blur-sm">
          {/* Row 1: Hamburger + Title + Connection badge */}
          <div className="flex items-center gap-2 px-4 py-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 md:p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
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
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50 hidden sm:flex"
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

            {/* CLI Connection — instance tabs (multi) or single badge */}
            {instances.length > 1 ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                {instances.map(inst => {
                  const isActive = isConnected && inst.port === connectedPort;
                  return (
                    <button
                      key={inst.port}
                      onClick={() => {
                        if (!isActive) handleInstanceSwitch(inst);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] border transition-all ${
                        isActive
                          ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                          : 'bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10 cursor-pointer'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
                      <Terminal size={10} />
                      <span className="max-w-[80px] truncate hidden sm:inline">{inst.meta.projectName}</span>
                      <span className="text-gray-600">:{inst.port}</span>
                    </button>
                  );
                })}
              </div>
            ) : isConnected && connection.instanceMeta ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] bg-emerald-500/5 border border-emerald-500/10 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <Wifi size={11} className="text-emerald-400 hidden sm:block" />
                  <span className="text-emerald-400 font-medium hidden sm:inline">HelixMind</span>
                  <span className="text-gray-600 hidden sm:inline">:{connectedPort}</span>
                </div>
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
                          onClick={() => { handleInstanceSwitch(inst); setShowConnectPopover(false); }}
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

          {/* Fullscreen chat button */}
          <button
            onClick={() => setIsFullscreenChat(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors sm:block"
            title={t('fullscreenChat') ?? 'Fullscreen Chat'}
          >
            <Maximize2 size={18} />
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

          {/* Row 2: Tab switcher — always visible so users can see in-tab explanations */}
            <div className="flex gap-0.5 px-4 py-1.5 overflow-x-auto scrollbar-none flex-nowrap">
              <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                    activeTab === 'chat' ? TAB_COLORS.chat.active : TAB_COLORS.chat.inactive
                  }`}
                >
                  <MessageSquare size={11} />
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
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
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
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
                    if (isConnected) {
                      connection.listJarvisTasks().catch(() => {});
                      connection.getJarvisStatus().catch(() => {});
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
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
            </div>
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
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-red-500/5 border-red-500/15 text-red-400/80 hover:bg-red-500/10'
                }`}
              >
                <Bot size={10} className="text-red-400" />
                <span className="font-medium">Jarvis</span>
                <span className={`text-[9px] px-1 rounded-full ${
                  connection.jarvisStatus.thinkingPhase === 'deep' ? 'bg-red-500/20' :
                  connection.jarvisStatus.thinkingPhase === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {connection.jarvisStatus.thinkingPhase ?? 'idle'}
                </span>
                <Activity size={8} className="text-red-400 animate-pulse" />
                {connection.jarvisStatus.pendingCount > 0 && (
                  <span className="text-red-400/60">{connection.jarvisStatus.pendingCount} tasks</span>
                )}
              </button>
            )}
            {activeSessions.map((session) => {
              const sessionTab = getSessionTab(session.name, jName);
              const pillColor = sessionTab === 'monitor'
                ? { active: 'bg-blue-500/10 border-blue-500/20 text-blue-400', idle: 'bg-blue-500/5 border-blue-500/15 text-blue-400/80 hover:bg-blue-500/10' }
                : { active: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', idle: 'bg-white/5 border-white/10 text-gray-300 hover:bg-emerald-500/5 hover:border-emerald-500/10' };
              const isActive = (sessionTab === 'console' && consoleSessionId === session.id && activeTab === 'console')
                || (sessionTab === 'monitor' && monitorSessionId === session.id && activeTab === 'monitor');
              return (
              <button
                key={session.id}
                onClick={() => openSessionInTab(session.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border flex-shrink-0 transition-all ${
                  isActive ? pillColor.active : pillColor.idle
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
              );
            })}
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
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* CLI active session indicator */}
            {isConnected && (
              <div className="flex items-center gap-2 px-4 py-1 bg-emerald-500/[0.03] border-b border-emerald-500/10 flex-shrink-0">
                <Activity size={8} className="text-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400">{connection.instanceMeta?.projectName || ''}</span>
                <span className="text-[9px] text-gray-600 ml-auto">{mode === 'yolo' ? 'YOLO' : mode === 'skip-permissions' ? 'Skip' : 'Safe'}</span>
              </div>
            )}
            {/* Always show ChatView — structured messages, not raw terminal */}
            <div className="flex-1 overflow-hidden">
              <ChatView
                messages={[...(activeChat?.messages || []), ...cliOutputMessages]}
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
                pendingPermissions={connection.pendingPermissions}
                onApprovePermission={(id, mode) => connection.respondPermission(id, true, mode)}
                onDenyPermission={(id) => connection.respondPermission(id, false)}
                instanceMeta={connection.instanceMeta}
                connectedPort={connectedPort}
                cliOutputLines={cliOutput.lines}
                onStop={handleStop}
                tabColor={activeTab as 'chat' | 'console' | 'monitor' | 'jarvis'}
                activeSessions={activeSessions.map(s => ({ id: s.id, name: s.name, status: s.status }))}
              />
            </div>
          </div>
        ) : activeTab === 'console' ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Running session stop header */}
            {consoleSessionId && (() => {
              const s = consoleSessions.find(cs => cs.id === consoleSessionId);
              return s?.status === 'running' ? (
                <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity size={12} className="text-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-gray-300">{s.name}</span>
                    <span className="text-[10px] text-gray-500">{formatUptime(Math.floor(s.elapsed / 1000))}</span>
                  </div>
                  <button
                    onClick={() => handleAbortSession(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    <Square size={12} />
                    Stop
                  </button>
                </div>
              ) : null;
            })()}
            {consoleSessionId ? (
              <div className="flex-1 min-h-0">
                <TerminalViewer lines={cliOutput.lines} fullHeight />
              </div>
            ) : activeChatId ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-500">{t('consoleCompactHint')}</p>
              </div>
            ) : (
              <TabInfoPage
                title={t('consoleInfoTitle')}
                description={t('consoleInfoDesc')}
                accentColor="cyan"
                docsHref="/docs/console"
                docsLabel={t('consoleInfoDocs')}
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
          /* ─── Monitor Tab — Split: Status/Threats top, Terminal bottom ─── */
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Top: Status + Threats (scrollable, capped when terminal visible) */}
            <div className={`${monitorSessionId ? 'flex-shrink-0 max-h-[50%]' : 'flex-1'} overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent`}>
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      <Square size={12} />
                      {t('monitorStop')}
                    </button>
                  </div>
                ) : activeChatId ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-gray-500">{t('monitorCompactHint')}</p>
                  </div>
                ) : (
                  <TabInfoPage
                    title={t('monitorInfoTitle')}
                    description={t('monitorInfoDesc')}
                    accentColor="blue"
                    docsHref="/docs/monitor"
                    docsLabel={t('monitorInfoDocs')}
                    features={[
                      { icon: <Eye size={16} />, title: t('monitorInfoFeature1Title'), description: t('monitorInfoFeature1Desc') },
                      { icon: <Shield size={16} />, title: t('monitorInfoFeature2Title'), description: t('monitorInfoFeature2Desc') },
                      { icon: <ShieldAlert size={16} />, title: t('monitorInfoFeature3Title'), description: t('monitorInfoFeature3Desc') },
                    ]}
                    actions={isConnected ? (
                      <>
                        <button onClick={() => handleStartMonitor('passive')} className="px-3 py-2 rounded-lg text-xs text-gray-300 bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400 transition-all">
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
            {/* Bottom: Terminal output */}
            {monitorSessionId && (
              <div className="flex-1 min-h-0 border-t border-white/5">
                <TerminalViewer lines={cliOutput.lines} fullHeight />
              </div>
            )}
          </div>
        ) : activeTab === 'jarvis' ? (
          /* ─── Jarvis Tab ─── */
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Compact control bar */}
            {isConnected && connection.jarvisStatus && connection.jarvisStatus.daemonState !== 'stopped' && (() => {
              const jStatus = connection.jarvisStatus!;
              const jRunning = jStatus.daemonState === 'running';
              const jPaused = jStatus.daemonState === 'paused';
              const jPhase = jStatus.thinkingPhase ?? 'idle';
              const PB: Record<string, { color: string; label: string }> = {
                idle: { color: 'text-gray-500 bg-gray-500/10', label: 'Idle' },
                quick: { color: 'text-cyan-400 bg-cyan-500/10', label: 'Quick' },
                medium: { color: 'text-amber-400 bg-amber-500/10', label: 'Medium' },
                deep: { color: 'text-red-400 bg-red-500/10', label: 'Deep' },
              };
              const pb = PB[jPhase] ?? PB.idle;
              return (
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.02] flex-wrap">
                  <Bot size={14} className={jRunning ? 'text-red-400 animate-pulse' : 'text-gray-400'} />
                  <span className="text-xs font-medium text-gray-300">
                    {jStatus.jarvisName || 'Jarvis'}:
                    <span className={jRunning ? ' text-red-400' : ' text-gray-500'}>
                      {' '}{jRunning ? 'Running' : jPaused ? 'Paused' : jStatus.daemonState}
                    </span>
                  </span>
                  {jRunning && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${pb.color}`}>
                      <Brain size={8} className="inline mr-0.5" />
                      {pb.label}
                    </span>
                  )}
                  {jStatus.autonomyLevel !== undefined && (
                    <AutonomyPicker level={jStatus.autonomyLevel} onSet={(lvl) => connection.setAutonomyLevel(lvl).catch(() => {})} />
                  )}
                  {jStatus.pendingCount > 0 && (
                    <span className="text-[9px] text-gray-500">{jStatus.pendingCount} pending</span>
                  )}
                  {(jStatus.activeWorkers ?? 0) > 0 && (
                    <span className="text-[9px] text-gray-500">{jStatus.activeWorkers} workers</span>
                  )}
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    {jRunning && (
                      <button
                        onClick={() => connection.triggerDeepThink().catch(() => {})}
                        className="px-2 py-1 rounded-md text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        <Sparkles size={10} className="inline mr-0.5" />
                        Think
                      </button>
                    )}
                    {jRunning ? (
                      <button
                        onClick={() => connection.pauseJarvis().catch(() => {})}
                        className="px-2 py-1 rounded-md text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                      >
                        <Pause size={10} className="inline mr-0.5" />
                        Pause
                      </button>
                    ) : jPaused ? (
                      <button
                        onClick={() => connection.resumeJarvis().catch(() => {})}
                        className="px-2 py-1 rounded-md text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        <Play size={10} className="inline mr-0.5" />
                        Resume
                      </button>
                    ) : null}
                    <button
                      onClick={() => connection.stopJarvis().catch(() => {})}
                      className="px-2 py-1 rounded-md text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      <Square size={10} className="inline mr-0.5" />
                      Stop
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Main content area */}
            {jarvisSessionIdForOutput ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Terminal output */}
                <div className="flex-1 min-h-0">
                  <TerminalViewer lines={cliOutput.lines} fullHeight />
                </div>
              </div>
            ) : (
              /* No active Jarvis session — show info page */
              <div className="flex-1 overflow-y-auto">
                {activeChatId ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <p className="text-sm text-gray-500">{t('jarvisCompactHint')}</p>
                  </div>
                ) : (
                  <TabInfoPage
                    title={t('jarvisInfoTitle')}
                    description={t('jarvisInfoDesc')}
                    accentColor="red"
                    docsHref="/docs/jarvis"
                    docsLabel={t('jarvisInfoDocs')}
                    features={[
                      { icon: <Zap size={16} />, title: t('jarvisInfoFeature1Title'), description: t('jarvisInfoFeature1Desc') },
                      { icon: <Brain size={16} />, title: t('jarvisInfoFeature2Title'), description: t('jarvisInfoFeature2Desc') },
                      { icon: <Users size={16} />, title: t('jarvisInfoFeature3Title'), description: t('jarvisInfoFeature3Desc') },
                    ]}
                    actions={
                      isConnected ? (
                        <button
                          onClick={() => connection.startJarvis().catch(() => {})}
                          className="px-4 py-2 rounded-lg text-sm text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                          <Play size={14} className="inline mr-1.5" />
                          {t('jarvisStart')}
                        </button>
                      ) : undefined
                    }
                  />
                )}
              </div>
            )}

            {/* Bottom panel: Proposals + Consciousness — stable slot */}
            <div className={showJarvisPanel ? 'flex-shrink-0 px-4 pt-2 border-t border-white/5 bg-surface/50 backdrop-blur-sm' : 'hidden'}>
              {showJarvisPanel && (
                <JarvisBottomPanel
                  proposals={connection.proposals}
                  thinkingUpdates={connection.thinkingUpdates}
                  consciousnessEvents={connection.consciousnessEvents}
                  identity={connection.identity}
                  autonomyLevel={connection.autonomyLevel}
                  isConnected={isConnected}
                  onApproveProposal={(id) => connection.approveProposal(id).catch(() => {})}
                  onDenyProposal={(id, reason) => connection.denyProposal(id, reason).catch(() => {})}
                  onClose={() => setShowJarvisPanel(false)}
                />
              )}
            </div>

            {/* Permission cards — stable slot */}
            <div className={connection.pendingPermissions.length > 0 ? 'flex-shrink-0 px-4 pt-2 border-t border-white/5 bg-surface/50 backdrop-blur-sm' : 'hidden'}>
              <div className="max-w-3xl mx-auto space-y-2 max-h-[40vh] overflow-y-auto">
                {connection.pendingPermissions.map((perm) => (
                  <PermissionRequestCard
                    key={perm.id}
                    request={perm}
                    onApprove={(mode) => connection.respondPermission(perm.id, true, mode)}
                    onDeny={() => connection.respondPermission(perm.id, false)}
                  />
                ))}
              </div>
            </div>

            {/* Jarvis action button — stable slot */}
            <div className={isConnected && !jarvisSessionIdForOutput && connection.jarvisStatus?.daemonState !== 'running' ? 'flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 border-t border-white/5 bg-surface/30' : 'hidden'}>
              <button
                onClick={() => connection.startJarvis().catch(() => {})}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all"
              >
                <Play size={12} />{t('jarvisStart')}
              </button>
            </div>

            {/* Jarvis Tasks — stable slot */}
            <div className={connection.jarvisTasks.length > 0 ? 'flex-shrink-0 px-4 pt-2 pb-1 border-t border-white/5 bg-surface/30' : 'hidden'}>
              <JarvisTaskList
                tasks={connection.jarvisTasks}
                isConnected={isConnected}
                onAddTask={(title, desc, pri) => connection.addJarvisTask(title, desc, pri).catch(() => {})}
                onDeleteTask={(taskId) => connection.deleteJarvisTask(taskId).catch(() => {})}
              />
            </div>

            {/* Embedded input — stable slot, never unmounts */}
            <div className="flex-shrink-0 relative">
              <ChatInput
                onSend={sendMessage}
                onSendWithFiles={handleSendWithFiles}
                isAgentRunning={isAgentRunning}
                onStop={handleStop}
                mode={mode}
                onModeChange={setMode}
                disabled={!isConnected && !hasLLMKey}
                hasLLMKey={isConnected || hasLLMKey}
                hasChat={true}
                isConnected={isConnected}
                activeTab="jarvis"
                tabColor="jarvis"
              />
            </div>
          </div>
        ) : null}

        {/* CLI Status Bar — visible when connected and status data available */}
        {activeTab === 'chat' && isConnected && connection.statusBar && (
          <CliStatusBar
            statusBar={connection.statusBar}
            checkpointCount={connection.checkpoints.length}
            isWorking={isAgentRunning}
            liveLines={cliOutput.lines}
            onSendChat={sendMessage}
            onCheckpointClick={() => {
              setShowCheckpoints(prev => !prev);
              connection.listCheckpoints().catch(() => {});
            }}
          />
        )}

        {/* Checkpoint browser panel */}
        {activeTab === 'chat' && showCheckpoints && (
          <div className="border-t border-white/5">
            <CheckpointBrowser
              checkpoints={connection.checkpoints}
              onRevert={(id, revertMode) => {
                connection.revertToCheckpoint(id, revertMode).catch(() => {});
              }}
              onClose={() => setShowCheckpoints(false)}
            />
          </div>
        )}

        {/* Bug panel — sticky above input, visible in chat tab */}
        {activeTab === 'chat' && showBugPanel && (
          <div className="px-4 pt-2 border-t border-white/5 bg-surface/50 backdrop-blur-sm">
            <InlineBugPanel
              bugs={connection.bugs}
              isConnected={isConnected}
              onFixBug={handleFixBug}
              onFixAll={handleFixAllBugs}
              onDeleteBug={handleDeleteBug}
              onClose={() => setShowBugPanel(false)}
            />
          </div>
        )}

        {/* Permission cards — visible above input in ALL non-Jarvis tabs */}
        {activeTab !== 'jarvis' && connection.pendingPermissions.length > 0 && (
          <div className="px-4 pt-2 border-t border-white/5 bg-surface/50 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto space-y-2 max-h-[40vh] overflow-y-auto">
              {connection.pendingPermissions.map((perm) => (
                <PermissionRequestCard
                  key={perm.id}
                  request={perm}
                  onApprove={() => connection.respondPermission(perm.id, true)}
                  onDeny={() => connection.respondPermission(perm.id, false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tab action bar — quick actions above input when no session active */}
        {isConnected && activeTab === 'console' && !consoleSessionId && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-white/5 bg-surface/30">
            <button onClick={() => handleStartAuto()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 transition-all">
              <Zap size={12} />Auto
            </button>
            <button onClick={handleStartSecurity} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition-all">
              <Shield size={12} />Security
            </button>
            <button onClick={() => { connection.startJarvis().catch(() => {}); setActiveTab('jarvis'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all">
              <Bot size={12} />Jarvis
            </button>
          </div>
        )}
        {isConnected && activeTab === 'monitor' && !connection.monitorStatus && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-white/5 bg-surface/30">
            <button onClick={() => handleStartMonitor('passive')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400 transition-all">
              <Eye size={12} />{t('monitorStartPassive')}
            </button>
            <button onClick={() => handleStartMonitor('defensive')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400 transition-all">
              <Shield size={12} />{t('monitorStartDefensive')}
            </button>
            <button onClick={() => handleStartMonitor('active')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all">
              <ShieldAlert size={12} />{t('monitorStartActive')}
            </button>
          </div>
        )}

        {/* Input — visible on chat/console/monitor tabs (Jarvis has its own embedded input) */}
        {activeTab !== 'jarvis' && (
          <div>
            {/* Bug toggle button — inline above input, right-aligned */}
            {isConnected && activeTab === 'chat' && (
              <div className="flex justify-end px-4 pb-1">
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
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              onSendWithFiles={handleSendWithFiles}
              isAgentRunning={isAgentRunning}
              onStop={handleStop}
              mode={mode}
              onModeChange={setMode}
              disabled={!isConnected && !hasLLMKey}
              hasLLMKey={isConnected || hasLLMKey}
              hasChat={!!activeChat}
              isConnected={isConnected}
              activeTab={activeTab}
              onSwitchTab={(tab) => setActiveTab(tab)}
              activeCliModes={{
                console: consoleSessions.some(s => s.status === 'running'),
                monitor: monitorSessions.some(s => s.status === 'running'),
                jarvis: connection.jarvisStatus?.daemonState === 'running',
              }}
              tabColor={activeTab as 'chat' | 'console' | 'monitor' | 'jarvis'}
              voiceState={voice.voiceState}
              onToggleVoice={voice.toggleVoice}
              audioLevel={voice.audioLevel}
            />
          </div>
        )}
      </div>

      {/* Fullscreen Chat Overlay */}
      {isFullscreenChat && createPortal(
        <div className="fixed inset-0 z-50 bg-[#050510] flex flex-col">
          {/* Minimal header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 flex-shrink-0">
            <span className="text-xs font-medium text-gray-400 font-mono">
              {connection.instanceMeta?.projectName || 'HelixMind'}
            </span>
            <button
              onClick={() => setIsFullscreenChat(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Minimize2 size={18} />
            </button>
          </div>
          {/* Chat fills remaining space */}
          <div className="flex-1 overflow-hidden">
            <ChatView
              messages={[...(activeChat?.messages || []), ...cliOutputMessages]}
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
              pendingPermissions={connection.pendingPermissions}
              onApprovePermission={(id, pMode) => connection.respondPermission(id, true, pMode)}
              onDenyPermission={(id) => connection.respondPermission(id, false)}
              instanceMeta={connection.instanceMeta}
              connectedPort={connectedPort}
              cliOutputLines={cliOutput.lines}
              onStop={handleStop}
              tabColor="chat"
            />
          </div>
          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            onSendWithFiles={handleSendWithFiles}
            isAgentRunning={isAgentRunning}
            onStop={handleStop}
            mode={mode}
            onModeChange={setMode}
            disabled={!isConnected && !hasLLMKey}
            hasLLMKey={isConnected || hasLLMKey}
            hasChat={!!activeChat}
            isConnected={isConnected}
            activeTab="chat"
            tabColor="chat"
            voiceState={voice.voiceState}
            onToggleVoice={voice.toggleVoice}
            audioLevel={voice.audioLevel}
          />
        </div>,
        document.body
      )}

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
        onConnect={(inst) => { handleInstanceSwitch(inst); setShowSpawnDialog(false); }}
      />

      {/* Connection toast notification */}
      {cliToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-medium shadow-lg backdrop-blur-md">
            <Wifi size={14} />
            {cliToast}
          </div>
        </div>
      )}

      {/* Brain 3D Overlay — portal to body, supports full / minimized / hidden */}
      {/* Uses iframe when local HTTP, BrainOverlay with search/filter when HTTPS/relay */}
      {brainOverlayState !== 'hidden' && isConnected && typeof document !== 'undefined' && createPortal(
        brainOverlayState === 'full' ? (
          canUseIframe ? (
            <div className="fixed inset-0 z-[70] bg-black">
              <div className="relative w-full h-full">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                  <button
                    onClick={() => setBrainOverlayState('minimized')}
                    className="w-10 h-10 rounded-full bg-black/60 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                    title="Minimize"
                  >
                    <Minimize2 size={16} />
                  </button>
                  <button
                    onClick={() => setBrainOverlayState('hidden')}
                    className="w-10 h-10 rounded-full bg-black/60 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
                {/* Project info overlay */}
                <div className="absolute top-4 left-4 z-10">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-sm">
                    <Brain size={14} className="text-purple-400" />
                    <span className="text-xs font-mono text-gray-300">{connection.instanceMeta?.projectName || 'Brain'}</span>
                  </div>
                </div>
                <iframe
                  src={`http://127.0.0.1:${connectedPort}`}
                  className="w-full h-full border-0 bg-black"
                  title="HelixMind Brain"
                />
              </div>
            </div>
          ) : (
            <BrainOverlay
              onClose={() => setBrainOverlayState('hidden')}
              onMinimize={() => setBrainOverlayState('minimized')}
            />
          )
        ) : (
          /* Minimized: small preview window bottom-right — offset above status bar */
          <div
            className="fixed bottom-16 right-4 z-[60] w-[220px] h-[150px] rounded-xl overflow-hidden border border-white/10 shadow-2xl cursor-pointer group"
            onClick={() => setBrainOverlayState('full')}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setBrainOverlayState('hidden'); }}
              className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/10 text-gray-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            >
              <X size={12} />
            </button>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-[5] pointer-events-none" />
            <div className="absolute bottom-1.5 left-2 z-[6] flex items-center gap-1 pointer-events-none">
              <Brain size={10} className="text-purple-400/60" />
              <span className="text-[9px] text-gray-500 font-mono">Brain</span>
            </div>
            {canUseIframe ? (
              <iframe
                src={`http://127.0.0.1:${connectedPort}`}
                className="w-full h-full border-0 bg-black pointer-events-none"
                title="HelixMind Brain Mini"
                tabIndex={-1}
              />
            ) : (
              <div className="w-full h-full bg-black relative">
                <BrainCanvas voiceState={voice.voiceState} audioLevel={voice.audioLevel} />
              </div>
            )}
          </div>
        ),
        document.body,
      )}
    </div>
  );
}
