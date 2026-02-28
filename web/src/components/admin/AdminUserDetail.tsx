'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft, Activity, Monitor, Key, Ticket,
  Calendar, Mail, Save, Clock,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  subscription?: { plan: string; status: string } | null;
  apiKeys?: { id: string; name: string; keyPrefix?: string; scopes?: string[]; createdAt: string }[];
  _count?: { tickets: number; usageLogs: number };
}

interface ActivityData {
  apiCallsThisMonth: number;
  tokenUsage: number;
  lastActive: string | null;
  recentActions: { id: string; action: string; metadata: unknown; createdAt: string }[];
}

interface TicketData {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  _count?: { messages: number };
}

type DetailTab = 'activity' | 'sessions' | 'apiKeys' | 'tickets';

const roleBadgeVariant: Record<string, 'default' | 'error' | 'warning' | 'primary'> = {
  USER: 'default',
  ADMIN: 'error',
  SUPPORT: 'warning',
};

const planBadgeVariant: Record<string, 'default' | 'primary' | 'spiral' | 'warning'> = {
  FREE: 'default',
  PRO: 'primary',
  TEAM: 'spiral',
  ENTERPRISE: 'warning',
};

const statusBadgeVariant: Record<string, 'default' | 'primary' | 'success' | 'warning'> = {
  OPEN: 'primary',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
};

/* ─── Props ───────────────────────────────────── */

interface AdminUserDetailProps {
  userId: string;
  userRole: string; // Viewer's role (ADMIN vs SUPPORT)
  onBack: () => void;
}

/* ─── Component ───────────────────────────────── */

export function AdminUserDetail({ userId, userRole, onBack }: AdminUserDetailProps) {
  const t = useTranslations('admin');
  const [user, setUser] = useState<UserData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('activity');
  const [editMode, setEditMode] = useState(false);
  const [editRole, setEditRole] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = userRole === 'ADMIN';

  // Fetch user data
  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {});
  }, [userId]);

  // Fetch activity when tab is active
  useEffect(() => {
    if (activeTab === 'activity') {
      fetch(`/api/admin/users/${userId}/activity`)
        .then((r) => r.json())
        .then(setActivity)
        .catch(() => {});
    }
  }, [userId, activeTab]);

  // Fetch tickets when tab is active
  useEffect(() => {
    if (activeTab === 'tickets') {
      fetch(`/api/admin/users/${userId}/tickets`)
        .then((r) => r.json())
        .then((data) => setTickets(data.tickets || []))
        .catch(() => {});
    }
  }, [userId, activeTab]);

  const startEdit = () => {
    if (!user) return;
    setEditRole(user.role);
    setEditPlan(user.subscription?.plan || 'FREE');
    setEditMode(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editRole, plan: editPlan }),
    });
    // Refresh user
    const res = await fetch(`/api/admin/users/${userId}`);
    setUser(await res.json());
    setSaving(false);
    setEditMode(false);
  };

  const tabs: { key: DetailTab; icon: typeof Activity; label: string }[] = [
    { key: 'activity', icon: Activity, label: t('userDetail.activity') },
    { key: 'sessions', icon: Monitor, label: t('userDetail.sessions') },
    { key: 'apiKeys', icon: Key, label: t('userDetail.apiKeys') },
    { key: 'tickets', icon: Ticket, label: t('userDetail.tickets') },
  ];

  if (!user) {
    return (
      <GlassPanel className="animate-pulse p-8">
        <div className="h-6 w-48 bg-white/5 rounded mb-4" />
        <div className="h-4 w-32 bg-white/5 rounded" />
      </GlassPanel>
    );
  }

  const plan = user.subscription?.plan || 'FREE';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
        {t('userDetail.back')}
      </button>

      {/* Header */}
      <GlassPanel>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {user.name || user.email}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Mail size={12} />
                {user.email}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {editMode ? (
                  <>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="USER">USER</option>
                      <option value="SUPPORT">SUPPORT</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <select
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value)}
                      className="bg-surface border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="FREE">FREE</option>
                      <option value="PRO">PRO</option>
                      <option value="TEAM">TEAM</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </>
                ) : (
                  <>
                    <Badge variant={roleBadgeVariant[user.role] || 'default'}>{user.role}</Badge>
                    <Badge variant={planBadgeVariant[plan] || 'default'}>{plan}</Badge>
                  </>
                )}
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <Calendar size={10} />
                  {t('userDetail.memberSince')} {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Edit controls - ADMIN only */}
          {isAdmin && (
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button size="sm" onClick={saveEdit} loading={saving}>
                    <Save size={12} />
                    {t('userManagement.save')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                    {t('userManagement.cancel')}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  {t('userDetail.editUser')}
                </Button>
              )}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] p-1 rounded-lg border border-white/5 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="user-detail-tab"
                  className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-md"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon size={12} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Activity */}
          {activeTab === 'activity' && (
            <GlassPanel>
              {activity ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                      <p className="text-2xl font-bold text-primary">{activity.apiCallsThisMonth}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('userDetail.apiCallsMonth')}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                      <p className="text-2xl font-bold text-accent">{activity.tokenUsage.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('userDetail.tokenUsage')}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                      <p className="text-sm font-medium text-white">
                        {activity.lastActive
                          ? new Date(activity.lastActive).toLocaleString()
                          : '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{t('userDetail.lastLogin')}</p>
                    </div>
                  </div>

                  {/* Recent actions */}
                  {activity.recentActions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-white mb-3">{t('userDetail.recentActions')}</h3>
                      <div className="space-y-2">
                        {activity.recentActions.slice(0, 10).map((action) => (
                          <div key={action.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-xs text-gray-400 font-mono">{action.action}</span>
                            <span className="text-[10px] text-gray-600">
                              {new Date(action.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activity.recentActions.length === 0 && (
                    <p className="text-sm text-gray-600 text-center py-6">{t('userDetail.noActivity')}</p>
                  )}
                </div>
              ) : (
                <div className="animate-pulse space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-20 bg-white/5 rounded-lg" />
                    ))}
                  </div>
                </div>
              )}
            </GlassPanel>
          )}

          {/* Sessions */}
          {activeTab === 'sessions' && (
            <GlassPanel className="text-center py-12">
              <Monitor size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">{t('userDetail.noSessions')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('userDetail.sessionsHint')}</p>
            </GlassPanel>
          )}

          {/* API Keys */}
          {activeTab === 'apiKeys' && (
            <GlassPanel>
              {user.apiKeys && user.apiKeys.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2.5 px-3 text-gray-400 text-xs uppercase">{t('userDetail.keyName')}</th>
                      {isAdmin && (
                        <th className="text-left py-2.5 px-3 text-gray-400 text-xs uppercase">{t('userDetail.keyPrefix')}</th>
                      )}
                      {isAdmin && (
                        <th className="text-left py-2.5 px-3 text-gray-400 text-xs uppercase">{t('userDetail.keyScopes')}</th>
                      )}
                      <th className="text-left py-2.5 px-3 text-gray-400 text-xs uppercase">{t('userDetail.keyCreated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.apiKeys.map((key) => (
                      <tr key={key.id} className="border-b border-white/5">
                        <td className="py-2.5 px-3 text-white">{key.name}</td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{key.keyPrefix || '—'}</td>
                        )}
                        {isAdmin && (
                          <td className="py-2.5 px-3">
                            {key.scopes?.map((s) => (
                              <Badge key={s} className="mr-1 text-[10px]">{s}</Badge>
                            )) || '—'}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-gray-500 text-xs">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-600 text-center py-8">{t('userDetail.noKeys')}</p>
              )}
            </GlassPanel>
          )}

          {/* Tickets */}
          {activeTab === 'tickets' && (
            <GlassPanel>
              {tickets.length > 0 ? (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-600 font-mono">#{ticket.number}</span>
                          <Badge variant={statusBadgeVariant[ticket.status] || 'default'}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                          <Badge>{ticket.priority}</Badge>
                        </div>
                        <p className="text-sm text-white">{ticket.subject}</p>
                      </div>
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(ticket.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 text-center py-8">{t('userDetail.noTickets')}</p>
              )}
            </GlassPanel>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
