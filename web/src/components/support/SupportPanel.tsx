'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  HeadphonesIcon, MessageSquare, Send,
  User, Clock, Hash,
  ChevronDown, Inbox, Filter,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string };
  _count?: { messages: number };
  messages?: TicketMessage[];
}

interface TicketMessage {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: { name: string | null; role: string };
}

// ─── Constants ──────────────────────────────────

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  OPEN: 'primary',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const priorityColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
};

const statusOptions = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// ─── Helper ─────────────────────────────────────

function formatRelativeDate(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ──────────────────────────────────

export function SupportPanel() {
  const t = useTranslations('support_panel');
  const tAdmin = useTranslations('admin');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const statusFilters = [
    { value: '', label: tAdmin('ticketManagement.all') },
    { value: 'OPEN', label: tAdmin('ticketManagement.open') },
    { value: 'IN_PROGRESS', label: tAdmin('ticketManagement.inProgress') },
    { value: 'RESOLVED', label: tAdmin('ticketManagement.resolved') },
    { value: 'CLOSED', label: tAdmin('ticketManagement.closed') },
  ];

  // ─── Fetch Logic ───────────────────────

  const fetchTickets = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/tickets?${params}`);
      const data = await res.json();
      let filtered = data.tickets || [];
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (ticket: Ticket) =>
            ticket.subject.toLowerCase().includes(q) ||
            ticket.user.email.toLowerCase().includes(q) ||
            ticket.user.name?.toLowerCase().includes(q) ||
            `#${ticket.number}`.includes(q),
        );
      }
      setTickets(filtered);
    } catch {
      // Keep state
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, searchQuery]);

  // ─── Ticket Actions ───────────────────

  const openTicket = async (ticketId: string) => {
    const res = await fetch('/api/admin/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticketId }),
    });
    const ticket = await res.json();
    setSelectedTicket(ticket);
  };

  const updateStatus = async (status: string) => {
    if (!selectedTicket) return;
    const res = await fetch('/api/admin/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedTicket.id, status }),
    });
    setSelectedTicket(await res.json());
    setStatusDropdownOpen(false);
    fetchTickets();
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSending(true);
    const res = await fetch('/api/admin/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedTicket.id,
        message: reply,
        isInternal,
      }),
    });
    setSelectedTicket(await res.json());
    setReply('');
    setIsInternal(false);
    setSending(false);
    fetchTickets();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendReply();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Layout ───────────────────────────

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/20">
            <HeadphonesIcon size={22} className="text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-xs text-gray-500">{t('subtitle')}</p>
          </div>
        </motion.div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left Sidebar: Ticket List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <GlassPanel className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full rounded-lg border border-white/10 bg-surface pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 hover:border-white/20"
                />
              </div>

              {/* Status filter */}
              <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                {statusFilters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                      statusFilter === f.value
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'text-gray-500 hover:text-white border border-transparent hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Ticket list */}
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {tickets.map((ticket, index) => {
                    const isSelected = selectedTicket?.id === ticket.id;
                    return (
                      <motion.div
                        key={ticket.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                      >
                        <div
                          onClick={() => openTicket(ticket.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                            isSelected
                              ? 'bg-primary/5 border-primary/20'
                              : 'border-transparent hover:bg-white/3 hover:border-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] text-gray-600 font-mono">#{ticket.number}</span>
                                <Badge variant={statusColors[ticket.status]} className="text-[10px] px-1.5 py-0">
                                  {ticket.status.replace('_', ' ')}
                                </Badge>
                                <Badge variant={priorityColors[ticket.priority]} className="text-[10px] px-1.5 py-0">
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <h3 className="text-sm font-medium text-white truncate">{ticket.subject}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-500 truncate">
                                  {ticket.user.name || ticket.user.email}
                                </span>
                                <span className="text-[10px] text-gray-600">{formatRelativeDate(ticket.updatedAt)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600 shrink-0 mt-1">
                              <MessageSquare size={12} />
                              <span className="text-[10px]">{ticket._count?.messages || 0}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {tickets.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                    <Inbox size={32} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">{t('noTickets')}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {searchQuery ? t('noTicketsSearch') : t('noTicketsFilter')}
                    </p>
                  </motion.div>
                )}
              </div>
            </GlassPanel>
          </motion.div>

          {/* Right Panel: Ticket Detail */}
          <AnimatePresence mode="wait">
            {selectedTicket ? (
              <motion.div
                key={selectedTicket.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <GlassPanel className="flex flex-col h-[calc(100vh-200px)]">
                  {/* Ticket header */}
                  <div className="flex items-start justify-between pb-4 border-b border-white/5 shrink-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs text-gray-600 font-mono">
                          <Hash size={10} className="inline mr-0.5" />
                          {selectedTicket.number}
                        </span>
                        <Badge variant={statusColors[selectedTicket.status]}>
                          {selectedTicket.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant={priorityColors[selectedTicket.priority]}>
                          {selectedTicket.priority}
                        </Badge>
                        <Badge>{selectedTicket.category}</Badge>
                      </div>
                      <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <User size={11} />
                          {selectedTicket.user?.name || selectedTicket.user?.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatFullDate(selectedTicket.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Status dropdown */}
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <div className="relative" ref={statusDropdownRef}>
                        <Button variant="outline" size="sm" onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}>
                          <Filter size={12} />
                          Status
                          <ChevronDown size={12} />
                        </Button>
                        <AnimatePresence>
                          {statusDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -5, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-white/10 bg-surface-light shadow-xl z-50 py-1"
                            >
                              {statusOptions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => updateStatus(s)}
                                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                    selectedTicket.status === s
                                      ? 'text-primary bg-primary/5'
                                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <Badge variant={statusColors[s]} className="text-[10px] px-1.5 py-0 mr-2">
                                    {s.replace('_', ' ')}
                                  </Badge>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
                    <AnimatePresence mode="popLayout">
                      {(selectedTicket.messages || []).map((msg, index) => {
                        const isSupport = msg.user.role !== 'USER';
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className={`p-3.5 rounded-lg text-sm ${
                              msg.isInternal
                                ? 'bg-warning/5 border border-warning/10 border-dashed'
                                : isSupport
                                ? 'bg-primary/5 border border-primary/10'
                                : 'bg-white/3 border border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                msg.isInternal ? 'bg-warning/20' : isSupport ? 'bg-primary/20' : 'bg-white/10'
                              }`}>
                                {isSupport ? (
                                  <HeadphonesIcon size={10} className={msg.isInternal ? 'text-warning' : 'text-primary'} />
                                ) : (
                                  <User size={10} className="text-gray-400" />
                                )}
                              </div>
                              <span className="font-medium text-white text-xs">{msg.user.name || 'User'}</span>
                              {msg.isInternal && (
                                <Badge variant="warning" className="text-[10px] px-1.5 py-0">{t('internal')}</Badge>
                              )}
                              <span className="text-[10px] text-gray-600 ml-auto">{formatFullDate(msg.createdAt)}</span>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed pl-7">{msg.content}</p>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply */}
                  <div className="border-t border-white/5 pt-4 shrink-0">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={3}
                      placeholder={t('replyPlaceholder')}
                      className="w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 resize-none hover:border-white/20 mb-3"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-white/20 bg-surface text-warning focus:ring-warning/50"
                        />
                        <span className="group-hover:text-gray-300 transition-colors">{t('internalNote')}</span>
                        {isInternal && (
                          <span className="text-[10px] text-warning">{t('notVisibleToCustomer')}</span>
                        )}
                      </label>
                      <Button onClick={sendReply} loading={sending} size="sm" disabled={!reply.trim()}>
                        <Send size={14} />
                        {t('sendReply')}
                      </Button>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }}>
                <GlassPanel className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                  <div className="p-4 rounded-2xl bg-white/3 border border-white/5 mb-4">
                    <MessageSquare size={32} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">{t('selectTicket')}</p>
                  <p className="text-gray-600 text-xs mt-1">{t('selectTicketHint')}</p>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
