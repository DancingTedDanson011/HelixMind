'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Mail, ArrowRight, Linkedin, Twitter } from 'lucide-react';
import { useState } from 'react';

export function EnterpriseCTA() {
  const t = useTranslations('enterprise.cta');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to an API
    console.log('Contact request:', email);
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-24 sm:py-32 px-4 relative">
      {/* Strong ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[500px] rounded-full bg-accent/[0.06] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-3xl relative">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="heading-lg text-3xl sm:text-4xl text-white mb-4">
            {t('title')}
          </h2>
          <p className="text-gray-400 text-base sm:text-lg font-light">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Contact form */}
        <motion.div
          className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cto@company.com"
                  required
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-white placeholder:text-gray-600 focus:border-accent/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('message')}</label>
                <textarea
                  placeholder={t('messagePlaceholder')}
                  rows={4}
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-white placeholder:text-gray-600 focus:border-accent/50 focus:outline-none transition-colors resize-none"
                />
              </div>
              <Button size="lg" className="w-full font-display font-semibold group">
                <Mail size={16} className="mr-2" />
                {t('submit')}
                <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <ArrowRight size={24} className="text-success" />
              </div>
              <h3 className="font-display font-semibold text-lg text-white mb-2">{t('success')}</h3>
              <p className="text-sm text-gray-400">{t('successDesc')}</p>
            </div>
          )}
        </motion.div>

        {/* Direct contact */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm text-gray-500 mb-4">{t('direct')}</p>
          <div className="flex justify-center gap-6">
            <a
              href="mailto:enterprise@helixmind.dev"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Mail size={14} />
              enterprise@helixmind.dev
            </a>
          </div>
        </motion.div>

        {/* Trust signals */}
        <motion.div
          className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-gray-600"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <span>{t('trust1')}</span>
          <span>•</span>
          <span>{t('trust2')}</span>
          <span>•</span>
          <span>{t('trust3')}</span>
        </motion.div>
      </div>
    </section>
  );
}
