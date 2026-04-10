import { describe, expect, it } from 'vitest';
import { resolveValidationDecision } from '../../../src/cli/validation/policy.js';

describe('resolveValidationDecision', () => {
  const base = { enabled: true, verbose: false, strict: false };

  it('skips validation for fast mode', () => {
    const decision = resolveValidationDecision(
      'fix the auth middleware',
      base,
      { fastMode: true, skipValidation: true, forceValidation: false },
    );

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('fast mode');
  });

  it('skips validation for chat-only requests', () => {
    const decision = resolveValidationDecision(
      'Wie funktioniert der Scheduler?',
      base,
      { fastMode: false, skipValidation: false, forceValidation: false },
    );

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('chat-only request');
  });

  it('keeps validation on for code-affecting tasks', () => {
    const decision = resolveValidationDecision(
      'Fix the broken login redirect in src/auth.ts',
      base,
      { fastMode: false, skipValidation: false, forceValidation: false },
    );

    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('code-affecting task');
  });

  it('respects explicit force validation', () => {
    const decision = resolveValidationDecision(
      'update the docs',
      base,
      { fastMode: false, skipValidation: false, forceValidation: true },
    );

    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('forced for this turn');
  });
});
