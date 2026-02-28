import { describe, it, expect } from 'vitest';
import { renderValidationStats, type ValidationStats } from '../../../src/cli/validation/stats.js';

function makeStats(overrides: Partial<ValidationStats> = {}): ValidationStats {
  return {
    totalValidations: 10,
    totalChecks: 100,
    totalPassed: 85,
    totalFailed: 15,
    totalAutofixes: 12,
    averageDuration: 340,
    averageLoops: 1.2,
    autofixRate: 0.8,
    issueFrequency: new Map([
      ['imports-resolve', { count: 5, autofixed: 5 }],
      ['async-await', { count: 3, autofixed: 3 }],
      ['style-match', { count: 2, autofixed: 1 }],
    ]),
    ...overrides,
  };
}

describe('Validation Stats', () => {
  it('should render stats output', () => {
    const output = renderValidationStats(makeStats());
    expect(output).toContain('Validation Statistics');
    expect(output).toContain('imports-resolve');
    expect(output).toContain('80%');
    expect(output).toContain('340ms');
    expect(output).toContain('1.2');
  });

  it('should show issue frequency sorted', () => {
    const output = renderValidationStats(makeStats());
    const importsIdx = output.indexOf('imports-resolve');
    const asyncIdx = output.indexOf('async-await');
    expect(importsIdx).toBeLessThan(asyncIdx); // imports-resolve has higher count
  });

  it('should show autofix info', () => {
    const output = renderValidationStats(makeStats());
    expect(output).toContain('autofixed');
  });

  it('should handle empty stats', () => {
    const output = renderValidationStats(makeStats({
      totalValidations: 0,
      issueFrequency: new Map(),
    }));
    expect(output).toContain('Validation Statistics');
  });

  it('should handle 100% autofix rate', () => {
    const output = renderValidationStats(makeStats({ autofixRate: 1.0 }));
    expect(output).toContain('100%');
  });
});
