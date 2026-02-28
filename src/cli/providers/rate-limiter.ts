/**
 * Intelligent rate limiter with exponential backoff and proactive throttling.
 * Tracks API call timing, parses retry-after headers from errors,
 * and preemptively delays when approaching rate limits.
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

let state: RateLimitState = {
  callTimestamps: [],
  nextAllowedAt: 0,
  backoffLevel: 0,
  totalRetries: 0,
};

/** Listener for rate limit wait events */
type WaitListener = (waitMs: number, reason: string) => void;
let onWait: WaitListener | null = null;

/** Register a listener for rate limit wait events */
export function onRateLimitWait(listener: WaitListener): void {
  onWait = listener;
}

/**
 * Wait if needed before making an API call.
 * Call this BEFORE every LLM API request.
 * Returns the actual wait time in ms (0 if no wait needed).
 */
export async function waitIfNeeded(signal?: AbortSignal): Promise<number> {
  const now = Date.now();

  // Clean old timestamps outside the window
  state.callTimestamps = state.callTimestamps.filter(t => now - t < WINDOW_MS);

  let waitMs = 0;
  let reason = '';

  // 1. Hard limit from previous rate limit error
  if (state.nextAllowedAt > now) {
    waitMs = state.nextAllowedAt - now;
    reason = 'rate limit cooldown';
  }

  // 2. Proactive throttling: if approaching rate limit within window
  if (waitMs === 0 && state.callTimestamps.length >= PROACTIVE_THRESHOLD) {
    // Calculate average gap needed to spread calls evenly
    const oldest = state.callTimestamps[0];
    const elapsed = now - oldest;
    const avgGap = elapsed / state.callTimestamps.length;
    const neededGap = WINDOW_MS / PROACTIVE_THRESHOLD;

    if (avgGap < neededGap) {
      waitMs = Math.min(neededGap - avgGap, 5000);
      reason = 'proactive throttle';
    }
  }

  // 3. Minimum gap between calls
  if (waitMs === 0 && state.callTimestamps.length > 0) {
    const lastCall = state.callTimestamps[state.callTimestamps.length - 1];
    const gap = now - lastCall;
    if (gap < MIN_GAP_MS) {
      waitMs = MIN_GAP_MS - gap;
      reason = 'min gap';
    }
  }

  if (waitMs > 0) {
    onWait?.(waitMs, reason);
    await sleep(waitMs, signal);
  }

  // Record this call
  state.callTimestamps.push(Date.now());

  return waitMs;
}

/**
 * Report a successful API call. Resets backoff.
 */
export function reportSuccess(): void {
  state.backoffLevel = 0;
}

/**
 * Handle a rate limit error. Parses retry-after and applies backoff.
 * Returns the recommended wait time in ms.
 */
export function handleRateLimitError(error: unknown): number {
  state.totalRetries++;

  // Try to parse retry-after from error message or headers
  let retryAfterMs = 0;

  if (error instanceof Error) {
    const msg = error.message;

    // Parse "retry-after" seconds from error body
    const retryMatch = msg.match(/retry.?after[:\s]*(\d+)/i);
    if (retryMatch) {
      retryAfterMs = parseInt(retryMatch[1], 10) * 1000;
    }

    // Parse Anthropic-specific rate limit info
    const tokenMatch = msg.match(/(\d+[,.]?\d*)\s*input tokens per minute/i);
    if (tokenMatch && !retryAfterMs) {
      // Wait proportional to the window — typically 30-60s
      retryAfterMs = 30_000;
    }
  }

  // Apply exponential backoff if no retry-after
  if (retryAfterMs === 0) {
    const level = Math.min(state.backoffLevel, BACKOFF_DELAYS.length - 1);
    retryAfterMs = BACKOFF_DELAYS[level];
  }

  state.backoffLevel++;
  state.nextAllowedAt = Date.now() + retryAfterMs;

  return retryAfterMs;
}

/**
 * Check if an error is a rate limit error (429).
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('429') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests');
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
  if (msg.includes('insufficient') && (msg.includes('balance') || msg.includes('credit') || msg.includes('quota') || msg.includes('fund')))
    return 'Insufficient credits balance';
  if (msg.includes('quota') && msg.includes('exceed'))
    return 'API quota exceeded';
  if (msg.includes('billing') || msg.includes('payment'))
    return 'Billing/payment issue — check your account';
  if (msg.includes('403') && (msg.includes('denied') || msg.includes('forbidden')))
    return 'Access denied — API key may be invalid or credits exhausted';

  return null;
}

/** Get current rate limiter stats */
export function getRateLimitStats(): { callsInWindow: number; backoffLevel: number; totalRetries: number } {
  const now = Date.now();
  state.callTimestamps = state.callTimestamps.filter(t => now - t < WINDOW_MS);
  return {
    callsInWindow: state.callTimestamps.length,
    backoffLevel: state.backoffLevel,
    totalRetries: state.totalRetries,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Aborted')); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    }, { once: true });
  });
}
