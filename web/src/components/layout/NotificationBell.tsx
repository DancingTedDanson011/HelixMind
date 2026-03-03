'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, Check, Users, MessageSquare, CreditCard, Shield, Info } from 'lucide-react';
import { useNotifications, type AppNotification } from '@/hooks/use-notifications';

const typeIcons: Record<string, typeof Users> = {
  TEAM_INVITE: Users,
  TICKET_REPLY: MessageSquare,
  BILLING: CreditCard,
  SECURITY: Shield,
  SYSTEM: Info,
};

const typeColors: Record<string, string> = {
  TEAM_INVITE: 'text-cyan-400',
  TICKET_REPLY: 'text-blue-400',
  BILLING: 'text-amber-400',
  SECURITY: 'text-red-400',
  SYSTEM: 'text-gray-400',
};

function timeAgo(dateStr: string, t: (key: string, values?: Record<string, number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('daysAgo', { count: days });
}

export function NotificationBell() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllRead } =
    useNotifications();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  function handleNotificationClick(n: AppNotification) {
    if (!n.readAt) markAsRead(n.id);
    if (n.link) router.push(n.link);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/5 transition-colors"
        aria-label={t('title')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={18} className="text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">{t('title')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Check size={12} />
                {t('markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="h-4 w-4 mx-auto border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {t('empty')}
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcons[n.type] || Info;
                const color = typeColors[n.type] || 'text-gray-400';
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0"
                  >
                    {/* Unread indicator */}
                    <div className="mt-1.5 flex-shrink-0">
                      {!n.readAt ? (
                        <div className="h-2 w-2 rounded-full bg-cyan-400" />
                      ) : (
                        <div className="h-2 w-2" />
                      )}
                    </div>
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                      <Icon size={16} />
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${n.readAt ? 'text-gray-400' : 'text-white font-medium'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {timeAgo(n.createdAt, t)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
