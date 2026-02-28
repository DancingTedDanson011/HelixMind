'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import type { ApprovalRequest } from '@/lib/cli-types';

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

const SEVERITY_COLORS = {
  critical: 'border-red-500/30 bg-red-500/[0.03]',
  high: 'border-red-400/20 bg-red-400/[0.02]',
  medium: 'border-yellow-400/20',
  low: 'border-gray-400/10',
  info: 'border-gray-500/10',
} as const;

function CountdownTimer({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, expiresAt - Date.now());
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <Clock size={10} />
      {minutes}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

export function ApprovalQueue({ approvals, onApprove, onDeny }: ApprovalQueueProps) {
  const t = useTranslations('monitor');

  return (
    <motion.div variants={item}>
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          {t('approvals.pending')} {approvals.length > 0 && <span className="text-yellow-400">({approvals.length})</span>}
        </h3>

        <div className="space-y-2">
          {approvals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">{t('approvals.noPending')}</p>
          ) : (
            <AnimatePresence>
              {approvals.map((req) => {
                const colorClass = SEVERITY_COLORS[req.severity] || SEVERITY_COLORS.info;

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-3 rounded-lg border ${colorClass}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{req.action}</span>
                        <span className="text-xs text-gray-500">&rarr;</span>
                        <span className="text-sm text-gray-400">{req.target}</span>
                      </div>
                      <CountdownTimer expiresAt={req.expiresAt} />
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{req.reason}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onApprove(req.id)}
                        className="flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-colors"
                      >
                        <Check size={12} />
                        {t('approvals.approve')}
                      </button>
                      <button
                        onClick={() => onDeny(req.id)}
                        className="flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                      >
                        <X size={12} />
                        {t('approvals.deny')}
                      </button>
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
