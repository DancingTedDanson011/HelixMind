'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MessageSquare, ChevronRight, Send, ArrowLeft,
  Ticket, AlertTriangle, Clock, CheckCircle2,
  XCircle, Filter,
} from 'lucide-react';

interface TicketData {
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

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  OPEN: 'primary',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const statusIcons: Record<string, typeof Ticket> = {
  OPEN: Ticket,
  IN_PROGRESS: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
};

const priorityColors: Record<string, 'default' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'default',
  HIGH: 'warning',
  CRITICAL: 'error',
};

const priorityDots: Record<string, string> = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-blue-400',
  HIGH: 'bg-warning',
  CRITICAL: 'bg-error animate-pulse',
};

const statusFilterKeys: { value: string; labelKey: string; icon: typeof Ticket }[] = [
  { value: '', labelKey: 'ticketManagement.all', icon: Filter },
  { value: 'OPEN', labelKey: 'ticketManagement.open', icon: Ticket },
  { value: 'IN_PROGRESS', labelKey: 'ticketManagement.inProgress', icon: Clock },
  { value: 'RESOLVED', labelKey: 'ticketManagement.resolved', icon: CheckCircle2 },
  { value: 'CLOSED', labelKey: 'ticketManagement.closed', icon: XCircle },
];

const ticketVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

export function AdminTickets() {
  const t = useTranslations('admin');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/tickets?${params}`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch {
      // Keep state
    }
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [statusFilter]);

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
    const updated = await res.json();
    setSelectedTicket(updated);
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
    const updated = await res.json();
    setSelectedTicket(updated);
    setReply('');
    setIsInternal(false);
    setSending(false);
    fetchTickets();
  };

  // ── Ticket Detail View ──
  if (selectedTicket) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          {t('ticketManagement.backToTickets')}
        </button>

        <GlassPanel>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-600 font-mono bg-white/5 px-2 py-0.5 rounded">
                  #{selectedTicket.number}
                </span>
                <Badge variant={statusColors[selectedTicket.status]}>
                  {(() => {
                    const Icon = statusIcons[selectedTicket.status] || Ticket;
                    return (
                      <span className="flex items-center gap-1">
                        <Icon size={10} />
                        {selectedTicket.status.replace('_', ' ')}
                      </span>
                    );
                  })()}
                </Badge>
                <Badge variant={priorityColors[selectedTicket.priority]}>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityDots[selectedTicket.priority]}`} />
                    {selectedTicket.priority}
                  </span>
                </Badge>
                <Badge>{selectedTicket.category}</Badge>
              </div>
              <h2 className="text-xl font-bold text-white">{selectedTicket.subject}</h2>
              <p className="text-xs text-gray-500 mt-1.5">
                by <span className="text-gray-400">{selectedTicket.user?.name || selectedTicket.user?.email}</span>
                {' -- '}
                {new Date(selectedTicket.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {selectedTicket.status !== 'IN_PROGRESS' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus('IN_PROGRESS')}>
                  <Clock size={12} />
                  {t('ticketManagement.inProgress')}
                </Button>
              )}
              {selectedTicket.status !== 'RESOLVED' && (
                <Button size="sm" onClick={() => updateStatus('RESOLVED')}>
                  <CheckCircle2 size={12} />
                  {t('ticketManagement.resolve')}
                </Button>
              )}
              {selectedTicket.status !== 'CLOSED' && (
                <Button size="sm" variant="ghost" onClick={() => updateStatus('CLOSED')}>
                  <XCircle size={12} />
                  {t('ticketManagement.close')}
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3 mb-6">
            <AnimatePresence>
              {(selectedTicket.messages || []).map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-lg text-sm ${
                    msg.isInternal
                      ? 'bg-warning/5 border border-warning/10'
                      : msg.user.role !== 'USER'
                      ? 'bg-primary/5 border border-primary/10'
                      : 'bg-white/[0.03] border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      msg.user.role === 'ADMIN'
                        ? 'bg-error/10 text-error border border-error/20'
                        : msg.user.role === 'SUPPORT'
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : 'bg-white/10 text-gray-400 border border-white/10'
                    }`}>
                      {(msg.user.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-white text-xs">
                      {msg.user.name || 'User'}
                    </span>
                    {msg.user.role !== 'USER' && (
                      <Badge variant={msg.user.role === 'ADMIN' ? 'error' : 'warning'} className="text-[10px]">
                        {msg.user.role}
                      </Badge>
                    )}
                    {msg.isInternal && (
                      <Badge variant="warning" className="text-[10px]">
                        <AlertTriangle size={8} className="mr-0.5" />
                        {t('ticketManagement.internalNote')}
                      </Badge>
                    )}
                    <span className="text-[10px] text-gray-600 ml-auto">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap pl-8">{msg.content}</p>
                </motion.div>
              ))}
            </AnimatePresence>

            {(selectedTicket.messages || []).length === 0 && (
              <div className="text-center py-8 text-gray-600">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">{t('ticketManagement.noMessages')}</p>
              </div>
            )}
          </div>

          {/* Reply */}
          <div className="border-t border-white/5 pt-5">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder={isInternal ? t('ticketManagement.writeNotePlaceholder') : t('ticketManagement.writeReplyPlaceholder')}
              className="w-full rounded-lg border border-white/10 bg-surface px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-white/20 resize-none mb-3 transition-colors"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-white/10 bg-surface text-warning"
                />
                <AlertTriangle size={12} className={isInternal ? 'text-warning' : ''} />
                {t('ticketManagement.internalNote')}
              </label>
              <Button onClick={sendReply} loading={sending} size="sm" disabled={!reply.trim()}>
                <Send size={14} />
                {isInternal ? t('ticketManagement.addNote') : t('ticketManagement.sendReply')}
              </Button>
            </div>
          </div>
        </GlassPanel>
      </motion.div>
    );
  }

  // ── Ticket List View ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Ticket size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-white">{t('ticketManagement.title')}</h2>
        </div>
        <div className="flex gap-1.5 bg-white/[0.02] p-1 rounded-lg border border-white/5">
          {statusFilterKeys.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`relative px-3 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 ${
                  statusFilter === s.value
                    ? 'text-primary'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {statusFilter === s.value && (
                  <motion.div
                    layoutId="ticket-filter-highlight"
                    className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-md"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon size={12} className="relative z-10" />
                <span className="relative z-10">{t(s.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && tickets.length === 0 && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <GlassPanel key={i} className="animate-pulse p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-10 bg-white/5 rounded" />
                    <div className="h-4 w-16 bg-white/5 rounded-full" />
                    <div className="h-4 w-14 bg-white/5 rounded-full" />
                  </div>
                  <div className="h-5 w-64 bg-white/5 rounded" />
                </div>
                <div className="h-4 w-4 bg-white/5 rounded" />
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      {/* Ticket List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {tickets.map((ticket, i) => {
            const StatusIcon = statusIcons[ticket.status] || Ticket;
            return (
              <motion.div
                key={ticket.id}
                custom={i}
                variants={ticketVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, x: -20 }}
                layout
              >
                <GlassPanel
                  className="p-4 hover:border-white/15 transition-all cursor-pointer group"
                  onClick={() => openTicket(ticket.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="text-xs text-gray-600 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                          #{ticket.number}
                        </span>
                        <Badge variant={statusColors[ticket.status]}>
                          <span className="flex items-center gap-1">
                            <StatusIcon size={10} />
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </Badge>
                        <Badge variant={priorityColors[ticket.priority]}>
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityDots[ticket.priority]}`} />
                            {ticket.priority}
                          </span>
                        </Badge>
                        <Badge>{ticket.category}</Badge>
                      </div>
                      <h3 className="font-medium text-white group-hover:text-primary transition-colors">
                        {ticket.subject}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {ticket.user?.name || ticket.user?.email}
                        {' -- '}
                        {new Date(ticket.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pl-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <MessageSquare size={14} />
                        <span className="text-xs font-mono">{ticket._count?.messages || 0}</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                      />
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && tickets.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <GlassPanel className="text-center py-16">
              <MessageSquare size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">{t('ticketManagement.noTickets')}</p>
              <p className="text-xs text-gray-600 mt-1">
                {statusFilter ? t('ticketManagement.noTicketsFiltered', { status: statusFilter.replace('_', ' ').toLowerCase() }) : t('ticketManagement.allClear')}
              </p>
            </GlassPanel>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
