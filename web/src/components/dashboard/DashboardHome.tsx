'use client';

import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { getPlanBadgeVariant } from '@/lib/plan-utils';
import { Button } from '@/components/ui/Button';
import {
  User,
  CreditCard,
  Key,
  LifeBuoy,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Shield,
  Terminal,
  Sparkles,
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

/* ─── Component ───────────────────────────────── */

export function DashboardHome({ user }: DashboardHomeProps) {
  const t = useTranslations('dashboard');

  const plan = user?.plan || 'FREE';
  const status = user?.status || 'ACTIVE';
  const name = user?.name || 'there';
  const renewalDate = user?.currentPeriodEnd
    ? new Date(user.currentPeriodEnd).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const quickLinks = [
    { labelKey: 'home.linkApp' as const, href: '/app', icon: Terminal, color: 'text-cyan-400' },
    { labelKey: 'home.linkProfile' as const, href: '/dashboard/profile', icon: User, color: 'text-primary' },
    { labelKey: 'home.linkBilling' as const, href: '/dashboard/billing', icon: CreditCard, color: 'text-success' },
    { labelKey: 'home.linkApiKeys' as const, href: '/dashboard/api-keys', icon: Key, color: 'text-warning' },
    { labelKey: 'home.linkSupport' as const, href: '/support/tickets', icon: LifeBuoy, color: 'text-accent' },
  ];

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
          {t.rich('home.welcome', {
            name,
            highlight: (chunks) => <span className="gradient-text">{chunks}</span>,
          })}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('home.subtitle')}
        </p>
      </motion.div>

      {/* ── Open App CTA ── */}
      <motion.div variants={item}>
        <Link href="/app">
          <GlassPanel
            glow
            className="group flex items-center gap-4 cursor-pointer border-cyan-500/20 hover:border-cyan-400/40 hover:shadow-[0_0_24px_rgba(0,212,255,0.12)] transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
              <Sparkles size={22} className="text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-white">{t('home.openAppTitle')}</p>
              <p className="text-sm text-gray-400">{t('home.openAppDesc')}</p>
            </div>
            <ArrowRight
              size={20}
              className="text-cyan-400/50 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all duration-200 shrink-0"
            />
          </GlassPanel>
        </Link>
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
                <p className="text-lg font-semibold text-white">{t('home.plan', { plan })}</p>
                <Badge variant={getPlanBadgeVariant(plan)}>{plan}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <Badge variant={status === 'ACTIVE' ? 'success' : 'warning'} className="text-[10px]">
                  {status}
                </Badge>
                {renewalDate && (
                  <span className="text-xs text-gray-500">
                    {t('home.renews', { date: renewalDate })}
                  </span>
                )}
              </div>
            </div>
          </div>
          {plan === 'FREE' && (
            <Link href="/pricing">
              <Button size="sm">
                {t('home.upgrade')}
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
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('home.apiKeys')}</p>
            <Key size={14} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-white">{user?.apiKeyCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">{t('home.active')}</p>
        </GlassPanel>

        <GlassPanel intensity="subtle" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('home.tickets')}</p>
            <Layers size={14} className="text-success" />
          </div>
          <p className="text-2xl font-bold text-white">{user?.ticketCount ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">{t('home.total')}</p>
        </GlassPanel>

        <GlassPanel intensity="subtle" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('home.usageEvents')}</p>
            <Activity size={14} className="text-warning" />
          </div>
          <p className="text-2xl font-bold text-white">{formatNumber(user?.usageCount ?? 0)}</p>
          <p className="text-xs text-gray-500 mt-1">{t('home.total')}</p>
        </GlassPanel>
      </motion.div>

      {/* ── Bottom Row: Activity + Quick Links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <motion.div variants={item} className="lg:col-span-2">
          <GlassPanel className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{t('home.recentActivity')}</h2>
            </div>
            <div className="px-6 py-10 text-center">
              <Clock size={24} className="mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">{t('home.noActivity')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('home.noActivityHint')}</p>
            </div>
          </GlassPanel>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={item}>
          <GlassPanel className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{t('home.quickLinks')}</h2>
            </div>
            <div className="p-3 space-y-1">
              {quickLinks.map((link) => (
                <Link
                  key={link.labelKey}
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <link.icon size={16} className={link.color} />
                  <span className="flex-1">{t(link.labelKey)}</span>
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
