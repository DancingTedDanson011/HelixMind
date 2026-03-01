'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus, Trash2, Pencil, MessageSquare, Check, X, XCircle,
  Shield, Zap, Activity, Bot,
} from 'lucide-react';
import type { ChatSummary } from './AppShell';

/* ─── Session info (matches cli-types) ─────── */

interface SessionEntry {
  id: string;
  name: string;
  status: string;
  elapsed: number;
}

/* ─── Unified sidebar item ───────────────────── */

type SidebarItem =
  | { kind: 'chat'; chat: ChatSummary }
  | { kind: 'session'; session: SessionEntry };

/* ─── Session helpers ────────────────────────── */

function isJarvisSession(name: string, jarvisName?: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('jarvis')) return true;
  if (jarvisName && lower.includes(jarvisName.toLowerCase())) return true;
  return false;
}

function sessionModeColor(name: string, jarvisName?: string): { bg: string; text: string; border: string } {
  const lower = name.toLowerCase();
  if (lower.includes('security') || lower.includes('audit') || lower.includes('auto'))
    return { bg: 'bg-cyan-500/5', text: 'text-cyan-400', border: 'border-cyan-500/10' };
  if (lower.includes('monitor'))
    return { bg: 'bg-purple-500/5', text: 'text-purple-400', border: 'border-purple-500/10' };
  if (isJarvisSession(name, jarvisName))
    return { bg: 'bg-fuchsia-500/5', text: 'text-fuchsia-400', border: 'border-fuchsia-500/10' };
  return { bg: 'bg-white/[0.03]', text: 'text-gray-300', border: 'border-white/5' };
}

function SessionIcon({ name, jarvisName, size = 12, className = '' }: { name: string; jarvisName?: string; size?: number; className?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('security') || lower.includes('audit')) return <Shield size={size} className={className} />;
  if (lower.includes('auto')) return <Zap size={size} className={className} />;
  if (lower.includes('monitor')) return <Activity size={size} className={className} />;
  if (isJarvisSession(name, jarvisName)) return <Bot size={size} className={className} />;
  return <MessageSquare size={size} className={className} />;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/* ─── Props ──────────────────────────────────── */

interface ChatSidebarProps {
  chats: ChatSummary[];
  sessions?: SessionEntry[];
  jarvisName?: string;
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onSessionClick?: (sessionId: string) => void;
  onSessionDismiss?: (sessionId: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function ChatSidebar({
  chats,
  sessions,
  jarvisName,
  activeChatId,
  onSelect,
  onSessionClick,
  onSessionDismiss,
  onCreate,
  onDelete,
  onRename,
}: ChatSidebarProps) {
  const t = useTranslations('app');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startRename = (chat: ChatSummary) => {
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const confirmDelete = (id: string) => {
    onDelete(id);
    setDeletingId(null);
  };

  // Merge sessions into the unified timeline
  const visibleSessions = sessions?.filter(s => s.id !== 'main') ?? [];
  const grouped = groupByDateWithSessions(chats, visibleSessions);

  return (
    <div className="flex flex-col h-full w-72">
      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:border-white/20 transition-all"
        >
          <Plus size={16} />
          {t('newChat')}
        </button>
      </div>

      {/* Unified list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {grouped.map(({ label, items }) => (
          <div key={label}>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              {label}
            </div>
            <div className="space-y-0.5">
              {items.map((item) =>
                item.kind === 'session' ? (
                  <SessionItem
                    key={`session-${item.session.id}`}
                    session={item.session}
                    jarvisName={jarvisName}
                    onClick={() => onSessionClick?.(item.session.id)}
                    onDismiss={onSessionDismiss ? () => onSessionDismiss(item.session.id) : undefined}
                  />
                ) : (
                  <ChatItem
                    key={`chat-${item.chat.id}`}
                    chat={item.chat}
                    isActive={activeChatId === item.chat.id}
                    editingId={editingId}
                    editTitle={editTitle}
                    deletingId={deletingId}
                    onSelect={() => onSelect(item.chat.id)}
                    onStartRename={() => startRename(item.chat)}
                    onConfirmRename={confirmRename}
                    onCancelRename={() => setEditingId(null)}
                    onEditTitleChange={setEditTitle}
                    onStartDelete={() => setDeletingId(item.chat.id)}
                    onConfirmDelete={() => confirmDelete(item.chat.id)}
                    onCancelDelete={() => setDeletingId(null)}
                    t={t}
                  />
                ),
              )}
            </div>
          </div>
        ))}

        {chats.length === 0 && visibleSessions.length === 0 && (
          <div className="text-center text-gray-600 text-xs py-8">
            {t('noMessages')}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Session item ───────────────────────────── */

function SessionItem({ session, jarvisName, onClick, onDismiss }: { session: SessionEntry; jarvisName?: string; onClick: () => void; onDismiss?: () => void }) {
  const colors = sessionModeColor(session.name, jarvisName);
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`
          w-full text-left px-3 py-2 rounded-lg text-sm transition-all
          ${colors.bg} ${colors.border} border hover:brightness-125
        `}
      >
        <div className="flex items-center gap-2">
          <SessionIcon name={session.name} jarvisName={jarvisName} size={14} className={`flex-shrink-0 ${colors.text}`} />
          <div className="flex-1 min-w-0">
            <div className={`truncate text-xs font-medium ${colors.text}`}>
              {session.name}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {session.status === 'running' && (
              <Activity size={8} className="text-emerald-400 animate-pulse" />
            )}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
              session.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' :
              session.status === 'done' ? 'bg-emerald-500/5 text-emerald-500' :
              session.status === 'error' ? 'bg-red-500/5 text-red-400' :
              'bg-white/5 text-gray-500'
            }`}>
              {session.status === 'running' ? formatElapsed(session.elapsed) : session.status}
            </span>
          </div>
        </div>
      </button>

      {/* Dismiss button for non-running sessions */}
      {onDismiss && session.status !== 'running' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Dismiss"
        >
          <XCircle size={12} />
        </button>
      )}
    </div>
  );
}

/* ─── Chat item ──────────────────────────────── */

function ChatItem({
  chat, isActive, editingId, editTitle, deletingId,
  onSelect, onStartRename, onConfirmRename, onCancelRename, onEditTitleChange,
  onStartDelete, onConfirmDelete, onCancelDelete, t,
}: {
  chat: ChatSummary;
  isActive: boolean;
  editingId: string | null;
  editTitle: string;
  deletingId: string | null;
  onSelect: () => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onEditTitleChange: (v: string) => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  t: (key: string) => string;
}) {
  if (editingId === chat.id) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirmRename();
            if (e.key === 'Escape') onCancelRename();
          }}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
          autoFocus
        />
        <button onClick={onConfirmRename} className="p-1 text-green-400 hover:text-green-300">
          <Check size={14} />
        </button>
        <button onClick={onCancelRename} className="p-1 text-gray-500 hover:text-gray-300">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (deletingId === chat.id) {
    return (
      <div className="px-2 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
        <p className="text-xs text-red-400 mb-2">{t('confirmDelete')}</p>
        <div className="flex gap-1">
          <button
            onClick={onConfirmDelete}
            className="flex-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            {t('deleteChat')}
          </button>
          <button
            onClick={onCancelDelete}
            className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={`
          w-full text-left px-3 py-2 rounded-lg text-sm transition-all border-l-2
          ${isActive
            ? 'bg-cyan-500/10 text-white border-cyan-400'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border-transparent hover:border-cyan-400/30'
          }
        `}
      >
        <div className="flex items-start gap-2">
          <MessageSquare size={14} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'opacity-40'}`} />
          <div className="flex-1 min-w-0">
            <div className="truncate text-xs font-medium">
              {chat.title}
            </div>
            {chat.messages[0] && (
              <div className="truncate text-[11px] text-gray-600 mt-0.5">
                {chat.messages[0].content.slice(0, 60)}
              </div>
            )}
          </div>
        </div>

        {/* Hover actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            title={t('renameChat')}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStartDelete(); }}
            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={t('deleteChat')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </button>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────── */

function groupByDateWithSessions(
  chats: ChatSummary[],
  sessions: SessionEntry[],
): { label: string; items: SidebarItem[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: { label: string; items: SidebarItem[] }[] = [];
  const todayItems: SidebarItem[] = [];
  const yesterdayItems: SidebarItem[] = [];
  const olderItems: SidebarItem[] = [];

  // Sessions are always "now" — they go to Today, running first
  const running = sessions.filter(s => s.status === 'running');
  const done = sessions.filter(s => s.status !== 'running');
  for (const s of [...running, ...done]) {
    todayItems.push({ kind: 'session', session: s });
  }

  // Chats sorted into date buckets
  for (const chat of chats) {
    const chatDate = new Date(chat.updatedAt);
    if (chatDate >= today) {
      todayItems.push({ kind: 'chat', chat });
    } else if (chatDate >= yesterday) {
      yesterdayItems.push({ kind: 'chat', chat });
    } else {
      olderItems.push({ kind: 'chat', chat });
    }
  }

  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (olderItems.length > 0) groups.push({ label: 'Previous', items: olderItems });

  return groups;
}
