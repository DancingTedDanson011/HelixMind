'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Github } from 'lucide-react';

export function CtaSection() {
  const t = useTranslations('cta');

  return (
    <section className="py-32 px-4">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="gradient-text">{t('title')}</span>
          </h2>
          <p className="text-gray-300 text-lg mb-10">{t('subtitle')}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg">{t('button')}</Button>
            <Button variant="outline" size="lg">
              <Github size={18} />
              {t('github')}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
