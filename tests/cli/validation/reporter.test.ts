import { describe, it, expect } from 'vitest';
import { renderValidationSummary, renderValidationOneLine, renderValidationStart, renderClassification } from '../../../src/cli/validation/reporter.js';
import type { ValidationResult } from '../../../src/cli/validation/autofix.js';

function makeResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    output: 'test output',
    results: [
      { id: 'html-valid', passed: true, details: 'OK', severity: 'error', autofix: false },
      { id: 'ids-unique', passed: true, details: 'OK', severity: 'error', autofix: false },
    ],
    loops: 0,
    status: 'passed',
    fixesApplied: 0,
    duration: 150,
    ...overrides,
  };
}

describe('Validation Reporter', () => {
  it('should render passed summary', () => {
    const output = renderValidationSummary(makeResult());
    expect(output).toContain('Validation Matrix');
    expect(output).toContain('2 checks');
    expect(output).toContain('0 errors');
  });

  it('should render error summary', () => {
    const output = renderValidationSummary(makeResult({
      status: 'errors',
      results: [
        { id: 'sql-injection', passed: false, details: 'SQL injection found', severity: 'error', autofix: false },
      ],
    }));
    expect(output).toContain('sql-injection');
    expect(output).toContain('SQL injection found');
  });

  it('should render warnings', () => {
    const output = renderValidationSummary(makeResult({
      status: 'warnings',
      results: [
        { id: 'img-alt', passed: false, details: 'Missing alt', severity: 'warning', autofix: true },
      ],
    }));
    expect(output).toContain('1 warning');
  });

  it('should render autofixes', () => {
    const output = renderValidationSummary(makeResult({
      fixesApplied: 3,
    }));
    expect(output).toContain('3 autofixes applied');
  });

  it('should render verbose mode', () => {
    const output = renderValidationSummary(makeResult({
      results: [
        { id: 'html-valid', passed: true, details: 'Tags balanced', severity: 'error', autofix: false },
        { id: 'sql-injection', passed: false, details: 'Vulnerable', fix: 'Use params', severity: 'error', autofix: true },
      ],
    }), true);
    expect(output).toContain('html-valid');
    expect(output).toContain('Tags balanced');
    expect(output).toContain('Use params');
  });

  it('should render duration in ms', () => {
    const output = renderValidationSummary(makeResult({ duration: 350 }));
    expect(output).toContain('350ms');
  });

  it('should render duration in seconds', () => {
    const output = renderValidationSummary(makeResult({ duration: 1500 }));
    expect(output).toContain('1.5s');
  });

  it('should render loop count', () => {
    const output = renderValidationSummary(makeResult({ loops: 2 }));
    expect(output).toContain('2 loops');
  });

  it('should render one-line summary', () => {
    const output = renderValidationOneLine(makeResult());
    expect(output).toContain('2/2');
    expect(output).toContain('150ms');
  });

  it('should render validation start', () => {
    const output = renderValidationStart();
    expect(output).toContain('Validating');
  });

  it('should render classification', () => {
    const output = renderClassification('ui_component', 'medium', 15);
    expect(output).toContain('ui_component');
    expect(output).toContain('medium');
    expect(output).toContain('15');
  });
});
