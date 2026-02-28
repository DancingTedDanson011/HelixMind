'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft, Send, Loader2, User, HeadphonesIcon,
  CalendarDays, Clock, Tag, AlertTriangle,
} from 'lucide-react';

interface TicketMessage {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  user: { name: string | null; role: string };
}

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
  messages?: TicketMessage[];
}

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

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets?id=${ticketId}`);
      if (!res.ok) throw new Error('Failed to load ticket');
      const data = await res.json();
      // The API might return an array or a single ticket depending on route
      if (Array.isArray(data)) {
        const found = data.find((t: Ticket) => t.id === ticketId);
        if (found) setTicket(found);
        else throw new Error('Ticket not found');
      } else {
        setTicket(data);
      }
    } catch {
      setError('Could not load ticket details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const sendReply = async () => {
    if (!reply.trim() || !ticket) return;
    setSending(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          content: reply.trim(),
        }),
      });
      if (res.ok) {
        setReply('');
        fetchTicket();
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendReply();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to tickets
        </button>
        <GlassPanel className="text-center py-12">
          <AlertTriangle size={32} className="text-error mx-auto mb-3" />
          <p className="text-gray-400">{error || 'Ticket not found'}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchTicket}>
            Retry
          </Button>
        </GlassPanel>
      </div>
    );
  }

  const isClosedOrResolved = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to tickets
      </button>

      {/* Ticket header */}
      <GlassPanel>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-gray-600 font-mono">#{ticket.number}</span>
              <Badge variant={statusColors[ticket.status] || 'default'}>
                {ticket.status.replace('_', ' ')}
              </Badge>
              <Badge variant={priorityColors[ticket.priority] || 'default'}>
                {ticket.priority}
              </Badge>
              <Badge>{ticket.category}</Badge>
            </div>
            <h2 className="text-xl font-bold text-white">{ticket.subject}</h2>
          </div>
        </div>

        {/* Ticket meta */}
        <div className="flex items-center gap-4 text-xs text-gray-500 border-b border-white/5 pb-4 mb-4">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={12} />
            Created {formatFullDate(ticket.createdAt)}
          </div>
          {ticket.updatedAt !== ticket.createdAt && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              Updated {formatFullDate(ticket.updatedAt)}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Tag size={12} />
            {ticket.category}
          </div>
        </div>

        {/* Messages thread */}
        <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {(ticket.messages || [])
              .filter((msg) => !msg.isInternal)
              .map((msg, index) => {
                const isSupport = msg.user.role !== 'USER';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 ${
                        isSupport
                          ? 'bg-primary/5 border border-primary/10'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            isSupport ? 'bg-primary/20' : 'bg-white/10'
                          }`}
                        >
                          {isSupport ? (
                            <HeadphonesIcon size={10} className="text-primary" />
                          ) : (
                            <User size={10} className="text-gray-400" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-white">
                          {isSupport ? 'Support' : msg.user.name || 'You'}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Reply area */}
        {!isClosedOrResolved ? (
          <div className="border-t border-white/5 pt-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Type your reply... (Ctrl+Enter to send)"
              className="w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 resize-none hover:border-white/20 mb-3"
            />
            <div className="flex items-center justify-end">
              <Button onClick={sendReply} loading={sending} size="sm" disabled={!reply.trim()}>
                <Send size={14} />
                Send Reply
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-white/5 pt-4 text-center">
            <p className="text-sm text-gray-500">
              This ticket is {ticket.status.toLowerCase().replace('_', ' ')}. No further replies can be added.
            </p>
          </div>
        )}
      </GlassPanel>
    </motion.div>
  );
}
