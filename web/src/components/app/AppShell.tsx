'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChatSidebar } from './ChatSidebar';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { BrainOverlay } from './BrainOverlay';
import { useCliContext } from './CliConnectionProvider';
import { Brain, PanelLeftClose, PanelLeft, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

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
  const { connection, chat: cliChat } = useCliContext();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatFull | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [brainOpen, setBrainOpen] = useState(false);
  const [mode, setMode] = useState<'normal' | 'skip-permissions'>('normal');

  const isConnected = connection.connectionState === 'connected';
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
    if (!activeChatId || !content.trim()) return;

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chatId: activeChatId,
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
      await fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: content.trim() }),
      });
    } catch { /* silent */ }

    // Send to CLI via WebSocket
    if (isConnected) {
      cliChat.sendMessage(content.trim(), activeChatId);
    }
  }, [activeChatId, isConnected, cliChat]);

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
        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelect={handleChatSelect}
          onCreate={createChat}
          onDelete={deleteChat}
          onRename={renameChat}
        />
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
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-200 truncate">
              {activeChat?.title || t('noMessages')}
            </h2>
          </div>

          {/* CLI Connection indicator */}
          {isConnected ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10">
              <Wifi size={12} />
              {t('cliConnected')}
            </div>
          ) : (
            <Link
              href="/dashboard/cli"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-gray-500 bg-white/5 border border-white/5 hover:text-gray-300 hover:border-white/10 transition-colors"
            >
              <WifiOff size={12} />
              {t('cliDisconnected')}
            </Link>
          )}

          <button
            onClick={() => setBrainOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5 transition-colors"
            title={t('brain')}
          >
            <Brain size={18} />
          </button>
        </div>

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
          disabled={!activeChat}
          isConnected={isConnected}
        />
      </div>

      {/* Brain overlay */}
      {brainOpen && <BrainOverlay onClose={() => setBrainOpen(false)} />}
    </div>
  );
}
