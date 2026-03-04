import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import type { ComponentProps } from 'react';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/** Typed href for next-intl Link — use for dynamic or non-i18n paths */
export type AppHref = ComponentProps<typeof Link>['href'];
