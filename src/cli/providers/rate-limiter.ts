/**
 * Intelligent rate limiter with exponential backoff and proactive throttling.
 * Tracks API call timing, parses retry-after headers from errors,
 * and preemptively delays when approaching rate limits.
 *
 * FIX: PROVIDERS-C2 — Converted module-global state to a RateLimiter class.
 * A default singleton is kept so module-level exports stay backward compatible,
 * but each Provider should now own a private RateLimiter instance.
 */

export interface RateLimitState {
  /** Timestamps of recent API calls (ms) */
  callTimestamps: number[];
  /** When we can next make a call (ms, 0 = no limit) */
  nextAllowedAt: number;
  /** Current backoff level (resets on success) */
  backoffLevel: number;
  /** Total retries this session */
  totalRetries: number;
}

/** Backoff delays in ms: 2s, 5s, 10s, 20s, 30s, 60s */
const BACKOFF_DELAYS = [2000, 5000, 10000, 20000, 30000, 60000];

/** Window size for tracking calls (60 seconds) */
const WINDOW_MS = 60_000;

/** Max calls per window before proactive throttling */
const PROACTIVE_THRESHOLD = 25;

/** Minimum gap between calls in ms (prevents burst) */
const MIN_GAP_MS = 500;

/** FIX: PROVIDERS-m1 — Never block longer than 2 minutes, even on repeated errors */
const MAX_WAIT_MS = 120_000;

/** FIX: PROVIDERS-s1 — Pre-compile regexes at module scope */
const RETRY_AFTER_REGEX = /retry.?after[:\s]*(\d+)/i;
const TOKENS_PER_MINUTE_REGEX = /(\d+[,.]?\d*)\s*input tokens per minute/i;

/** Listener for rate limit wait events */
export type WaitListener = (waitMs: number, reason: string) => void;

/**
 * Extract a retry-after value in ms from the headers attached to an HTTP error.
 * Honors both `retry-after-ms` (Anthropic) and `retry-after` (seconds, RFC).
 * FIX: PROVIDERS-M4 — Prefer real headers over regex against message body.
 */
function getRetryAfterFromHeaders(error: unknown): number | null {
  const headers =
    (error as any)?.headers ??
    (error as any)?.response?.headers ??
    (error as any)?.error?.headers;
  if (!headers) return null;
  const get = (k: string): string | undefined =>
    typeof headers.get === 'function' ? headers.get(k) : headers[k];

  const ms = get('retry-after-ms');
  if (ms) {
    const n = parseInt(ms, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const secs = get('retry-after');
  if (secs) {
    const n = parseInt(secs, 10);
    if (Number.isFinite(n) && n > 0) return n * 1000;
  }
  return null;
}

/**
 * Per-provider rate limiter.
 * Holds its own state so two providers on different keys/hosts don't share a cooldown.
 */
export class RateLimiter {
  private state: RateLimitState = {
    callTimestamps: [],
    nextAllowedAt: 0,
    backoffLevel: 0,
    totalRetries: 0,
  };

  private onWait: WaitListener | null = null;
  private providerName: string = 'default';

  constructor(providerName?: string) {
    if (providerName) this.providerName = providerName;
  }

  /** Register a listener invoked every time this limiter blocks for a wait. */
  setOnWait(listener: WaitListener | null): void {
    this.onWait = listener;
  }

  /** Label used in telemetry / listener reason strings. */
  setProviderName(name: string): void {
    this.providerName = name;
  }

  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Wait if needed before making an API call.
   * Returns actual wait time in ms (0 if no wait needed).
   */
  async waitIfNeeded(signal?: AbortSignal): Promise<number> {
    const now = Date.now();

    // Clean old timestamps outside the window
    this.state.callTimestamps = this.state.callTimestamps.filter(
      (t) => now - t < WINDOW_MS,
    );

    let waitMs = 0;
    let reason = '';

    // 1. Hard limit from previous rate limit error
    if (this.state.nextAllowedAt > now) {
      waitMs = this.state.nextAllowedAt - now;
      reason = 'rate limit cooldown';
    }

    // 2. Proactive throttling: if approaching rate limit within window
    if (waitMs === 0 && this.state.callTimestamps.length >= PROACTIVE_THRESHOLD) {
      const oldest = this.state.callTimestamps[0];
      const elapsed = now - oldest;
      const avgGap = elapsed / this.state.callTimestamps.length;
      const neededGap = WINDOW_MS / PROACTIVE_THRESHOLD;

      if (avgGap < neededGap) {
        waitMs = Math.min(neededGap - avgGap, 5000);
        reason = 'proactive throttle';
      }
    }

    // 3. Minimum gap between calls
    if (waitMs === 0 && this.state.callTimestamps.length > 0) {
      const lastCall = this.state.callTimestamps[this.state.callTimestamps.length - 1];
      const gap = now - lastCall;
      if (gap < MIN_GAP_MS) {
        waitMs = MIN_GAP_MS - gap;
        reason = 'min gap';
      }
    }

    // FIX: PROVIDERS-m1 — Never block longer than MAX_WAIT_MS
    if (waitMs > MAX_WAIT_MS) waitMs = MAX_WAIT_MS;

    if (waitMs > 0) {
      this.onWait?.(waitMs, reason);
      await sleep(waitMs, signal);
    }

    // Record this call
    this.state.callTimestamps.push(Date.now());

    return waitMs;
  }

  /** Same as waitIfNeeded — alias kept for API symmetry. */
  async recordCall(): Promise<void> {
    this.state.callTimestamps.push(Date.now());
  }

  /** Report a successful API call. Resets backoff. */
  reportSuccess(): void {
    this.state.backoffLevel = 0;
  }

  /**
   * Handle a rate limit error. Parses retry-after and applies backoff.
   * Returns the recommended wait time in ms (clamped to MAX_WAIT_MS).
   * FIX: PROVIDERS-M4 — Headers take priority over regex.
   */
  handleRateLimitError(error: unknown): number {
    this.state.totalRetries++;

    let retryAfterMs = 0;

    // 1. Real headers first — authoritative source.
    const headerMs = getRetryAfterFromHeaders(error);
    if (headerMs !== null) {
      retryAfterMs = headerMs;
    }

    // 2. Regex fallback on error message body.
    if (retryAfterMs === 0 && error instanceof Error) {
      const msg = error.message;
      const retryMatch = msg.match(RETRY_AFTER_REGEX);
      if (retryMatch) {
        retryAfterMs = parseInt(retryMatch[1], 10) * 1000;
      }

      if (retryAfterMs === 0) {
        const tokenMatch = msg.match(TOKENS_PER_MINUTE_REGEX);
        if (tokenMatch) {
          retryAfterMs = 30_000;
        }
      }
    }

    // 3. Exponential backoff fallback
    if (retryAfterMs === 0) {
      const level = Math.min(this.state.backoffLevel, BACKOFF_DELAYS.length - 1);
      retryAfterMs = BACKOFF_DELAYS[level];
    }

    // FIX: PROVIDERS-M4 — Clamp to MAX_WAIT_MS so a misconfigured header can't freeze the CLI.
    retryAfterMs = Math.min(retryAfterMs, MAX_WAIT_MS);

    this.state.backoffLevel++;
    this.state.nextAllowedAt = Date.now() + retryAfterMs;

    return retryAfterMs;
  }

  /** Get current rate limiter stats */
  getStats(): { callsInWindow: number; backoffLevel: number; totalRetries: number } {
    const now = Date.now();
    this.state.callTimestamps = this.state.callTimestamps.filter(
      (t) => now - t < WINDOW_MS,
    );
    return {
      callsInWindow: this.state.callTimestamps.length,
      backoffLevel: this.state.backoffLevel,
      totalRetries: this.state.totalRetries,
    };
  }

  /** Reset all state — useful in tests. */
  reset(): void {
    this.state = {
      callTimestamps: [],
      nextAllowedAt: 0,
      backoffLevel: 0,
      totalRetries: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Default singleton + backward-compatible module-level API.
// FIX: PROVIDERS-C2 — `chat.ts` and tests still import these names.
// ---------------------------------------------------------------------------

const defaultLimiter = new RateLimiter('default');

/** Register a listener for rate limit wait events on the default singleton. */
export function onRateLimitWait(listener: WaitListener): void {
  defaultLimiter.setOnWait(listener);
}

/** Wait if needed — delegates to the default singleton. */
export async function waitIfNeeded(signal?: AbortSignal): Promise<number> {
  return defaultLimiter.waitIfNeeded(signal);
}

/** Report a successful API call on the default singleton. */
export function reportSuccess(): void {
  defaultLimiter.reportSuccess();
}

/** Handle a rate-limit error on the default singleton. */
export function handleRateLimitError(error: unknown): number {
  return defaultLimiter.handleRateLimitError(error);
}

/** Get stats for the default singleton. */
export function getRateLimitStats(): {
  callsInWindow: number;
  backoffLevel: number;
  totalRetries: number;
} {
  return defaultLimiter.getStats();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Check if an error is a rate limit error (429).
 * FIX: PROVIDERS-m3 — Prefer numeric status code over regex.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;

  // Most SDKs expose .status / .statusCode on the error object
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 429) return true;

  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

/**
 * Check if an error indicates exhausted credits/balance (402/403).
 * Returns a human-readable reason if detected, null otherwise.
 */
export function detectCreditsExhausted(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const msg = error.message.toLowerCase();

  // HTTP 402 Payment Required
  if (msg.includes('402')) return 'Credits balance is 0 — payment required';

  // Common API error patterns for exhausted credits
  if (
    msg.includes('insufficient') &&
    (msg.includes('balance') || msg.includes('credit') || msg.includes('quota') || msg.includes('fund'))
  )
    return 'Insufficient credits balance';
  if (msg.includes('quota') && msg.includes('exceed')) return 'API quota exceeded';
  if (msg.includes('billing') || msg.includes('payment'))
    return 'Billing/payment issue — check your account';
  if (msg.includes('403') && (msg.includes('denied') || msg.includes('forbidden')))
    return 'Access denied — API key may be invalid or credits exhausted';

  return null;
}

/**
 * Abort-signal aware sleep.
 * FIX: PROVIDERS-C3 — Exported so providers + agent loop can use a cancellable sleep.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
