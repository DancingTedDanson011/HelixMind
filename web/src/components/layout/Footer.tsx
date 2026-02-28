'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useCookieConsent } from '@/components/cookie-consent/CookieConsentProvider';

export function Footer() {
  const t = useTranslations('footer');
  const { openSettings } = useCookieConsent();

  const columns = [
    {
      title: t('product'),
      links: [
        { href: '/features', label: 'Features' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/docs', label: 'Documentation' },
      ],
    },
    {
      title: t('resources'),
      links: [
        { href: '/blog', label: 'Blog' },
        { href: '/docs/getting-started', label: 'Getting Started' },
        { href: '/support', label: 'Support' },
      ],
    },
    {
      title: t('legal'),
      links: [
        { href: '/legal/privacy', label: t('privacy') },
        { href: '/legal/terms', label: t('terms') },
        { href: '/legal/imprint', label: t('imprint') },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/5 mt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold mb-4">
              <span className="text-2xl">🌀</span>
              <span className="gradient-text">HelixMind</span>
            </Link>
            <p className="text-sm text-gray-500 max-w-xs">
              AI Coding CLI with Spiral Memory. Open Source. AGPL-3.0.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-gray-300 mb-4">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href as any}
                      className="text-sm text-gray-500 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {col.title === t('legal') && (
                  <li>
                    <button
                      onClick={openSettings}
                      className="text-sm text-gray-500 hover:text-primary transition-colors"
                    >
                      {t('cookieSettings')}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 text-center text-xs text-gray-600">
          &copy; {new Date().getFullYear()} {t('copyright')}
        </div>
      </div>
    </footer>
  );
}
