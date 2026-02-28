import { describe, it, expect, beforeEach } from 'vitest';
import {
  waitIfNeeded,
  reportSuccess,
  handleRateLimitError,
  isRateLimitError,
  getRateLimitStats,
} from '../../../src/cli/providers/rate-limiter.js';

describe('Rate Limiter', () => {
  it('should identify rate limit errors by status code', () => {
    expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRateLimitError(new Error('rate_limit_error: exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('Rate limit reached'))).toBe(true);
    expect(isRateLimitError(new Error('Server error 500'))).toBe(false);
    expect(isRateLimitError('not an error')).toBe(false);
  });

  it('should return backoff time on rate limit error', () => {
    const waitMs = handleRateLimitError(new Error('429 rate limit'));
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(60000);
  });

  it('should increase backoff on consecutive errors', () => {
    // Reset by reporting success
    reportSuccess();
    const wait1 = handleRateLimitError(new Error('429'));
    const wait2 = handleRateLimitError(new Error('429'));
    expect(wait2).toBeGreaterThanOrEqual(wait1);
  });

  it('should reset backoff on success', () => {
    handleRateLimitError(new Error('429'));
    handleRateLimitError(new Error('429'));
    reportSuccess();
    const stats = getRateLimitStats();
    expect(stats.backoffLevel).toBe(0);
  });

  it('should parse retry-after from error message', () => {
    const waitMs = handleRateLimitError(new Error('Rate limit. retry-after: 10'));
    expect(waitMs).toBe(10000);
  });

  it('should track stats', () => {
    reportSuccess();
    const stats = getRateLimitStats();
    expect(stats.backoffLevel).toBe(0);
    expect(typeof stats.callsInWindow).toBe('number');
    expect(typeof stats.totalRetries).toBe('number');
  });
});
