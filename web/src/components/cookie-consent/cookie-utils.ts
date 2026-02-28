import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VERSION,
  COOKIE_MAX_AGE_SECONDS,
  type CookieConsent,
} from '@/lib/cookie-consent';

export function readConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_CONSENT_NAME}=`));

  if (!match) return null;

  try {
    const value = match.split('=')[1];
    const decoded = atob(decodeURIComponent(value));
    const parsed: CookieConsent = JSON.parse(decoded);

    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (typeof parsed.essential !== 'boolean') return null;
    if (typeof parsed.analytics !== 'boolean') return null;
    if (typeof parsed.marketing !== 'boolean') return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(consent: CookieConsent): void {
  const encoded = encodeURIComponent(btoa(JSON.stringify(consent)));
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_CONSENT_NAME}=${encoded}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`;
}

export function deleteConsent(): void {
  document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
}
