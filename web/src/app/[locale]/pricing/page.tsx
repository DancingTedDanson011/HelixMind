'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check } from 'lucide-react';

const tierKeys = ['free', 'pro', 'team', 'enterprise'] as const;
type PaidTier = 'pro' | 'team';

const tierColors = ['#6c757d', '#00d4ff', '#4169e1', '#8a2be2'];

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

  const handleCheckout = async (plan: PaidTier) => {
    setLoading(plan);
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
      }
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-gray-400 text-lg mb-8">{t('subtitle')}</p>

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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tierKeys.map((key, i) => {
            const isPro = key === 'pro';
            const isPaid = key === 'pro' || key === 'team';
            const features = t.raw(`${key}.features`) as string[];

            const displayPrice = (() => {
              if (key === 'free') return '$0';
              if (key === 'enterprise') return null;
              if (isPaid && yearly) return `$${yearlyMonthlyRate[key as PaidTier]}`;
              return `$${t(`${key}.price`)}`;
            })();

            return (
              <GlassPanel
                key={key}
                className={`flex flex-col ${isPro ? 'border-primary/30 glow-primary' : ''}`}
              >
                {isPro && (
                  <Badge variant="primary" className="self-start mb-3">{t('mostPopular')}</Badge>
                )}

                <h3 className="text-xl font-semibold text-white mb-1">{t(`${key}.name`)}</h3>

                <div className="mb-2">
                  {key === 'enterprise' ? (
                    <span className="text-3xl font-bold text-white">{t('custom')}</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-white">{displayPrice}</span>
                      <span className="text-gray-500 text-sm">
                        {key === 'team' ? t('perUser') : key !== 'free' ? t('perMonth') : ''}
                      </span>
                      {isPaid && yearly && (
                        <p className="text-xs text-success mt-1">
                          {t('yearlyBilled', { amount: yearlyTotal[key as PaidTier] })}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <p className="text-sm text-gray-500 mb-6">{t(`${key}.desc`)}</p>

                <ul className="space-y-3 mb-8 flex-1">
                  {features.map((feature: string, fi: number) => (
                    <li key={fi} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: tierColors[i] }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isPro ? 'primary' : 'outline'}
                  className="w-full"
                  loading={loading === key}
                  onClick={() => {
                    if (key === 'free') return;
                    if (key === 'enterprise') {
                      window.location.href = 'mailto:contact@helix-mind.ai?subject=Enterprise%20Inquiry';
                      return;
                    }
                    handleCheckout(key);
                  }}
                >
                  {key === 'free'
                    ? t('getStarted')
                    : key === 'enterprise'
                      ? t('contactSales')
                      : t('subscribe')}
                </Button>
              </GlassPanel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
