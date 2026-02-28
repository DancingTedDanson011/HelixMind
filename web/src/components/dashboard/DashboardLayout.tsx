'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Badge } from '@/components/ui/Badge';
import {
  LayoutDashboard,
  User,
  CreditCard,
  Key,
  LifeBuoy,
  Terminal,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    plan?: string;
  };
}

/* ─── Navigation ──────────────────────────────── */

const navItemDefs: { key: string; labelKey: string; href: string; icon: typeof LayoutDashboard }[] = [
  { key: 'home', labelKey: 'nav.home', href: '/dashboard', icon: LayoutDashboard },
  { key: 'cli', labelKey: 'nav.cli', href: '/dashboard/cli', icon: Terminal },
  { key: 'profile', labelKey: 'nav.profile', href: '/dashboard/profile', icon: User },
  { key: 'billing', labelKey: 'nav.billing', href: '/dashboard/billing', icon: CreditCard },
  { key: 'api-keys', labelKey: 'nav.apiKeys', href: '/dashboard/api-keys', icon: Key },
  { key: 'support', labelKey: 'nav.support', href: '/support/tickets', icon: LifeBuoy },
];

/* ─── Plan Badge Variant ──────────────────────── */

function planBadgeVariant(plan: string): 'default' | 'primary' | 'spiral' | 'warning' {
  switch (plan) {
    case 'PRO': return 'primary';
    case 'TEAM': return 'spiral';
    case 'ENTERPRISE': return 'warning';
    default: return 'default';
  }
}

/* ─── Component ───────────────────────────────── */

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = navItemDefs.map((item) => ({
    key: item.key,
    label: t(item.labelKey),
    href: item.href,
    icon: item.icon,
  }));

  // Strip locale prefix for matching (e.g., /en/dashboard -> /dashboard)
  const normalizedPath = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');

  const isActive = (href: string) => {
    if (href === '/dashboard') return normalizedPath === '/dashboard';
    return normalizedPath.startsWith(href);
  };

  const plan = user?.plan || 'FREE';
  const initials = (user?.name || user?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Mobile Toggle ── */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              <span>Menu</span>
            </button>
          </div>

          {/* ── Sidebar (Desktop) ── */}
          <div className="hidden lg:block lg:w-60 flex-shrink-0">
            <div className="sticky top-24 space-y-4">
              <GlassPanel className="p-2 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                        ${active
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                        }
                      `}
                    >
                      <item.icon size={16} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight size={14} className="opacity-50" />}
                    </Link>
                  );
                })}
              </GlassPanel>

              {/* User Info */}
              <GlassPanel intensity="subtle" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email || ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Badge variant={planBadgeVariant(plan)}>{plan}</Badge>
                </div>
              </GlassPanel>
            </div>
          </div>

          {/* ── Mobile Nav (Collapsible) ── */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="lg:hidden overflow-hidden"
              >
                <GlassPanel className="p-2 space-y-1">
                  {navItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                          ${active
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* User Info Mobile */}
                  <div className="mt-3 pt-3 border-t border-white/5 px-3 py-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{user?.name || 'User'}</p>
                    </div>
                    <Badge variant={planBadgeVariant(plan)} className="text-[10px]">{plan}</Badge>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Content Area ── */}
          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
