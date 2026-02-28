'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { locales } from '@/i18n/config';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
            locale === l
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'text-gray-500 hover:text-gray-300 border border-transparent'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
