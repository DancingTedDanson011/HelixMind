'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  COOKIE_CONSENT_VERSION,
  type CookieCategory,
  type CookieConsent,
  type CookieConsentContextValue,
  type ConsentStatus,
} from '@/lib/cookie-consent';
import { readConsent, writeConsent, deleteConsent } from './cookie-utils';
import { CookieBanner } from './CookieBanner';
import { CookieSettings } from './CookieSettings';

/* ─── Context ─────────────────────────────────── */

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

/* ─── Provider ────────────────────────────────── */

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read cookie after hydration to avoid SSR mismatch
  useEffect(() => {
    const existing = readConsent();
    if (existing) {
      setConsent(existing);
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
    setHydrated(true);
  }, []);

  const saveConsent = useCallback((c: CookieConsent) => {
    writeConsent(c);
    setConsent(c);
    setShowBanner(false);
    setShowSettings(false);
  }, []);

  const acceptAll = useCallback(() => {
    saveConsent({
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: true,
      marketing: true,
    });
  }, [saveConsent]);

  const rejectAll = useCallback(() => {
    saveConsent({
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: false,
      marketing: false,
    });
  }, [saveConsent]);

  const savePreferences = useCallback(
    (prefs: Pick<CookieConsent, 'analytics' | 'marketing'>) => {
      saveConsent({
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
        essential: true,
        ...prefs,
      });
    },
    [saveConsent],
  );

  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const resetConsent = useCallback(() => {
    deleteConsent();
    setConsent(null);
    setShowBanner(true);
  }, []);

  const hasConsent = useCallback(
    (category: CookieCategory): boolean => {
      if (category === 'essential') return true;
      return consent?.[category] ?? false;
    },
    [consent],
  );

  const status: ConsentStatus = consent ? 'decided' : 'undecided';

  const value: CookieConsentContextValue = {
    consent,
    status,
    showBanner: hydrated && showBanner,
    showSettings,
    hasConsent,
    acceptAll,
    rejectAll,
    savePreferences,
    openSettings,
    closeSettings,
    resetConsent,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      <CookieBanner />
      <CookieSettings />
    </CookieConsentContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────── */

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return ctx;
}
