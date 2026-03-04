'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check, Info } from 'lucide-react';

const mainTierKeys = ['free', 'freePlus', 'pro', 'team'] as const;
type PaidTier = 'pro' | 'team';

const tierColors = ['#6c757d', '#00ff88', '#00d4ff', '#4169e1'];

// Monthly prices shown per-month when billed yearly
const yearlyMonthlyRate: Record<PaidTier, number> = {
  pro: Math.round(190 / 12),   // ~16
  team: Math.round(390 / 12),  // ~33
};
const yearlyTotal: Record<PaidTier, number> = {
  pro: 190,
  team: 390,
};

export default function PricingPage() {
  const t = useTranslations('pricing');
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async (plan: PaidTier) => {
    setLoading(plan);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, period: yearly ? 'yearly' : 'monthly' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(null);
        setCheckoutError(data.error || t('checkoutFailed'));
      }
    } catch {
      setLoading(null);
      setCheckoutError(t('checkoutFailed'));
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-gray-400 text-lg mb-8">{t('subtitle')}</p>

          {/* Glossary hint */}
          <div className="flex items-start gap-2 max-w-xl mx-auto mb-6 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-left">
            <Info size={14} className="text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">{t('glossary')}</p>
          </div>

          {/* Checkout error */}
          {checkoutError && (
            <div className="max-w-md mx-auto mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {checkoutError}
            </div>
          )}

          {/* Yearly/Monthly toggle */}
          <div className="inline-flex items-center gap-3 glass rounded-xl p-1.5">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                !yearly ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('monthly')}
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                yearly ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('yearly')}
              <Badge variant="success" className="ml-2">{t('yearlyDiscount')}</Badge>
            </button>
          </div>
        </div>

        {/* 4 main tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {mainTierKeys.map((key, i) => {
            const isPro = key === 'pro';
            const isPaid = key === 'pro' || key === 'team';
            const features = t.raw(`${key}.features`) as string[];

            const displayPrice = (() => {
              if (key === 'free' || key === 'freePlus') return '€0';
              if (isPaid && yearly) return `€${yearlyMonthlyRate[key as PaidTier]}`;
              return `€${t(`${key}.price`)}`;
            })();

            return (
              <GlassPanel
                key={key}
                className={`flex flex-col ${isPro ? 'border-primary/30 glow-primary' : ''}`}
              >
                {isPro && (
                  <Badge variant="primary" className="self-start mb-3">{t('mostPopular')}</Badge>
                )}

                <h3 className="text-lg md:text-xl font-semibold text-white mb-1">{t(`${key}.name`)}</h3>

                <div className="mb-2">
                  <span className="text-2xl md:text-4xl font-bold text-white">{displayPrice}</span>
                  <span className="text-gray-500 text-xs md:text-sm">
                    {key === 'team' ? t('perUser') : isPaid ? t('perMonth') : ''}
                  </span>
                  {isPaid && yearly && (
                    <p className="text-xs text-success mt-1">
                      {t('yearlyBilled', { amount: yearlyTotal[key as PaidTier] })}
                    </p>
                  )}
                </div>

                <p className="text-xs md:text-sm text-gray-500 mb-3 md:mb-6">{t(`${key}.desc`)}</p>

                {/* Features: top 3 on mobile, all on desktop */}
                <ul className="space-y-2 md:space-y-3 mb-4 md:mb-8 flex-1">
                  {features.slice(0, 3).map((feature: string, fi: number) => (
                    <li key={fi} className="flex items-start gap-2 md:gap-2.5 text-xs md:text-sm text-gray-300">
                      <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: tierColors[i] }} />
                      {feature}
                    </li>
                  ))}
                  {features.slice(3).map((feature: string, fi: number) => (
                    <li key={fi + 3} className="hidden md:flex items-start gap-2.5 text-sm text-gray-300">
                      <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: tierColors[i] }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Spacer on mobile to push button down */}
                <div className="flex-1 md:hidden" />

                <Button
                  variant={isPro ? 'primary' : 'outline'}
                  className="w-full text-sm md:text-base"
                  loading={loading === key}
                  onClick={() => {
                    if (key === 'free') {
                      window.location.href = 'https://www.npmjs.com/package/helixmind';
                      return;
                    }
                    if (key === 'freePlus') {
                      window.location.href = '/auth/register';
                      return;
                    }
                    handleCheckout(key as PaidTier);
                  }}
                >
                  {key === 'free'
                    ? t('getStarted')
                    : key === 'freePlus'
                      ? t('loginFree')
                      : t('subscribe')}
                </Button>
              </GlassPanel>
            );
          })}
        </div>

        {/* Enterprise — full width below */}
        <div className="mt-8 max-w-4xl mx-auto">
          <GlassPanel className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold text-white mb-1">{t('enterprise.name')}</h3>
              <div className="mb-2">
                <span className="text-2xl font-bold text-white">{t('custom')}</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{t('enterprise.desc')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {(t.raw('enterprise.features') as string[]).map((feature: string, fi: number) => (
                  <span key={fi} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check size={14} className="flex-shrink-0" style={{ color: '#8a2be2' }} />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0 text-sm md:text-base"
              onClick={() => {
                window.location.href = 'mailto:contact@helix-mind.ai?subject=Enterprise%20Inquiry';
              }}
            >
              {t('contactSales')}
            </Button>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
