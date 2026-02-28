'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import {
  MessageSquare, ChevronRight, Clock, CalendarDays,
  Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
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

interface TicketListProps {
  onSelectTicket?: (ticketId: string) => void;
  refreshKey?: number;
}

export function TicketList({ onSelectTicket, refreshKey = 0 }: TicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tickets');
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [refreshKey]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassPanel className="text-center py-12">
        <p className="text-gray-400 mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchTickets}>
          <RefreshCw size={14} />
          Retry
        </Button>
      </GlassPanel>
    );
  }

  if (tickets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <GlassPanel className="text-center py-16">
          <MessageSquare size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg mb-2">No tickets yet</p>
          <p className="text-gray-600 text-sm">
            Create a new ticket to get help from our support team.
          </p>
        </GlassPanel>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {tickets.map((ticket, index) => (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <GlassPanel
              className="p-4 hover:border-white/15 transition-all cursor-pointer group"
              onClick={() => onSelectTicket?.(ticket.id)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs text-gray-600 font-mono">#{ticket.number}</span>
                    <Badge variant={statusColors[ticket.status] || 'default'}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant={priorityColors[ticket.priority] || 'default'}>
                      {ticket.priority}
                    </Badge>
                    <Badge>{ticket.category}</Badge>
                  </div>

                  {/* Subject */}
                  <h3 className="font-medium text-white truncate group-hover:text-primary transition-colors">
                    {ticket.subject}
                  </h3>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-gray-500">
                      <CalendarDays size={12} />
                      <span className="text-xs">{formatDate(ticket.createdAt)}</span>
                    </div>
                    {ticket.updatedAt !== ticket.createdAt && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock size={12} />
                        <span className="text-xs">Updated {formatDate(ticket.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 ml-4">
                  <div className="flex items-center gap-1 text-gray-500">
                    <MessageSquare size={14} />
                    <span className="text-xs">{ticket._count?.messages || 0}</span>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-gray-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
