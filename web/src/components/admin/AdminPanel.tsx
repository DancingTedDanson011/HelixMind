'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import {
  LayoutDashboard, Users, Settings, CreditCard,
  Ticket, Shield,
} from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminUsers } from './AdminUsers';
import { AdminSettings } from './AdminSettings';
import { AdminPlans } from './AdminPlans';
import { AdminTickets } from './AdminTickets';

type Tab = 'overview' | 'users' | 'settings' | 'plans' | 'tickets';

interface AdminPanelProps {
  userRole?: string;
}

export function AdminPanel({ userRole = 'ADMIN' }: AdminPanelProps) {
  const t = useTranslations('admin');
  const isSupport = userRole === 'SUPPORT';

  const allTabs: { key: Tab; icon: typeof LayoutDashboard; labelKey: string }[] = [
    { key: 'overview', icon: LayoutDashboard, labelKey: 'tabs.overview' },
    { key: 'users', icon: Users, labelKey: 'tabs.users' },
    { key: 'plans', icon: CreditCard, labelKey: 'tabs.plans' },
    { key: 'tickets', icon: Ticket, labelKey: 'tabs.tickets' },
    { key: 'settings', icon: Settings, labelKey: 'tabs.settings' },
  ];

  // SUPPORT: only overview, users (read-only), tickets
  const tabs = isSupport
    ? allTabs.filter((tab) => ['overview', 'users', 'tickets'].includes(tab.key))
    : allTabs;

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-2.5 rounded-xl bg-error/10 border border-error/20 shadow-[0_0_20px_rgba(255,68,68,0.1)]">
            <Shield size={22} className="text-error" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:w-56 flex-shrink-0"
          >
            <GlassPanel className="p-2 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'text-primary'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="admin-tab-highlight"
                      className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <tab.icon size={16} className="relative z-10" />
                  <span className="relative z-10">{t(tab.labelKey)}</span>
                </button>
              ))}
            </GlassPanel>
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                {activeTab === 'overview' && <AdminOverview />}
                {activeTab === 'users' && <AdminUsers userRole={userRole} />}
                {activeTab === 'settings' && !isSupport && <AdminSettings />}
                {activeTab === 'plans' && !isSupport && <AdminPlans />}
                {activeTab === 'tickets' && <AdminTickets />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
