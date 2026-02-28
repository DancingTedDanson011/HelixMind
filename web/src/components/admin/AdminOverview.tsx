'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import {
  Users, DollarSign, Ticket, TrendingUp,
  ArrowUpRight, ArrowDownRight, Activity, BarChart3,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  proUsers: number;
  teamUsers: number;
  mrr: number;
  openTickets: number;
  totalTickets: number;
  recentSignups: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
  }),
};

export function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <GlassPanel className="text-center py-12">
        <Activity size={48} className="text-error/40 mx-auto mb-4" />
        <p className="text-gray-400">Failed to load dashboard stats</p>
        <p className="text-xs text-gray-600 mt-1">Check your database connection and try again</p>
      </GlassPanel>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <GlassPanel key={i} className="animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5" />
                <div className="flex-1">
                  <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                  <div className="h-6 w-12 bg-white/5 rounded" />
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
        <GlassPanel className="animate-pulse">
          <div className="h-4 w-32 bg-white/5 rounded mb-4" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-lg" />
            ))}
          </div>
        </GlassPanel>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
      trend: stats.recentSignups > 0 ? `+${stats.recentSignups}` : '0',
      trendUp: stats.recentSignups > 0,
      trendLabel: 'last 30d',
    },
    {
      label: 'Monthly Revenue',
      value: `${stats.mrr.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
      trend: `${(stats.mrr * 12).toLocaleString()}/yr`,
      trendUp: true,
      trendLabel: 'estimated',
    },
    {
      label: 'Open Tickets',
      value: stats.openTickets.toString(),
      icon: Ticket,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
      trend: `${stats.totalTickets} total`,
      trendUp: stats.openTickets === 0,
      trendLabel: '',
    },
    {
      label: 'New Signups',
      value: stats.recentSignups.toString(),
      icon: TrendingUp,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/20',
      trend: stats.totalUsers > 0 ? `${((stats.recentSignups / stats.totalUsers) * 100).toFixed(1)}%` : '0%',
      trendUp: stats.recentSignups > 0,
      trendLabel: 'growth',
    },
  ];

  const freeUsers = stats.totalUsers - stats.proUsers - stats.teamUsers;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <GlassPanel className={`border ${card.borderColor} hover:border-opacity-40 transition-all duration-300`}>
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-lg ${card.bgColor}`}>
                  <card.icon size={18} className={card.color} />
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {card.trendUp ? (
                    <ArrowUpRight size={12} className="text-success" />
                  ) : (
                    <ArrowDownRight size={12} className="text-error" />
                  )}
                  <span className={card.trendUp ? 'text-success' : 'text-error'}>
                    {card.trend}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {card.label}
                  {card.trendLabel && (
                    <span className="text-gray-600 ml-1">({card.trendLabel})</span>
                  )}
                </p>
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </div>

      {/* Plan Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <GlassPanel>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary" />
            <h2 className="text-lg font-semibold text-white">Plan Distribution</h2>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Free', count: freeUsers, color: 'text-gray-400', bar: 'bg-gray-500', border: '' },
              { label: 'Pro', count: stats.proUsers, color: 'text-primary', bar: 'bg-primary', border: 'border border-primary/10' },
              { label: 'Team', count: stats.teamUsers, color: 'text-secondary', bar: 'bg-secondary', border: 'border border-secondary/10' },
              { label: 'Enterprise', count: 0, color: 'text-accent', bar: 'bg-accent', border: 'border border-accent/10' },
            ].map((plan) => {
              const pct = stats.totalUsers > 0 ? (plan.count / stats.totalUsers) * 100 : 0;
              return (
                <div key={plan.label} className={`text-center p-4 rounded-lg bg-white/[0.02] ${plan.border}`}>
                  <p className={`text-2xl font-bold ${plan.color}`}>
                    {plan.count > 0 ? plan.count : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{plan.label}</p>
                  {/* Mini progress bar */}
                  <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${plan.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, plan.count > 0 ? 5 : 0)}%` }}
                      transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Quick Info + Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <GlassPanel>
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-success" />
              <h2 className="text-lg font-semibold text-white">Key Metrics</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'text-white' },
                { label: 'Active Subscriptions', value: (stats.proUsers + stats.teamUsers).toLocaleString(), color: 'text-primary' },
                { label: 'Free Users', value: freeUsers.toLocaleString(), color: 'text-gray-400' },
                { label: 'Monthly Revenue', value: `${stats.mrr.toLocaleString()}`, color: 'text-success' },
                { label: 'Annual Revenue (est.)', value: `${(stats.mrr * 12).toLocaleString()}`, color: 'text-success' },
                { label: 'Conversion Rate', value: stats.totalUsers > 0 ? `${(((stats.proUsers + stats.teamUsers) / stats.totalUsers) * 100).toFixed(1)}%` : '0%', color: 'text-accent' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <GlassPanel>
            <div className="flex items-center gap-2 mb-4">
              <Ticket size={16} className="text-warning" />
              <h2 className="text-lg font-semibold text-white">Support Overview</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Open Tickets', value: stats.openTickets.toString(), color: stats.openTickets > 0 ? 'text-warning' : 'text-success' },
                { label: 'Total Tickets', value: stats.totalTickets.toString(), color: 'text-white' },
                { label: 'Resolution Rate', value: stats.totalTickets > 0 ? `${(((stats.totalTickets - stats.openTickets) / stats.totalTickets) * 100).toFixed(0)}%` : 'N/A', color: 'text-success' },
                { label: 'Signups (30d)', value: stats.recentSignups.toString(), color: 'text-accent' },
                { label: 'Pro Subscribers', value: stats.proUsers.toString(), color: 'text-primary' },
                { label: 'Team Subscribers', value: stats.teamUsers.toString(), color: 'text-secondary' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}
