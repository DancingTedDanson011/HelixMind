'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CreditCard,
  ArrowUpRight,
  Download,
  CheckCircle,
  ExternalLink,
  Calendar,
  Zap,
  Shield,
  Users,
  Infinity,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface BillingPanelProps {
  user?: {
    plan?: string;
    status?: string;
    billingPeriod?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  };
  invoices?: Invoice[];
}

/* ─── Types ──────────────────────────────────── */

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

/* ─── Plan Features ───────────────────────────── */

const planFeatures: Record<string, { icon: typeof Zap; features: string[] }> = {
  FREE: {
    icon: Shield,
    features: [
      '1,000 API calls/month',
      '100K tokens/month',
      '3 API keys',
      'Community support',
      'Basic spiral levels (L1-L3)',
    ],
  },
  PRO: {
    icon: Zap,
    features: [
      '50,000 API calls/month',
      '5M tokens/month',
      '10 API keys',
      'Priority support',
      'All spiral levels (L1-L6)',
      'Web Knowledge Enricher',
      'Export & Import',
    ],
  },
  TEAM: {
    icon: Users,
    features: [
      'Unlimited API calls',
      'Unlimited tokens',
      '50 API keys per user',
      'Dedicated support',
      'All spiral levels (L1-L6)',
      'Team management',
      'Shared spiral contexts',
      'SSO integration',
    ],
  },
  ENTERPRISE: {
    icon: Infinity,
    features: [
      'Everything in Team',
      'Custom token limits',
      'Unlimited API keys',
      'SLA guarantee',
      'On-premise deployment',
      'Custom integrations',
      'Dedicated account manager',
    ],
  },
};

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

function planBadgeVariant(plan: string): 'default' | 'primary' | 'spiral' | 'warning' {
  switch (plan) {
    case 'PRO': return 'primary';
    case 'TEAM': return 'spiral';
    case 'ENTERPRISE': return 'warning';
    default: return 'default';
  }
}

function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'failed': return 'error';
    default: return 'default';
  }
}

/* ─── Component ───────────────────────────────── */

export function BillingPanel({ user, invoices = [] }: BillingPanelProps) {
  const t = useTranslations('dashboard');
  const [portalLoading, setPortalLoading] = useState(false);

  const plan = user?.plan || 'FREE';
  const status = user?.status || 'ACTIVE';
  const billingPeriod = user?.billingPeriod || 'MONTHLY';
  const cancelAtPeriodEnd = user?.cancelAtPeriodEnd || false;
  const features = planFeatures[plan] || planFeatures.FREE;
  const PlanIcon = features.icon;

  const nextBillingDate = user?.currentPeriodEnd
    ? new Date(user.currentPeriodEnd).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setPortalLoading(false);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ── */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white">{t('billing.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('billing.subtitle')}
        </p>
      </motion.div>

      {/* ── Current Plan ── */}
      <motion.div variants={item}>
        <GlassPanel glow>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <PlanIcon size={24} className="text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">{t('billing.plan', { plan })}</h2>
                  <Badge variant={planBadgeVariant(plan)}>{plan}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant={status === 'ACTIVE' ? 'success' : 'warning'}>
                    {status}
                  </Badge>
                  {plan !== 'FREE' && (
                    <span className="text-xs text-gray-500">
                      {t('billing.billed', { period: billingPeriod.toLowerCase() })}
                    </span>
                  )}
                  {cancelAtPeriodEnd && (
                    <Badge variant="warning">{t('billing.cancelsAtEnd')}</Badge>
                  )}
                </div>

                {/* Features */}
                <div className="grid sm:grid-cols-2 gap-1.5 mt-4">
                  {features.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle size={13} className="text-success shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              {plan === 'FREE' ? (
                <Link href="/pricing">
                  <Button className="w-full">
                    {t('billing.upgradePlan')}
                    <ArrowUpRight size={14} />
                  </Button>
                </Link>
              ) : (
                <>
                  <Button variant="outline" onClick={openPortal} loading={portalLoading}>
                    <ExternalLink size={14} />
                    {t('billing.manageSub')}
                  </Button>
                  <Link href="/pricing">
                    <Button variant="ghost" size="sm" className="w-full">
                      {t('billing.changePlan')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Next billing */}
          {nextBillingDate && (
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={14} />
              <span>{t('billing.nextBilling', { date: nextBillingDate })}</span>
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* ── Invoice History ── */}
      <motion.div variants={item}>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CreditCard size={14} className="text-primary" />
              {t('billing.invoiceHistory')}
            </h2>
          </div>

          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left font-medium">{t('billing.date')}</th>
                    <th className="px-6 py-3 text-left font-medium">{t('billing.description')}</th>
                    <th className="px-6 py-3 text-right font-medium">{t('billing.amount')}</th>
                    <th className="px-6 py-3 text-center font-medium">{t('billing.status')}</th>
                    <th className="px-6 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(inv.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3 text-white">{inv.description}</td>
                      <td className="px-6 py-3 text-right text-white font-mono">
                        {inv.amount > 0 ? `€${inv.amount.toFixed(2)}` : 'Free'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <Badge variant={statusBadgeVariant(inv.status)}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {inv.amount > 0 && (
                          <Button variant="ghost" size="sm">
                            <Download size={13} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-10 text-center">
              <CreditCard size={24} className="mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-500">{t('billing.noInvoices')}</p>
              <p className="text-xs text-gray-600 mt-1">
                {t('billing.noInvoicesHint')}
              </p>
            </div>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}
