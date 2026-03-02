'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/routing';

const tierKeys = ['free', 'freePlus', 'pro', 'team'] as const;

const tierAccents = ['#6c757d', '#00ff88', '#00d4ff', '#4169e1'];

export function PricingPreview() {
  const t = useTranslations('pricing');

  return (
    <section className="py-24 sm:py-32 px-4 relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[300px] rounded-full bg-primary/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[300px] rounded-full bg-accent/[0.03] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl relative">
        <div className="text-center mb-16">
          <motion.p
            className="font-display text-sm font-semibold tracking-[0.2em] uppercase text-primary/60 mb-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {t('sectionLabel')}
          </motion.p>

          <motion.h2
            className="heading-lg text-3xl sm:text-4xl text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            {t('title')}
          </motion.h2>

          <motion.p
            className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto font-light"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>
        </div>

        {/* 4-card grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tierKeys.map((key, i) => {
            const isPro = key === 'pro';
            const features = t.raw(`${key}.features`) as string[];
            const accent = tierAccents[i];

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className={`group relative h-full flex flex-col rounded-xl p-6 border transition-all duration-300 hover:border-white/[0.12] ${
                    isPro
                      ? 'border-primary/20 bg-primary/[0.03]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  {/* Popular badge */}
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-[10px] font-semibold text-primary tracking-wider uppercase">
                        {t('mostPopular')}
                      </span>
                    </div>
                  )}

                  <h3 className="font-display text-base font-semibold text-white mb-1 tracking-tight">
                    {t(`${key}.name`)}
                  </h3>

                  <div className="mb-4">
                    <span className="font-display text-3xl font-bold text-white">
                      ${t(`${key}.price`)}
                    </span>
                    <span className="text-gray-500 text-sm ml-0.5">
                      {key === 'free' || key === 'freePlus' ? '' : key === 'team' ? t('perUser') : t('perMonth')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-6 leading-relaxed">{t(`${key}.desc`)}</p>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {features.map((feature: string, fi: number) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-gray-400">
                        <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: accent }} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link href="/pricing">
                    <Button
                      variant={isPro ? 'primary' : 'outline'}
                      className="w-full font-display font-semibold tracking-wide"
                      size="sm"
                    >
                      {key === 'free' ? t('getStarted') : key === 'freePlus' ? t('loginFree') : t('subscribe')}
                    </Button>
                  </Link>

                  {/* Top accent line */}
                  {isPro && (
                    <div
                      className="absolute top-0 left-4 right-4 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)' }}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Enterprise — full width below */}
        <motion.div
          className="mt-6 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="rounded-xl p-6 border border-white/[0.06] bg-white/[0.02] flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-display text-lg font-semibold text-white mb-1 tracking-tight">
                {t('enterprise.name')}
              </h3>
              <p className="text-xs text-gray-500 mb-3">{t('enterprise.desc')}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {(t.raw('enterprise.features') as string[]).map((feature: string, fi: number) => (
                  <span key={fi} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Check size={11} className="flex-shrink-0" style={{ color: '#8a2be2' }} />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <a href="mailto:contact@helix-mind.ai?subject=Enterprise%20Inquiry" className="shrink-0">
              <Button
                variant="outline"
                className="font-display font-semibold tracking-wide"
                size="sm"
              >
                {t('contactSales')}
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
