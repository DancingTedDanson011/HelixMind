/**
 * License checker — called at CLI startup.
 * Checks cache, re-validates if stale.
 */
import { validateLicense, getCachedLicense, isLicenseCacheStale } from './validator.js';

export interface LicenseStatus {
  valid: boolean;
  plan: string;
  features: string[];
  expiresAt: string;
}

export async function checkLicense(config: {
  licenseKey?: string;
  relayUrl?: string;
}): Promise<LicenseStatus> {
  if (!config.licenseKey) {
    return { valid: false, plan: 'FREE', features: [], expiresAt: '' };
  }

  const apiUrl = config.relayUrl || 'https://app.helixmind.dev';

  if (isLicenseCacheStale()) {
    const result = await validateLicense(config.licenseKey, apiUrl);
    return {
      valid: result.valid,
      plan: result.plan || 'FREE',
      features: result.features,
      expiresAt: result.expiresAt,
    };
  }

  const cached = getCachedLicense();
  return {
    valid: cached.valid,
    plan: cached.plan || 'FREE',
    features: cached.features,
    expiresAt: cached.expiresAt,
  };
}
