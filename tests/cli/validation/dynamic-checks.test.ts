import { describe, it, expect, vi } from 'vitest';
import { runDynamicChecks } from '../../../src/cli/validation/dynamic-checks.js';
import type { ValidationCriterion } from '../../../src/cli/validation/criteria.js';

describe('Dynamic Checks', () => {
  it('should return empty for empty criteria', async () => {
    const results = await runDynamicChecks([], 'output', 'request', '', {} as any);
    expect(results).toEqual([]);
  });

  it('should handle provider errors gracefully', async () => {
    const fakeProvider = {
      name: 'test',
      model: 'test',
      stream: async function* () {
        throw new Error('API error');
      },
      chatWithTools: vi.fn(),
    };

    const criteria: ValidationCriterion[] = [
      { id: 'test-1', category: 'completeness', description: 'Test check', check: 'dynamic', severity: 'error', autofix: false },
    ];

    const results = await runDynamicChecks(criteria, 'some output', 'some request', '', fakeProvider);
    expect(results.length).toBe(1);
    // Should pass on error (don't block user)
    expect(results[0].passed).toBe(true);
    expect(results[0].details).toContain('skipped');
  });

  it('should parse valid JSON response', async () => {
    const fakeProvider = {
      name: 'test',
      model: 'test',
      stream: async function* () {
        yield { type: 'text' as const, content: '{"passed": false, "details": "Missing navbar element", "fix": "Add <nav> element"}' };
      },
      chatWithTools: vi.fn(),
    };

    const criteria: ValidationCriterion[] = [
      { id: 'requirements-met', category: 'completeness', description: 'Requirements met', check: 'dynamic', severity: 'error', autofix: true },
    ];

    const results = await runDynamicChecks(criteria, 'some output', 'Create navbar', '', fakeProvider);
    expect(results.length).toBe(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].details).toContain('navbar');
  });

  it('should handle malformed JSON response', async () => {
    const fakeProvider = {
      name: 'test',
      model: 'test',
      stream: async function* () {
        yield { type: 'text' as const, content: 'This is not JSON but the check passed overall' };
      },
      chatWithTools: vi.fn(),
    };

    const criteria: ValidationCriterion[] = [
      { id: 'test-1', category: 'completeness', description: 'Test', check: 'dynamic', severity: 'error', autofix: false },
    ];

    const results = await runDynamicChecks(criteria, 'output', 'request', '', fakeProvider);
    expect(results.length).toBe(1);
    // Fallback: tries to infer from text
    expect(typeof results[0].passed).toBe('boolean');
  });

  it('should batch concurrent checks', async () => {
    let callCount = 0;
    const fakeProvider = {
      name: 'test',
      model: 'test',
      stream: async function* () {
        callCount++;
        yield { type: 'text' as const, content: '{"passed": true, "details": "OK", "fix": null}' };
      },
      chatWithTools: vi.fn(),
    };

    const criteria: ValidationCriterion[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-${i}`,
      category: 'completeness' as const,
      description: `Check ${i}`,
      check: 'dynamic' as const,
      severity: 'error' as const,
      autofix: false,
    }));

    const results = await runDynamicChecks(criteria, 'output', 'request', '', fakeProvider);
    expect(results.length).toBe(5);
    expect(callCount).toBe(5);
  });
});
