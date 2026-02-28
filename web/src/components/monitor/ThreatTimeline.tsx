'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import type { ThreatEvent } from '@/lib/cli-types';

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface ThreatTimelineProps {
  threats: ThreatEvent[];
}

const SEVERITY_CONFIG = {
  critical: { color: 'border-red-500', dot: 'bg-red-500', text: 'text-red-400', icon: AlertCircle },
  high: { color: 'border-red-400', dot: 'bg-red-400', text: 'text-red-300', icon: AlertTriangle },
  medium: { color: 'border-yellow-400', dot: 'bg-yellow-400', text: 'text-yellow-300', icon: AlertTriangle },
  low: { color: 'border-gray-400', dot: 'bg-gray-400', text: 'text-gray-400', icon: Info },
  info: { color: 'border-gray-500', dot: 'bg-gray-500', text: 'text-gray-500', icon: Info },
} as const;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ThreatTimeline({ threats }: ThreatTimelineProps) {
  const t = useTranslations('monitor');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new threats
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [threats.length]);

  return (
    <motion.div variants={item}>
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('threats.timeline')}</h3>

        <div ref={scrollRef} className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {threats.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">{t('threats.noThreats')}</p>
          ) : (
            <AnimatePresence>
              {threats.map((threat) => {
                const cfg = SEVERITY_CONFIG[threat.severity] || SEVERITY_CONFIG.info;
                const Icon = cfg.icon;

                return (
                  <motion.div
                    key={threat.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border-l-2 ${cfg.color}`}
                  >
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                      <Icon size={14} className={cfg.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium ${cfg.text}`}>{threat.title}</span>
                        <span className="text-xs text-gray-500 shrink-0">{formatTime(threat.timestamp)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{threat.details}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-600">{threat.category}</span>
                        <span className="text-xs text-gray-600">{threat.source}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
