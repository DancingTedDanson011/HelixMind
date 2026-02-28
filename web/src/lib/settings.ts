import { prisma } from './prisma';

// Cache settings for 60 seconds to avoid DB hits on every request
let cache: Map<string, { value: string; expires: number }> = new Map();
const CACHE_TTL = 60_000;

/**
 * Get a system setting from DB, falling back to env var.
 * Admin panel writes to DB; this reads DB first, then env.
 */
export async function getSetting(key: string, fallback?: string): Promise<string | null> {
  // Check cache
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });

    if (setting?.value) {
      cache.set(key, { value: setting.value, expires: Date.now() + CACHE_TTL });
      return setting.value;
    }
  } catch {
    // DB not available, fall through to env
  }

  // Fallback to env var
  const envVal = process.env[key];
  if (envVal) return envVal;

  return fallback ?? null;
}

/**
 * Set a system setting in the DB.
 */
export async function setSetting(
  key: string,
  value: string,
  opts: { category?: string; label?: string; description?: string; isSecret?: boolean; updatedBy?: string } = {},
) {
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value,
      ...(opts.updatedBy && { updatedBy: opts.updatedBy }),
    },
    create: {
      key,
      value,
      category: opts.category || 'general',
      label: opts.label || key,
      description: opts.description,
      isSecret: opts.isSecret ?? false,
      updatedBy: opts.updatedBy,
    },
  });

  // Invalidate cache
  cache.delete(key);

  return setting;
}

/**
 * Get all settings for a category (for admin panel display).
 */
export async function getSettingsByCategory(category?: string) {
  return prisma.systemSetting.findMany({
    where: category ? { category } : {},
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });
}

/**
 * Clear the settings cache (e.g., after admin update).
 */
export function clearSettingsCache() {
  cache.clear();
}

/**
 * Default settings to seed on first run.
 */
export const DEFAULT_SETTINGS = [
  // Auth
  { key: 'NEXTAUTH_SECRET', category: 'auth', label: 'NextAuth Secret', description: 'JWT signing secret (generate with: openssl rand -base64 32)', isSecret: true },
  { key: 'GITHUB_CLIENT_ID', category: 'auth', label: 'GitHub OAuth Client ID', description: 'From GitHub Developer Settings > OAuth Apps', isSecret: false },
  { key: 'GITHUB_CLIENT_SECRET', category: 'auth', label: 'GitHub OAuth Client Secret', description: 'From GitHub Developer Settings > OAuth Apps', isSecret: true },
  { key: 'GOOGLE_CLIENT_ID', category: 'auth', label: 'Google OAuth Client ID', description: 'From Google Cloud Console > Credentials', isSecret: false },
  { key: 'GOOGLE_CLIENT_SECRET', category: 'auth', label: 'Google OAuth Client Secret', description: 'From Google Cloud Console > Credentials', isSecret: true },
  // Payments
  { key: 'STRIPE_SECRET_KEY', category: 'payments', label: 'Stripe Secret Key', description: 'Stripe Dashboard > API Keys (starts with sk_)', isSecret: true },
  { key: 'STRIPE_WEBHOOK_SECRET', category: 'payments', label: 'Stripe Webhook Secret', description: 'Stripe Dashboard > Webhooks (starts with whsec_)', isSecret: true },
  { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', category: 'payments', label: 'Stripe Publishable Key', description: 'Stripe Dashboard > API Keys (starts with pk_)', isSecret: false },
  // Email
  { key: 'RESEND_API_KEY', category: 'email', label: 'Resend API Key', description: 'From Resend Dashboard > API Keys', isSecret: true },
  { key: 'EMAIL_FROM', category: 'email', label: 'Email From Address', description: 'Sender address for transactional emails', isSecret: false },
  // General
  { key: 'NEXT_PUBLIC_APP_URL', category: 'general', label: 'App URL', description: 'Public URL of the application', isSecret: false },
  { key: 'NEXT_PUBLIC_APP_NAME', category: 'general', label: 'App Name', description: 'Application display name', isSecret: false },
] as const;
