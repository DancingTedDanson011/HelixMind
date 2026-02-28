'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/routing';

const tierKeys = ['free', 'pro', 'team', 'enterprise'] as const;

const tierColors = ['#6c757d', '#00d4ff', '#4169e1', '#8a2be2'];

export function PricingPreview() {
  const t = useTranslations('pricing');

  return (
    <section className="py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold mb-4 text-white"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {t('title')}
          </motion.h2>
          <motion.p
            className="text-gray-300 text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tierKeys.map((key, i) => {
            const isPro = key === 'pro';
            const features = t.raw(`${key}.features`) as string[];

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassPanel
                  className={`h-full flex flex-col ${
                    isPro ? 'border-primary/30 glow-primary' : ''
                  }`}
                >
                  {isPro && (
                    <Badge variant="primary" className="self-start mb-3">
                      Most popular
                    </Badge>
                  )}

                  <h3 className="text-lg font-semibold text-white mb-1">
                    {t(`${key}.name`)}
                  </h3>

                  <div className="mb-4">
                    {key === 'enterprise' ? (
                      <span className="text-2xl font-bold text-white">{t('custom')}</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-white">
                          {t(`${key}.price`)}€
                        </span>
                        {key !== 'free' && (
                          <span className="text-gray-500 text-sm">
                            {key === 'team' ? t('perUser') : t('perMonth')}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-6">{t(`${key}.desc`)}</p>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {features.map((feature: string, fi: number) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: tierColors[i] }} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link href="/pricing">
                    <Button
                      variant={isPro ? 'primary' : 'outline'}
                      className="w-full"
                      size="sm"
                    >
                      {key === 'free'
                        ? t('getStarted')
                        : key === 'enterprise'
                          ? t('contactSales')
                          : t('subscribe')}
                    </Button>
                  </Link>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
