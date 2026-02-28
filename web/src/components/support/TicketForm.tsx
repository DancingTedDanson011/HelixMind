'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Send, AlertTriangle, Bug, CreditCard, Lightbulb, HelpCircle,
  ChevronDown, ArrowUp, ArrowRight, ArrowDown,
} from 'lucide-react';

type Category = 'GENERAL' | 'BUG' | 'BILLING' | 'FEATURE';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

const categoryIcons: Record<Category, { icon: typeof HelpCircle; color: string }> = {
  GENERAL: { icon: HelpCircle, color: 'text-gray-400' },
  BUG: { icon: Bug, color: 'text-error' },
  BILLING: { icon: CreditCard, color: 'text-warning' },
  FEATURE: { icon: Lightbulb, color: 'text-primary' },
};

const categoryKeys: Record<Category, string> = {
  GENERAL: 'categoryGeneral',
  BUG: 'categoryBug',
  BILLING: 'categoryBilling',
  FEATURE: 'categoryFeature',
};

const priorityIcons: Record<Priority, { icon: typeof ArrowUp; color: string; badge: string }> = {
  LOW: { icon: ArrowDown, color: 'text-success', badge: 'bg-success/10 border-success/20 text-success' },
  MEDIUM: { icon: ArrowRight, color: 'text-warning', badge: 'bg-warning/10 border-warning/20 text-warning' },
  HIGH: { icon: ArrowUp, color: 'text-error', badge: 'bg-error/10 border-error/20 text-error' },
};

const priorityKeys: Record<Priority, string> = {
  LOW: 'priorityLow',
  MEDIUM: 'priorityMedium',
  HIGH: 'priorityHigh',
};

interface TicketFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TicketForm({ onSuccess, onCancel }: TicketFormProps) {
  const t = useTranslations('ticket');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<Category>('GENERAL');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!subject.trim()) {
      newErrors.subject = t('subjectRequired');
    } else if (subject.trim().length < 5) {
      newErrors.subject = t('subjectMinLength');
    } else if (subject.trim().length > 200) {
      newErrors.subject = t('subjectMaxLength');
    }

    if (!description.trim()) {
      newErrors.description = t('descriptionRequired');
    } else if (description.trim().length < 10) {
      newErrors.description = t('descriptionMinLength');
    } else if (description.trim().length > 5000) {
      newErrors.description = t('descriptionMaxLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          content: description.trim(),
          category,
          priority,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || t('submitFailed'));
        return;
      }

      setSubject('');
      setCategory('GENERAL');
      setPriority('MEDIUM');
      setDescription('');
      setErrors({});
      onSuccess?.();
    } catch {
      setSubmitError(t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <GlassPanel>
        <h2 className="text-lg font-semibold text-white mb-6">{t('createTitle')}</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Subject */}
          <Input
            id="ticket-subject"
            label={t('subjectLabel')}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (errors.subject) setErrors((prev) => ({ ...prev, subject: '' }));
            }}
            placeholder={t('subjectPlaceholder')}
            error={errors.subject}
          />

          {/* Category & Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">{t('categoryLabel')}</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full appearance-none rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 hover:border-white/20 cursor-pointer"
                >
                  {(Object.keys(categoryIcons) as Category[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {t(categoryKeys[cat])}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                />
              </div>
              {/* Category visual indicator */}
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const config = categoryIcons[category];
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon size={12} className={config.color} />
                      <span className={`text-xs ${config.color}`}>{t(categoryKeys[category])}</span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">{t('priorityLabel')}</label>
              <div className="flex gap-2">
                {(Object.keys(priorityIcons) as Priority[]).map((p) => {
                  const config = priorityIcons[p];
                  const Icon = config.icon;
                  const isActive = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer ${
                        isActive
                          ? config.badge
                          : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <Icon size={12} />
                      {t(priorityKeys[p])}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">{t('descriptionLabel')}</label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              rows={6}
              placeholder={t('descriptionPlaceholder')}
              className={`w-full rounded-lg border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all duration-200 resize-none ${
                errors.description
                  ? 'border-error/50 focus:ring-error/50'
                  : 'border-white/10 hover:border-white/20'
              }`}
            />
            <div className="flex items-center justify-between">
              {errors.description ? (
                <p className="text-xs text-error">{errors.description}</p>
              ) : (
                <span />
              )}
              <span className={`text-xs ${description.length > 4500 ? 'text-warning' : 'text-gray-600'}`}>
                {description.length}/5000
              </span>
            </div>
          </div>

          {/* Submit error */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-sm text-error bg-error/5 border border-error/10 rounded-lg px-4 py-3"
              >
                <AlertTriangle size={14} />
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={loading}>
              <Send size={14} />
              {t('submitButton')}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t('cancelButton')}
              </Button>
            )}
          </div>
        </form>
      </GlassPanel>
    </motion.div>
  );
}
