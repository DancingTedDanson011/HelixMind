'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import type { Finding } from '@/lib/cli-types';

/* ─── Types ───────────────────────────────────── */

interface FindingsPanelProps {
  findings: Finding[];
}

/* ─── Constants ───────────────────────────────── */

type Severity = Finding['severity'];

const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const severityBadgeVariant: Record<Severity, 'error' | 'warning' | 'primary' | 'default'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'primary',
  info: 'default',
};

const severityIcon: Record<Severity, typeof AlertOctagon> = {
  critical: AlertOctagon,
  high: ShieldAlert,
  medium: AlertTriangle,
  low: Info,
  info: Info,
};

const severityColor: Record<Severity, string> = {
  critical: 'border-error/20',
  high: 'border-error/10',
  medium: 'border-warning/10',
  low: 'border-primary/10',
  info: 'border-white/5',
};

/* ─── Animation Variants ──────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

/* ─── Component ───────────────────────────────── */

export function FindingsPanel({ findings }: FindingsPanelProps) {
  const t = useTranslations('cli');

  // ── Group and sort by severity ─────────────────

  const grouped = useMemo(() => {
    const groups: Record<Severity, Finding[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    for (const finding of findings) {
      groups[finding.severity].push(finding);
    }

    return severityOrder
      .filter((sev) => groups[sev].length > 0)
      .map((sev) => ({ severity: sev, findings: groups[sev] }));
  }, [findings]);

  // ── Empty state ─────────────────────────────────

  if (findings.length === 0) {
    return (
      <GlassPanel intensity="subtle" className="p-6 text-center">
        <ShieldAlert size={20} className="text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t('noFindings')}</p>
      </GlassPanel>
    );
  }

  // ── Summary counts ─────────────────────────────

  const counts = useMemo(() => {
    const c: Partial<Record<Severity, number>> = {};
    for (const finding of findings) {
      c[finding.severity] = (c[finding.severity] || 0) + 1;
    }
    return c;
  }, [findings]);

  return (
    <div className="space-y-4">
      {/* ── Summary Bar ── */}
      <GlassPanel className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">{t('findings')}:</span>
          {severityOrder.map((sev) =>
            counts[sev] ? (
              <Badge key={sev} variant={severityBadgeVariant[sev]} className="text-[10px]">
                {counts[sev]} {sev}
              </Badge>
            ) : null,
          )}
        </div>
      </GlassPanel>

      {/* ── Grouped Findings ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {grouped.map((group) => {
          const SevIcon = severityIcon[group.severity];

          return (
            <motion.div key={group.severity} variants={item}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-2">
                <SevIcon
                  size={14}
                  className={
                    group.severity === 'critical' || group.severity === 'high'
                      ? 'text-error'
                      : group.severity === 'medium'
                        ? 'text-warning'
                        : 'text-gray-400'
                  }
                />
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {group.severity}
                </h4>
                <span className="text-xs text-gray-600">({group.findings.length})</span>
              </div>

              {/* Findings list */}
              <div className="space-y-2">
                {group.findings.map((finding, i) => (
                  <motion.div
                    key={`${finding.timestamp}-${i}`}
                    variants={item}
                    className={`
                      rounded-lg border bg-white/[0.01] p-3
                      ${severityColor[finding.severity]}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Badge variant={severityBadgeVariant[finding.severity]} className="text-[10px] flex-shrink-0">
                        {finding.severity}
                      </Badge>
                      <span className="text-[10px] text-gray-600 truncate">
                        {finding.sessionName}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {finding.finding}
                    </p>
                    {finding.file && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                        <FileText size={10} className="flex-shrink-0" />
                        <span className="font-mono truncate">{finding.file}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
