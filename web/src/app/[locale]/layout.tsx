import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { CookieConsentProvider } from '@/components/cookie-consent/CookieConsentProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import '@/styles/globals.css';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export const viewport: Viewport = {
  themeColor: '#050510',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: {
      default: t('title'),
      template: `%s | HelixMind`,
    },
    description: t('description'),
    applicationName: 'HelixMind',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'HelixMind',
    },
    formatDetection: {
      telephone: false,
    },
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    icons: {
      icon: '/icons/favicon.svg',
      apple: '/icons/apple-touch-icon.svg',
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: 'HelixMind',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>
          <NextIntlClientProvider messages={messages}>
            <CookieConsentProvider>
              <ToastProvider>
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
                <InstallPrompt />
              </ToastProvider>
            </CookieConsentProvider>
          </NextIntlClientProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
