/* ─── Cookie Consent Types & Constants ────────── */

export const COOKIE_CONSENT_NAME = 'hx-consent';
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

export type CookieCategory = 'essential' | 'analytics' | 'marketing';

export interface CookieConsent {
  version: number;
  timestamp: string; // ISO 8601
  essential: true;
  analytics: boolean;
  marketing: boolean;
}

export type ConsentStatus = 'undecided' | 'decided';

export interface CookieConsentContextValue {
  consent: CookieConsent | null;
  status: ConsentStatus;
  showBanner: boolean;
  showSettings: boolean;
  hasConsent: (category: CookieCategory) => boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: Pick<CookieConsent, 'analytics' | 'marketing'>) => void;
  openSettings: () => void;
  closeSettings: () => void;
  resetConsent: () => void;
}
