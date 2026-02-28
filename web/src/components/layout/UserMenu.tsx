'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import {
  User,
  LogOut,
  LayoutDashboard,
  Shield,
  HeadphonesIcon,
  ChevronDown,
} from 'lucide-react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return (
      <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <>
        <Link href="/auth/login">
          <Button variant="ghost" size="sm">{t('login')}</Button>
        </Link>
        <Link href="/auth/register">
          <Button size="sm">{t('getStarted')}</Button>
        </Link>
      </>
    );
  }

  const user = session.user;
  const isAdmin = user.role === 'ADMIN';
  const isSupport = user.role === 'SUPPORT';
  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
      >
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="h-7 w-7 rounded-full ring-1 ring-white/10"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-medium text-white/80 ring-1 ring-white/10">
            {initials}
          </div>
        )}
        <span className="text-sm text-gray-300 hidden lg:block max-w-[120px] truncate">
          {user.name || user.email}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/10 bg-[#0a0a1a]/95 backdrop-blur-xl shadow-2xl py-1 z-50">
          {/* User info */}
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-sm font-medium text-white truncate">
              {user.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {(isAdmin || isSupport) && (
              <span
                className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isAdmin
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                }`}
              >
                {user.role}
              </span>
            )}
          </div>

          {/* Links */}
          <div className="py-1">
            <MenuLink
              href="/dashboard"
              icon={<LayoutDashboard size={15} />}
              label={t('dashboard')}
              onClick={() => setOpen(false)}
            />

            {isAdmin && (
              <MenuLink
                href="/admin"
                icon={<Shield size={15} />}
                label="Admin Panel"
                onClick={() => setOpen(false)}
              />
            )}

            {(isAdmin || isSupport) && (
              <MenuLink
                href="/support/panel"
                icon={<HeadphonesIcon size={15} />}
                label="Support Panel"
                onClick={() => setOpen(false)}
              />
            )}
          </div>

          {/* Sign out */}
          <div className="border-t border-white/5 py-1">
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: '/' });
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: '/dashboard' | '/admin' | '/support/panel';
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
