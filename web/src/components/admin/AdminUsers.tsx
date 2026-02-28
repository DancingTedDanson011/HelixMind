'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AdminUserDetail } from './AdminUserDetail';
import {
  Search, ChevronLeft, ChevronRight, Users,
  UserCog, Mail, Calendar, TicketIcon,
} from 'lucide-react';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  locale: string;
  createdAt: string;
  subscription?: { plan: string; status: string } | null;
  _count?: { tickets: number };
}

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

const tableRowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.3 },
  }),
};

interface AdminUsersProps {
  userRole?: string;
}

export function AdminUsers({ userRole = 'ADMIN' }: AdminUsersProps) {
  const t = useTranslations('admin');
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchUsers = async (p = page, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '15' });
      if (s) params.set('search', s);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      // Keep existing state on error
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchUsers(1, search);
  };

  // Show user detail when selected
  if (selectedUserId) {
    return (
      <AdminUserDetail
        userId={selectedUserId}
        userRole={userRole}
        onBack={() => setSelectedUserId(null)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-white">{t('userManagement.title')}</h2>
        </div>
        <span className="text-sm text-gray-500">{t('userManagement.totalCount', { count: total })}</span>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('userManagement.searchPlaceholder')}
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>
          <Search size={16} />
          {t('userManagement.search')}
        </Button>
      </div>

      {/* Table */}
      <GlassPanel className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3.5 px-5 text-gray-400 font-medium text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <UserCog size={12} />
                  {t('userManagement.user')}
                </div>
              </th>
              <th className="text-left py-3.5 px-5 text-gray-400 font-medium text-xs uppercase tracking-wider">{t('userManagement.role')}</th>
              <th className="text-left py-3.5 px-5 text-gray-400 font-medium text-xs uppercase tracking-wider">{t('userManagement.plan')}</th>
              <th className="text-left py-3.5 px-5 text-gray-400 font-medium text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {t('userManagement.joined')}
                </div>
              </th>
              <th className="text-left py-3.5 px-5 text-gray-400 font-medium text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <TicketIcon size={12} />
                  {t('userManagement.tickets')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {loading && users.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-white/5">
                    <td className="py-3.5 px-5" colSpan={5}>
                      <div className="h-5 bg-white/5 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : (
                users.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    custom={i}
                    variants={tableRowVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, x: -10 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name || t('userManagement.unnamed')}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail size={10} />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge variant={roleBadgeVariant[user.role] || 'default'}>{user.role}</Badge>
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge variant={planBadgeVariant[user.subscription?.plan || 'FREE'] || 'default'}>
                        {user.subscription?.plan || 'FREE'}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-gray-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`text-xs font-mono ${(user._count?.tickets || 0) > 0 ? 'text-warning' : 'text-gray-600'}`}>
                        {user._count?.tickets || 0}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>

        {!loading && users.length === 0 && (
          <div className="text-center py-12">
            <Users size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">{t('userManagement.noUsers')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('userManagement.adjustSearch')}</p>
          </div>
        )}
      </GlassPanel>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-4"
        >
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    page === pageNum
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && (
              <>
                <span className="text-gray-600">...</span>
                <button
                  onClick={() => setPage(totalPages)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    page === totalPages
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
