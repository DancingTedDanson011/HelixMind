import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Protected paths — auth check happens in page components (not middleware)
// because Prisma doesn't work in Edge runtime.
// Middleware only handles: i18n + session cookie check (no DB).

const authPaths = ['/dashboard', '/support/tickets', '/support/panel', '/admin'];

function getPathWithoutLocale(pathname: string): string {
  return pathname.replace(/^\/(en|de)(\/|$)/, '/');
}

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip API/static/serwist
  if (pathname.startsWith('/serwist') || pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const pathWithoutLocale = getPathWithoutLocale(pathname);
  const needsAuth = authPaths.some((p) => pathWithoutLocale.startsWith(p));

  if (needsAuth) {
    // Check for NextAuth session cookie (lightweight, no DB)
    const hasSession =
      request.cookies.has('next-auth.session-token') ||
      request.cookies.has('__Secure-next-auth.session-token') ||
      request.cookies.has('authjs.session-token') ||
      request.cookies.has('__Secure-authjs.session-token');

    if (!hasSession) {
      const locale = pathname.match(/^\/(en|de)/)?.[1] || 'en';
      const isStaffPath = pathWithoutLocale.startsWith('/admin') || pathWithoutLocale.startsWith('/support/panel');
      const loginPath = isStaffPath ? `/${locale}/auth/staff` : `/${locale}/auth/login`;
      return NextResponse.redirect(new URL(loginPath, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/',
    '/(de|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
