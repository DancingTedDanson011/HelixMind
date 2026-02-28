'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketList } from '@/components/support/TicketList';
import { TicketForm } from '@/components/support/TicketForm';
import { TicketDetail } from '@/components/support/TicketDetail';
import { LifeBuoy, Plus, List } from 'lucide-react';

type Tab = 'list' | 'new';

export default function TicketsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTicketCreated = () => {
    setActiveTab('list');
    setRefreshKey((k) => k + 1);
  };

  // If a ticket is selected, show its detail view
  if (selectedTicketId) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-4">
        <div className="mx-auto max-w-4xl">
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={() => setSelectedTicketId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <LifeBuoy size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Support</h1>
            <p className="text-xs text-gray-500">Get help from our team</p>
          </div>
        </motion.div>

        {/* Tab toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-1 p-1 rounded-xl bg-white/3 border border-white/5 mb-8 w-fit"
        >
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'list'
                ? 'bg-primary/10 text-primary border border-primary/30 shadow-sm'
                : 'text-gray-500 hover:text-white border border-transparent'
            }`}
          >
            <List size={14} />
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'new'
                ? 'bg-primary/10 text-primary border border-primary/30 shadow-sm'
                : 'text-gray-500 hover:text-white border border-transparent'
            }`}
          >
            <Plus size={14} />
            New Ticket
          </button>
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <TicketList
                onSelectTicket={(id) => setSelectedTicketId(id)}
                refreshKey={refreshKey}
              />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TicketForm
                onSuccess={handleTicketCreated}
                onCancel={() => setActiveTab('list')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
