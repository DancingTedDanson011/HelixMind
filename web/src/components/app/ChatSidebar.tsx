'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Pencil, MessageSquare, Check, X } from 'lucide-react';
import type { ChatSummary } from './AppShell';

interface ChatSidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: ChatSidebarProps) {
  const t = useTranslations('app');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group chats by date
  const grouped = groupByDate(chats);

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

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {grouped.map(({ label, items }) => (
          <div key={label}>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              {label}
            </div>
            <div className="space-y-0.5">
              {items.map((chat) => (
                <div key={chat.id} className="group relative">
                  {editingId === chat.id ? (
                    /* Rename mode */
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-500/50"
                        autoFocus
                      />
                      <button onClick={confirmRename} className="p-1 text-green-400 hover:text-green-300">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:text-gray-300">
                        <X size={14} />
                      </button>
                    </div>
                  ) : deletingId === chat.id ? (
                    /* Delete confirmation */
                    <div className="px-2 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                      <p className="text-xs text-red-400 mb-2">{t('confirmDelete')}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => confirmDelete(chat.id)}
                          className="flex-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          {t('deleteChat')}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 rounded text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal chat item */
                    <button
                      onClick={() => onSelect(chat.id)}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg text-sm transition-all
                        ${activeChatId === chat.id
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }
                      `}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare size={14} className="mt-0.5 flex-shrink-0 opacity-40" />
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
                          onClick={(e) => { e.stopPropagation(); startRename(chat); }}
                          className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                          title={t('renameChat')}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(chat.id); }}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={t('deleteChat')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {chats.length === 0 && (
          <div className="text-center text-gray-600 text-xs py-8">
            {t('noMessages')}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────── */

function groupByDate(chats: ChatSummary[]): { label: string; items: ChatSummary[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: { label: string; items: ChatSummary[] }[] = [];
  const todayItems: ChatSummary[] = [];
  const yesterdayItems: ChatSummary[] = [];
  const olderItems: ChatSummary[] = [];

  for (const chat of chats) {
    const chatDate = new Date(chat.updatedAt);
    if (chatDate >= today) {
      todayItems.push(chat);
    } else if (chatDate >= yesterday) {
      yesterdayItems.push(chat);
    } else {
      olderItems.push(chat);
    }
  }

  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (olderItems.length > 0) groups.push({ label: 'Previous', items: olderItems });

  return groups;
}
