'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Zap,
  Shield,
  StopCircle,
  SendHorizontal,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface CommandPanelProps {
  onStartAuto: (goal?: string) => void;
  onStartSecurity: () => void;
  onStopAll: () => void;
  onSendChat: (text: string) => void;
  disabled: boolean;
}

/* ─── Component ───────────────────────────────── */

export function CommandPanel({
  onStartAuto,
  onStartSecurity,
  onStopAll,
  onSendChat,
  disabled,
}: CommandPanelProps) {
  const t = useTranslations('cli');

  const [autoGoal, setAutoGoal] = useState('');
  const [chatText, setChatText] = useState('');
  const [autoLoading, setAutoLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Focus chat input on mount
  useEffect(() => {
    if (!disabled) chatInputRef.current?.focus();
  }, [disabled]);

  // ── Handlers ────────────────────────────────────

  const handleStartAuto = useCallback(async () => {
    setAutoLoading(true);
    try {
      onStartAuto(autoGoal.trim() || undefined);
      setAutoGoal('');
    } finally {
      // Reset loading after a brief delay (actual status comes via polling)
      setTimeout(() => setAutoLoading(false), 1500);
    }
  }, [autoGoal, onStartAuto]);

  const handleStartSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      onStartSecurity();
    } finally {
      setTimeout(() => setSecurityLoading(false), 1500);
    }
  }, [onStartSecurity]);

  const handleSendChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (chatText.trim()) {
        onSendChat(chatText.trim());
        setChatText('');
      }
    },
    [chatText, onSendChat],
  );

  return (
    <GlassPanel className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {t('commands')}
      </h3>

      {/* ── Auto Mode ── */}
      <div className="flex gap-2">
        <Input
          value={autoGoal}
          onChange={(e) => setAutoGoal(e.target.value)}
          placeholder={t('autoGoalPlaceholder')}
          disabled={disabled}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleStartAuto();
          }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleStartAuto}
          disabled={disabled}
          loading={autoLoading}
          className="flex-shrink-0"
        >
          <Zap size={14} />
          {t('startAuto')}
        </Button>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleStartSecurity}
          disabled={disabled}
          loading={securityLoading}
          className="flex-1"
        >
          <Shield size={14} />
          {t('securityAudit')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onStopAll}
          disabled={disabled}
          className="flex-1"
        >
          <StopCircle size={14} />
          {t('stopAll')}
        </Button>
      </div>

      {/* ── Chat Input ── */}
      <div className="border-t border-white/5 pt-4">
        <form onSubmit={handleSendChat} className="flex gap-2">
          <Input
            ref={chatInputRef}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder={t('chatPlaceholder')}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={disabled || !chatText.trim()}
            className="flex-shrink-0"
          >
            <SendHorizontal size={14} />
          </Button>
        </form>
      </div>
    </GlassPanel>
  );
}
