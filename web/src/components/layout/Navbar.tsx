'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link, type AppHref } from '@/i18n/routing';
import { LocaleSwitcher } from './LocaleSwitcher';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { Menu, X, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Navbar() {
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navLinks = [
    { href: '/#modes' as const, label: t('modes') },
    { href: '/features' as const, label: t('features') },
    { href: '/enterprise' as const, label: t('enterprise') },
    { href: '/pricing' as const, label: t('pricing') },
    { href: '/docs' as const, label: t('docs') },
    { href: '/blog' as const, label: t('blog') },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${mobileOpen ? 'bg-background' : 'glass-strong'}`}>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-lg font-bold relative z-[60]">
            <span className="text-2xl">{'\uD83C\uDF00'}</span>
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
            <Link
              href={session?.user ? '/app' as AppHref : '/auth/signin' as AppHref}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-400/50 hover:shadow-[0_0_16px_rgba(0,212,255,0.2)] transition-all duration-200"
            >
              <Sparkles size={14} />
              {session?.user ? t('openApp') : t('getStarted')}
            </Link>
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <LocaleSwitcher />
            {session?.user && <NotificationBell />}
            <UserMenu />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-400 hover:text-white relative z-[60] p-2"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.div
                  key="close"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={24} />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu size={24} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>

      {/* Fullscreen mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Solid backdrop — fully opaque */}
            <div className="absolute inset-0 bg-background" />

            {/* Decorative elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
              <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-accent/[0.03] blur-[100px]" />
            </div>

            {/* Content — min-h-screen fallback + dvh override for mobile address bar */}
            <div className="relative flex flex-col px-8 pt-24 pb-8 overflow-y-auto min-h-screen" style={{ minHeight: '100dvh' }}>
              {/* Nav links — compact for small screens, staggered animation */}
              <nav className="space-y-0">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -32 }}
                    transition={{
                      delay: 0.1 + i * 0.07,
                      duration: 0.4,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Link
                      href={link.href}
                      className="group flex items-center justify-between py-2.5 border-b border-white/[0.04]"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="text-xl font-display font-bold text-white/90 group-hover:text-primary transition-colors duration-300">
                        {link.label}
                      </span>
                      <ArrowRight
                        size={16}
                        className="text-gray-700 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300"
                      />
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Open App button — below nav links */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{
                  delay: 0.1 + navLinks.length * 0.07 + 0.05,
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="mt-6"
              >
                <Link
                  href={session?.user ? '/app' as AppHref : '/auth/signin' as AppHref}
                  className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl text-lg font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all duration-200"
                  onClick={() => setMobileOpen(false)}
                >
                  <Sparkles size={20} />
                  {t('openApp')}
                </Link>
              </motion.div>

              {/* Bottom section — stacked for small screens */}
              <motion.div
                className="mt-auto pt-4 space-y-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LocaleSwitcher />
                    {session?.user && <NotificationBell />}
                  </div>
                  <UserMenu />
                </div>
                <div className="text-center text-xs text-gray-600 font-mono">HelixMind</div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
