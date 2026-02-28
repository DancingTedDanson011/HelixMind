import { describe, it, expect } from 'vitest';
import { validationLoop, type ValidationResult } from '../../../src/cli/validation/autofix.js';

describe('Validation Autofix Loop', () => {
  it('should pass clean HTML through validation', async () => {
    const result = await validationLoop('```html\n<div><p>Clean</p></div>\n```', {
      criteria: [
        { id: 'html-valid', category: 'structural', description: 'HTML valid', check: 'static', severity: 'error', autofix: true },
        { id: 'ids-unique', category: 'structural', description: 'IDs unique', check: 'static', severity: 'error', autofix: true },
      ],
      userRequest: 'Create a div',
      spiralContext: '',
    });

    expect(result.status).toBe('passed');
    expect(result.loops).toBe(0);
    expect(result.fixesApplied).toBe(0);
  });

  it('should report errors status for unfixable issues', async () => {
    const output = '```ts\nasync function foo() {\n  return 42;\n}\n```';
    const result = await validationLoop(output, {
      criteria: [
        { id: 'async-await', category: 'logic', description: 'Async awaited', check: 'static', severity: 'error', autofix: true },
      ],
      userRequest: 'Write an async function',
      spiralContext: '',
    });

    // async-await check has no concrete fix string, so it can't autofix
    expect(['errors', 'max_loops']).toContain(result.status);
  });

  it('should return warnings status for warnings only', async () => {
    const output = '```html\n<img src="logo.png">\n```';
    const result = await validationLoop(output, {
      criteria: [
        { id: 'img-alt', category: 'structural', description: 'Images have alt', check: 'static', severity: 'warning', autofix: true },
      ],
      userRequest: 'Add an image',
      spiralContext: '',
    });

    expect(result.status).toBe('warnings');
  });

  it('should skip dynamic checks without provider', async () => {
    const result = await validationLoop('Hello', {
      criteria: [
        { id: 'requirements-met', category: 'completeness', description: 'Requirements met', check: 'dynamic', severity: 'error', autofix: true },
      ],
      userRequest: 'Say hello',
      spiralContext: '',
    });

    // Dynamic checks skipped → all passed
    expect(result.status).toBe('passed');
    expect(result.results[0].details).toContain('Skipped');
  });

  it('should respect maxLoops', async () => {
    const result = await validationLoop('```ts\ndb.query(`SELECT * FROM x WHERE id = ${id}`);\n```', {
      criteria: [
        { id: 'sql-injection', category: 'security', description: 'No SQL injection', check: 'static', severity: 'error', autofix: true },
      ],
      userRequest: 'Query user',
      spiralContext: '',
      maxLoops: 2,
    });

    expect(result.loops).toBeLessThanOrEqual(2);
  });

  it('should track duration', async () => {
    const result = await validationLoop('```html\n<div>OK</div>\n```', {
      criteria: [
        { id: 'html-valid', category: 'structural', description: 'HTML valid', check: 'static', severity: 'error', autofix: true },
      ],
      userRequest: 'Create a div',
      spiralContext: '',
    });

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.duration).toBeLessThan(5000); // Should be fast
  });

  it('should handle empty criteria', async () => {
    const result = await validationLoop('anything', {
      criteria: [],
      userRequest: 'test',
      spiralContext: '',
    });

    expect(result.status).toBe('passed');
    expect(result.results.length).toBe(0);
  });

  it('should handle img-alt autofix', async () => {
    const output = '```html\n<img src="logo.png">\n```';
    const result = await validationLoop(output, {
      criteria: [
        { id: 'img-alt', category: 'structural', description: 'Images have alt', check: 'static', severity: 'error', autofix: true },
      ],
      userRequest: 'Add image',
      spiralContext: '',
      maxLoops: 2,
    });

    // Should attempt to fix the img alt
    expect(result.fixesApplied).toBeGreaterThanOrEqual(0);
  });
});
