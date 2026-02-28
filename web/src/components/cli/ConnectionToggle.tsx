'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Monitor, Globe } from 'lucide-react';

interface ConnectionToggleProps {
  mode: 'local' | 'relay';
  onModeChange: (mode: 'local' | 'relay') => void;
}

const options = [
  { key: 'local' as const, icon: Monitor },
  { key: 'relay' as const, icon: Globe },
] as const;

export function ConnectionToggle({ mode, onModeChange }: ConnectionToggleProps) {
  const t = useTranslations('cli');

  return (
    <div className="flex justify-center">
      <div className="relative inline-flex rounded-xl bg-white/[0.03] border border-white/10 p-1 gap-1">
        {options.map((opt) => {
          const isActive = mode === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              onClick={() => onModeChange(opt.key)}
              className={`
                relative flex items-center gap-2.5 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200
                ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="connection-toggle-highlight"
                  className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-lg"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon size={15} className="relative z-10" />
              <span className="relative z-10">
                {opt.key === 'local' ? t('mode_local') : t('mode_remote')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
