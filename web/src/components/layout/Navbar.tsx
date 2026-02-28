'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { LocaleSwitcher } from './LocaleSwitcher';
import { UserMenu } from './UserMenu';
import { Menu, X, Sparkles } from 'lucide-react';

export function Navbar() {
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/features' as const, label: t('features') },
    { href: '/pricing' as const, label: t('pricing') },
    { href: '/docs' as const, label: t('docs') },
    { href: '/blog' as const, label: t('blog') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="text-2xl">🌀</span>
            <span className="gradient-text">HelixMind</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {session?.user && (
              <Link
                href={'/app' as any}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Sparkles size={14} />
                App
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher />
            <UserMenu />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-400 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/5 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-gray-400 hover:text-white py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {session?.user && (
              <Link
                href={'/app' as any}
                className="flex items-center gap-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300 py-2"
                onClick={() => setMobileOpen(false)}
              >
                <Sparkles size={14} />
                App
              </Link>
            )}
            <div className="flex items-center gap-3 pt-3 border-t border-white/5">
              <LocaleSwitcher />
              <UserMenu />
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
