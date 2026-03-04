import { NextResponse } from 'next/server';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  identifier?: (req: Request) => string;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        if (now - entry.lastRefill > 600_000) {
          store.delete(key);
        }
      }
    }
  }, 300_000);
  if (cleanupInterval?.unref) cleanupInterval.unref();
}

function getIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function rateLimit(namespace: string, config: RateLimitConfig) {
  ensureCleanup();

  if (!stores.has(namespace)) {
    stores.set(namespace, new Map());
  }
  const store = stores.get(namespace)!;

  return {
    check(req: Request): { success: boolean; remaining: number; resetMs: number } {
      const key = config.identifier ? config.identifier(req) : getIdentifier(req);
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { tokens: config.maxTokens, lastRefill: now };
        store.set(key, entry);
      }

      const elapsed = (now - entry.lastRefill) / 1000;
      entry.tokens = Math.min(config.maxTokens, entry.tokens + elapsed * config.refillRate);
      entry.lastRefill = now;

      if (entry.tokens >= 1) {
        entry.tokens -= 1;
        return {
          success: true,
          remaining: Math.floor(entry.tokens),
          resetMs: Math.ceil((1 / config.refillRate) * 1000),
        };
      }

      const resetMs = Math.ceil(((1 - entry.tokens) / config.refillRate) * 1000);
      return { success: false, remaining: 0, resetMs };
    },
  };
}

/**
 * Check rate limit — returns null if allowed, or 429 response if blocked.
 */
export function checkRateLimit(
  req: Request,
  namespace: string,
  config: RateLimitConfig,
): NextResponse | null {
  const limiter = rateLimit(namespace, config);
  const result = limiter.check(req);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.resetMs / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  return null;
}

// ─── Presets ────────────────────────────────────

/** Auth endpoints: 5 requests per minute */
export const AUTH_RATE_LIMIT: RateLimitConfig = { maxTokens: 5, refillRate: 5 / 60 };

/** Registration: 3 requests per hour */
export const REGISTER_RATE_LIMIT: RateLimitConfig = { maxTokens: 3, refillRate: 3 / 3600 };

/** LLM/AI endpoints: 10 requests per minute */
export const AI_RATE_LIMIT: RateLimitConfig = { maxTokens: 10, refillRate: 10 / 60 };

/** Device code request: 5 per 15 minutes */
export const DEVICE_CODE_RATE_LIMIT: RateLimitConfig = { maxTokens: 5, refillRate: 5 / 900 };

/** Device code poll: 60 per minute */
export const DEVICE_POLL_RATE_LIMIT: RateLimitConfig = { maxTokens: 60, refillRate: 1 };

/** General API: 60 requests per minute */
export const GENERAL_RATE_LIMIT: RateLimitConfig = { maxTokens: 60, refillRate: 1 };
