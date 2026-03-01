'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check } from 'lucide-react';

const tierKeys = ['free', 'freePlus', 'pro', 'team', 'enterprise'] as const;
type PaidTier = 'pro' | 'team';

const tierColors = ['#6c757d', '#00ff88', '#00d4ff', '#4169e1', '#8a2be2'];

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
      <div className="mx-auto max-w-7xl">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
          {tierKeys.map((key, i) => {
            const isPro = key === 'pro';
            const isEnterprise = key === 'enterprise';
            const isPaid = key === 'pro' || key === 'team';
            const features = t.raw(`${key}.features`) as string[];

            const displayPrice = (() => {
              if (key === 'free' || key === 'freePlus') return '$0';
              if (isEnterprise) return null;
              if (isPaid && yearly) return `$${yearlyMonthlyRate[key as PaidTier]}`;
              return `$${t(`${key}.price`)}`;
            })();

            return (
              <GlassPanel
                key={key}
                className={`flex flex-col ${
                  isPro ? 'border-primary/30 glow-primary' : ''
                } ${isEnterprise ? 'col-span-2 md:col-span-1' : ''}`}
              >
                {isPro && (
                  <Badge variant="primary" className="self-start mb-3">{t('mostPopular')}</Badge>
                )}

                <h3 className="text-lg md:text-xl font-semibold text-white mb-1">{t(`${key}.name`)}</h3>

                <div className={`mb-2 ${isEnterprise ? 'text-center md:text-left' : ''}`}>
                  {isEnterprise ? (
                    <span className="text-2xl md:text-3xl font-bold text-white">{t('custom')}</span>
                  ) : (
                    <>
                      <span className="text-2xl md:text-4xl font-bold text-white">{displayPrice}</span>
                      <span className="text-gray-500 text-xs md:text-sm">
                        {key === 'team' ? t('perUser') : isPaid ? t('perMonth') : ''}
                      </span>
                      {isPaid && yearly && (
                        <p className="text-xs text-success mt-1">
                          {t('yearlyBilled', { amount: yearlyTotal[key as PaidTier] })}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <p className={`text-xs md:text-sm text-gray-500 mb-3 md:mb-6 ${
                  isEnterprise ? 'text-center md:text-left' : ''
                }`}>{t(`${key}.desc`)}</p>

                {/* Features: hidden on mobile, visible from md up */}
                <ul className="hidden md:block space-y-3 mb-8 flex-1">
                  {features.map((feature: string, fi: number) => (
                    <li key={fi} className="flex items-start gap-2.5 text-sm text-gray-300">
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
                      window.location.href = '/login';
                      return;
                    }
                    if (isEnterprise) {
                      window.location.href = 'mailto:contact@helix-mind.ai?subject=Enterprise%20Inquiry';
                      return;
                    }
                    handleCheckout(key as PaidTier);
                  }}
                >
                  {key === 'free'
                    ? t('getStarted')
                    : key === 'freePlus'
                      ? t('loginFree')
                      : isEnterprise
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
