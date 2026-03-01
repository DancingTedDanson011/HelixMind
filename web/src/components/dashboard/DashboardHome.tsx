'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  User,
  CreditCard,
  Key,
  LifeBuoy,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
  Clock,
  FileText,
  Settings,
  Shield,
  Terminal,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface DashboardHomeProps {
  user?: {
    name?: string | null;
    email?: string | null;
    plan?: string;
    status?: string;
    currentPeriodEnd?: string | null;
    apiKeyCount?: number;
    ticketCount?: number;
    usageCount?: number;
  };
}

/* ─── Mock Data ───────────────────────────────── */

const mockStats = {
  apiCalls: 12_847,
  tokensUsed: 2_340_000,
  activeSessions: 3,
};

const mockActivity = [
  { id: '1', action: 'API call', detail: 'spiral.search endpoint', time: '2 min ago', icon: Zap },
  { id: '2', action: 'Key created', detail: 'production-v2', time: '1 hour ago', icon: Key },
  { id: '3', action: 'Session started', detail: 'CLI agent session', time: '3 hours ago', icon: Activity },
  { id: '4', action: 'Export completed', detail: 'spiral-backup.zip', time: '5 hours ago', icon: FileText },
  { id: '5', action: 'Settings updated', detail: 'Locale changed to EN', time: '1 day ago', icon: Settings },
];

const quickLinks = [
  { label: 'Open App', href: '/app', icon: Terminal, color: 'text-cyan-400' },
  { label: 'Profile', href: '/dashboard/profile', icon: User, color: 'text-primary' },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard, color: 'text-success' },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, color: 'text-warning' },
  { label: 'Support', href: '/support/tickets', icon: LifeBuoy, color: 'text-accent' },
];

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ─── Helpers ─────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function planBadgeVariant(plan: string): 'default' | 'primary' | 'spiral' | 'warning' {
  switch (plan) {
    case 'PRO': return 'primary';
    case 'TEAM': return 'spiral';
    case 'ENTERPRISE': return 'warning';
    default: return 'default';
  }
}

/* ─── Component ───────────────────────────────── */

export function DashboardHome({ user }: DashboardHomeProps) {
  const plan = user?.plan || 'FREE';
  const status = user?.status || 'ACTIVE';
  const name = user?.name || 'there';
  const renewalDate = user?.currentPeriodEnd
    ? new Date(user.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Welcome ── */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, <span className="gradient-text">{name}</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here is what is happening with your HelixMind account.
        </p>
      </motion.div>

      {/* ── Subscription Status ── */}
      <motion.div variants={item}>
        <GlassPanel glow className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield size={22} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-white">{plan} Plan</p>
                <Badge variant={planBadgeVariant(plan)}>{plan}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <Badge variant={status === 'ACTIVE' ? 'success' : 'warning'} className="text-[10px]">
                  {status}
                </Badge>
                {renewalDate && (
                  <span className="text-xs text-gray-500">
                    Renews {renewalDate}
                  </span>
                )}
              </div>
            </div>
          </div>
          {plan === 'FREE' && (
            <Link href="/pricing">
              <Button size="sm">
                Upgrade
                <ArrowUpRight size={14} />
              </Button>
            </Link>
          )}
        </GlassPanel>
      </motion.div>

      {/* ── Stats Grid ── */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassPanel intensity="subtle" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">API Calls</p>
            <Zap size={14} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-white">{formatNumber(mockStats.apiCalls)}</p>
          <p className="text-xs text-gray-500 mt-1">This month</p>
        </GlassPanel>

        <GlassPanel intensity="subtle" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Tokens Used</p>
            <Layers size={14} className="text-success" />
          </div>
          <p className="text-2xl font-bold text-white">{formatNumber(mockStats.tokensUsed)}</p>
          <p className="text-xs text-gray-500 mt-1">This month</p>
        </GlassPanel>

        <GlassPanel intensity="subtle" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Active Sessions</p>
            <Activity size={14} className="text-warning" />
          </div>
          <p className="text-2xl font-bold text-white">{mockStats.activeSessions}</p>
          <p className="text-xs text-gray-500 mt-1">Right now</p>
        </GlassPanel>
      </motion.div>

      {/* ── Bottom Row: Activity + Quick Links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <motion.div variants={item} className="lg:col-span-2">
          <GlassPanel className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {mockActivity.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center">
                    <act.icon size={14} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{act.action}</p>
                    <p className="text-xs text-gray-500 truncate">{act.detail}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Clock size={12} />
                    {act.time}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={item}>
          <GlassPanel className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Quick Links</h2>
            </div>
            <div className="p-3 space-y-1">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <link.icon size={16} className={link.color} />
                  <span className="flex-1">{link.label}</span>
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600"
                  />
                </Link>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </motion.div>
  );
}
