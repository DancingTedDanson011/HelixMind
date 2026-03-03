'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Clock, Check, X, AlertTriangle, Zap, Flame } from 'lucide-react';
import type { ToolPermissionRequest } from '@/lib/cli-types';

interface PermissionRequestCardProps {
  request: ToolPermissionRequest;
  onApprove: (mode?: 'once' | 'session' | 'yolo') => void;
  onDeny: () => void;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function toolIcon(name: string): string {
  const icons: Record<string, string> = {
    write_file: '\u{1F4DD}', edit_file: '\u270F\uFE0F', run_command: '\u{1F4BB}',
    git_commit: '\u{1F4E6}', browser_open: '\u{1F310}', browser_navigate: '\u{1F310}',
    browser_click: '\u{1F5B1}\uFE0F', browser_type: '\u2328\uFE0F',
    browser_screenshot: '\u{1F4F7}',
  };
  return icons[name] || '\u{1F527}';
}

export function PermissionRequestCard({ request, onApprove, onDeny }: PermissionRequestCardProps) {
  const [timeLeft, setTimeLeft] = useState(request.expiresAt - Date.now());
  const [resolved, setResolved] = useState<'approved' | 'denied' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = request.expiresAt - Date.now();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [request.expiresAt]);

  const isDangerous = request.permissionLevel === 'dangerous';
  const isExpired = timeLeft <= 0;
  const progressPct = Math.max(0, Math.min(100, (timeLeft / (request.expiresAt - request.timestamp)) * 100));

  const handleApprove = (mode?: 'once' | 'session' | 'yolo') => {
    setResolved('approved');
    onApprove(mode);
  };

  const handleDeny = () => {
    setResolved('denied');
    onDeny();
  };

  if (resolved) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
        resolved === 'approved'
          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          : 'bg-red-500/10 border border-red-500/20 text-red-400'
      }`}>
        {resolved === 'approved' ? <Check size={14} /> : <X size={14} />}
        <span className="font-medium">{resolved === 'approved' ? 'Approved' : 'Denied'}</span>
        <span className="text-gray-500 ml-1">{toolIcon(request.toolName)} {request.toolName}</span>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-500/10 border border-gray-500/20 text-xs text-gray-500">
        <Clock size={14} />
        <span className="font-medium">Expired</span>
        <span className="ml-1">{toolIcon(request.toolName)} {request.toolName}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden ${
      isDangerous
        ? 'bg-red-500/5 border border-red-500/20'
        : 'bg-amber-500/5 border border-amber-500/20'
    }`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${
        isDangerous ? 'bg-red-500/10' : 'bg-amber-500/10'
      }`}>
        {isDangerous ? (
          <ShieldAlert size={14} className="text-red-400" />
        ) : (
          <AlertTriangle size={14} className="text-amber-400" />
        )}
        <span className={`text-xs font-semibold uppercase tracking-wider ${
          isDangerous ? 'text-red-400' : 'text-amber-400'
        }`}>
          {isDangerous ? 'Dangerous' : 'Write'} Permission
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-gray-500">
          <Clock size={11} />
          <span className={`text-[11px] font-mono ${timeLeft < 60000 ? 'text-red-400' : ''}`}>
            {formatTimeLeft(timeLeft)}
          </span>
        </div>
      </div>

      {/* Detail */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0">{toolIcon(request.toolName)}</span>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all font-mono leading-relaxed flex-1 min-w-0">
            {request.detail}
          </pre>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isDangerous ? 'bg-red-500/40' : 'bg-amber-500/40'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={() => handleApprove('once')}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors"
        >
          <ShieldCheck size={13} />
          Approve
        </button>
        <button
          onClick={handleDeny}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium transition-colors"
        >
          <X size={13} />
          Deny
        </button>
        <button
          onClick={() => handleApprove('session')}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-medium transition-colors"
          title="Always allow — skip permissions for this session"
        >
          <Zap size={12} />
          Always
        </button>
        {isDangerous && (
          <button
            onClick={() => handleApprove('yolo')}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium transition-colors"
            title="YOLO mode — disable ALL confirmations (dangerous!)"
          >
            <Flame size={12} />
            YOLO
          </button>
        )}
      </div>
    </div>
  );
}
