'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  HeadphonesIcon, MessageSquare, ChevronRight, Search,
  Send, ArrowLeft, User, Clock, Hash,
  ChevronDown, AlertCircle, Inbox, Filter,
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

const statusFilters = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const statusOptions = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// ─── Mock Data ──────────────────────────────────

const MOCK_TICKETS: Ticket[] = [
  {
    id: 'tk_1',
    number: 1001,
    subject: 'Cannot connect to spiral brain after latest update',
    status: 'OPEN',
    priority: 'HIGH',
    category: 'BUG',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    user: { name: 'Sarah Chen', email: 'sarah@example.com' },
    _count: { messages: 3 },
    messages: [
      {
        id: 'msg_1',
        content: 'After updating to v0.9.2, the spiral brain connection keeps timing out. I get "ECONNREFUSED" in the terminal. Running on macOS 14.2.',
        isInternal: false,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        user: { name: 'Sarah Chen', role: 'USER' },
      },
      {
        id: 'msg_2',
        content: 'Have you tried running `helixmind config set brain.port 3847`? There was a port conflict in that version.',
        isInternal: false,
        createdAt: new Date(Date.now() - 1200000).toISOString(),
        user: { name: 'Support Team', role: 'SUPPORT' },
      },
      {
        id: 'msg_3',
        content: 'Known issue from regression in PR #247. Hotfix is in progress.',
        isInternal: true,
        createdAt: new Date(Date.now() - 900000).toISOString(),
        user: { name: 'Admin', role: 'ADMIN' },
      },
    ],
  },
  {
    id: 'tk_2',
    number: 1002,
    subject: 'Billing: Pro subscription not reflecting after payment',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'BILLING',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    user: { name: 'Marcus Johnson', email: 'marcus@company.io' },
    _count: { messages: 2 },
    messages: [
      {
        id: 'msg_4',
        content: 'I paid for the Pro plan yesterday via Stripe but my account still shows "Free". Payment confirmation email received. Transaction ID: pi_3Ox...',
        isInternal: false,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        user: { name: 'Marcus Johnson', role: 'USER' },
      },
      {
        id: 'msg_5',
        content: 'We are looking into this. There seems to be a webhook delay. We will update you shortly.',
        isInternal: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        user: { name: 'Support Team', role: 'SUPPORT' },
      },
    ],
  },
  {
    id: 'tk_3',
    number: 1003,
    subject: 'Feature request: Export spiral memory as Markdown',
    status: 'OPEN',
    priority: 'LOW',
    category: 'FEATURE',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
    user: { name: null, email: 'dev@startup.co' },
    _count: { messages: 1 },
    messages: [
      {
        id: 'msg_6',
        content: 'It would be great to have an option to export the spiral memory as structured Markdown files. Currently only ZIP export is supported.',
        isInternal: false,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        user: { name: null, role: 'USER' },
      },
    ],
  },
  {
    id: 'tk_4',
    number: 1004,
    subject: 'YOLO mode skipping dangerous command confirmation',
    status: 'RESOLVED',
    priority: 'CRITICAL',
    category: 'BUG',
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString(),
    user: { name: 'Lena Park', email: 'lena@devtools.com' },
    _count: { messages: 4 },
    messages: [
      {
        id: 'msg_7',
        content: 'In YOLO mode, `rm -rf /` is not being caught by the sandbox. This is a critical security issue.',
        isInternal: false,
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        user: { name: 'Lena Park', role: 'USER' },
      },
      {
        id: 'msg_8',
        content: 'Verified. The sandbox.ts dangerous command list does not include patterns with absolute root paths. Escalating.',
        isInternal: true,
        createdAt: new Date(Date.now() - 518400000).toISOString(),
        user: { name: 'Admin', role: 'ADMIN' },
      },
      {
        id: 'msg_9',
        content: 'Fix deployed in v0.9.3. The sandbox now blocks all recursive delete operations targeting system root directories.',
        isInternal: false,
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        user: { name: 'Support Team', role: 'SUPPORT' },
      },
      {
        id: 'msg_10',
        content: 'Confirmed fixed on my end. Thanks for the quick response!',
        isInternal: false,
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        user: { name: 'Lena Park', role: 'USER' },
      },
    ],
  },
  {
    id: 'tk_5',
    number: 1005,
    subject: 'How to configure Ollama provider for local models?',
    status: 'CLOSED',
    priority: 'LOW',
    category: 'GENERAL',
    createdAt: new Date(Date.now() - 1209600000).toISOString(),
    updatedAt: new Date(Date.now() - 1036800000).toISOString(),
    user: { name: 'Tom Bradley', email: 'tom@freelance.dev' },
    _count: { messages: 2 },
    messages: [
      {
        id: 'msg_11',
        content: 'I installed Ollama but helixmind does not detect it. How do I configure the local model provider?',
        isInternal: false,
        createdAt: new Date(Date.now() - 1209600000).toISOString(),
        user: { name: 'Tom Bradley', role: 'USER' },
      },
      {
        id: 'msg_12',
        content: 'Run `helixmind config set provider ollama` and make sure Ollama is running on port 11434. The CLI auto-detects available models.',
        isInternal: false,
        createdAt: new Date(Date.now() - 1036800000).toISOString(),
        user: { name: 'Support Team', role: 'SUPPORT' },
      },
    ],
  },
];

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
  // When useMock is true, component uses MOCK_TICKETS instead of fetching
  const useMock = true;

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

  // ─── Fetch / Mock Logic ───────────────────────

  const fetchTickets = async () => {
    if (useMock) {
      let filtered = [...MOCK_TICKETS];
      if (statusFilter) {
        filtered = filtered.filter((t) => t.status === statusFilter);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.subject.toLowerCase().includes(q) ||
            t.user.email.toLowerCase().includes(q) ||
            t.user.name?.toLowerCase().includes(q) ||
            `#${t.number}`.includes(q),
        );
      }
      setTickets(filtered);
      return;
    }

    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/tickets?${params}`);
    const data = await res.json();
    setTickets(data.tickets || []);
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, searchQuery]);

  // ─── Ticket Actions ───────────────────────────

  const openTicket = async (ticketId: string) => {
    if (useMock) {
      const found = MOCK_TICKETS.find((t) => t.id === ticketId);
      if (found) setSelectedTicket(found);
      return;
    }

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

    if (useMock) {
      setSelectedTicket({ ...selectedTicket, status });
      setStatusDropdownOpen(false);
      return;
    }

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

    if (useMock) {
      const newMsg: TicketMessage = {
        id: `msg_mock_${Date.now()}`,
        content: reply.trim(),
        isInternal,
        createdAt: new Date().toISOString(),
        user: { name: 'Support Team', role: 'SUPPORT' },
      };
      setSelectedTicket({
        ...selectedTicket,
        messages: [...(selectedTicket.messages || []), newMsg],
      });
      setReply('');
      setIsInternal(false);
      setSending(false);
      return;
    }

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  // Close status dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Layout ───────────────────────────────────

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
            <h1 className="text-2xl font-bold text-white">Support Panel</h1>
            <p className="text-xs text-gray-500">Manage customer support tickets</p>
          </div>
        </motion.div>

        {/* Main grid: sidebar + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* ─── Left Sidebar: Ticket List ──────── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <GlassPanel className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full rounded-lg border border-white/10 bg-surface pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 hover:border-white/20"
                />
              </div>

              {/* Status filter tabs */}
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
                                <span className="text-[10px] text-gray-600 font-mono">
                                  #{ticket.number}
                                </span>
                                <Badge
                                  variant={statusColors[ticket.status]}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {ticket.status.replace('_', ' ')}
                                </Badge>
                                <Badge
                                  variant={priorityColors[ticket.priority]}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <h3 className="text-sm font-medium text-white truncate">
                                {ticket.subject}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-500 truncate">
                                  {ticket.user.name || ticket.user.email}
                                </span>
                                <span className="text-[10px] text-gray-600">
                                  {formatRelativeDate(ticket.updatedAt)}
                                </span>
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-10"
                  >
                    <Inbox size={32} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No tickets found</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {searchQuery ? 'Try a different search term' : 'No tickets match this filter'}
                    </p>
                  </motion.div>
                )}
              </div>
            </GlassPanel>
          </motion.div>

          {/* ─── Right Panel: Ticket Detail ──────── */}
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

                    {/* Status dropdown + actions */}
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <div className="relative" ref={statusDropdownRef}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                        >
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
                                  <Badge
                                    variant={statusColors[s]}
                                    className="text-[10px] px-1.5 py-0 mr-2"
                                  >
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

                  {/* Messages thread */}
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
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                  msg.isInternal
                                    ? 'bg-warning/20'
                                    : isSupport
                                    ? 'bg-primary/20'
                                    : 'bg-white/10'
                                }`}
                              >
                                {isSupport ? (
                                  <HeadphonesIcon
                                    size={10}
                                    className={msg.isInternal ? 'text-warning' : 'text-primary'}
                                  />
                                ) : (
                                  <User size={10} className="text-gray-400" />
                                )}
                              </div>
                              <span className="font-medium text-white text-xs">
                                {msg.user.name || 'User'}
                              </span>
                              {msg.isInternal && (
                                <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                                  Internal
                                </Badge>
                              )}
                              <span className="text-[10px] text-gray-600 ml-auto">
                                {formatFullDate(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed pl-7">
                              {msg.content}
                            </p>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply area */}
                  <div className="border-t border-white/5 pt-4 shrink-0">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={3}
                      placeholder="Write a reply... (Ctrl+Enter to send)"
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
                        <span className="group-hover:text-gray-300 transition-colors">
                          Internal note
                        </span>
                        {isInternal && (
                          <span className="text-[10px] text-warning">
                            (not visible to customer)
                          </span>
                        )}
                      </label>
                      <Button
                        onClick={sendReply}
                        loading={sending}
                        size="sm"
                        disabled={!reply.trim()}
                      >
                        <Send size={14} />
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <GlassPanel className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                  <div className="p-4 rounded-2xl bg-white/3 border border-white/5 mb-4">
                    <MessageSquare size={32} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">Select a ticket to view details</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Click on any ticket from the list to start responding
                  </p>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
