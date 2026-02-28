'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import type { UseCliConnectionReturn } from '@/hooks/use-cli-connection';
import { MonitorStatusBar } from './MonitorStatus';
import { ThreatTimeline } from './ThreatTimeline';
import { ApprovalQueue } from './ApprovalQueue';
import { ActiveDefenses } from './ActiveDefenses';

/* ---- Animation Variants ---- */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ---- Props ---- */

interface MonitorDashboardProps {
  connection: UseCliConnectionReturn;
}

/* ---- Component ---- */

export function MonitorDashboard({ connection }: MonitorDashboardProps) {
  const t = useTranslations('monitor');
  const isConnected = connection.connectionState === 'connected';

  const handleStop = useCallback(() => {
    connection.stopMonitor();
  }, [connection]);

  const handleRescan = useCallback(() => {
    connection.sendMonitorCommand('rescan');
  }, [connection]);

  const handleChangeMode = useCallback((mode: string) => {
    connection.sendMonitorCommand('set_mode', { mode });
  }, [connection]);

  const handleApprove = useCallback((requestId: string) => {
    connection.respondApproval(requestId, true);
  }, [connection]);

  const handleDeny = useCallback((requestId: string) => {
    connection.respondApproval(requestId, false);
  }, [connection]);

  const handleUndoDefense = useCallback((defenseId: string) => {
    connection.sendMonitorCommand('undo_defense', { defenseId });
  }, [connection]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield size={20} className="text-primary" />
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        </div>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </motion.div>

      {/* Status bar */}
      <MonitorStatusBar
        status={connection.monitorStatus}
        isConnected={isConnected}
        onStop={handleStop}
        onRescan={handleRescan}
        onChangeMode={handleChangeMode}
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Threat Timeline */}
        <ThreatTimeline threats={connection.threats} />

        {/* Right column */}
        <div className="space-y-4">
          {/* Active Defenses */}
          <ActiveDefenses
            defenses={connection.defenses}
            onUndo={handleUndoDefense}
          />

          {/* Approval Queue */}
          <ApprovalQueue
            approvals={connection.approvals}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        </div>
      </div>
    </motion.div>
  );
}
