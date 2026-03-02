/**
 * License validator — sends key to web API, caches result locally.
 * Cache: ~/.helixmind/license.json with 24h TTL.
 * Offline fallback: cached license valid until expiresAt.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface CachedLicense {
  valid: boolean;
  plan: string;
  seats: number;
  features: string[];
  expiresAt: string;
  cachedAt: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DIR = join(homedir(), '.helixmind');
const CACHE_FILE = join(CACHE_DIR, 'license.json');

const EMPTY_LICENSE: CachedLicense = {
  valid: false,
  plan: '',
  seats: 0,
  features: [],
  expiresAt: '',
  cachedAt: 0,
};

export async function validateLicense(
  licenseKey: string,
  apiUrl: string,
): Promise<CachedLicense> {
  try {
    const res = await fetch(`${apiUrl}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (data.valid) {
      const cached: CachedLicense = {
        valid: true,
        plan: String(data.plan || ''),
        seats: Number(data.seats || 0),
        features: Array.isArray(data.features) ? data.features as string[] : [],
        expiresAt: String(data.expiresAt || ''),
        cachedAt: Date.now(),
      };
      saveLicenseCache(cached);
      return cached;
    }
    return { ...EMPTY_LICENSE, cachedAt: Date.now() };
  } catch {
    // Offline — use cache
    return loadLicenseCache();
  }
}

function saveLicenseCache(license: CachedLicense): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(license, null, 2));
  } catch { /* ignore write errors */ }
}

export function loadLicenseCache(): CachedLicense {
  try {
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CachedLicense;
    if (data.valid && new Date(data.expiresAt) > new Date()) {
      return data;
    }
  } catch { /* no cache */ }
  return EMPTY_LICENSE;
}

export function getCachedLicense(): CachedLicense {
  return loadLicenseCache();
}

export function isLicenseCacheStale(): boolean {
  const cached = loadLicenseCache();
  return !cached.valid || Date.now() - cached.cachedAt > CACHE_TTL;
}
