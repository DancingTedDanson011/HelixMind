import { describe, it, expect } from 'vitest';
import { generateCriteria, BASE_CRITERIA } from '../../../src/cli/validation/criteria.js';

describe('Validation Criteria', () => {
  // ── Base Criteria ──

  it('should have base criteria for ui_component', () => {
    expect(BASE_CRITERIA.ui_component.length).toBeGreaterThan(0);
  });

  it('should have base criteria for api_endpoint', () => {
    expect(BASE_CRITERIA.api_endpoint.length).toBeGreaterThan(0);
    expect(BASE_CRITERIA.api_endpoint.some(c => c.category === 'security')).toBe(true);
  });

  it('should have base criteria for bug_fix', () => {
    expect(BASE_CRITERIA.bug_fix.length).toBeGreaterThan(0);
    expect(BASE_CRITERIA.bug_fix.some(c => c.id === 'bug-addressed')).toBe(true);
  });

  it('should have empty criteria for chat_only', () => {
    expect(BASE_CRITERIA.chat_only).toEqual([]);
  });

  it('should have all required fields in criteria', () => {
    for (const [, criteria] of Object.entries(BASE_CRITERIA)) {
      for (const c of criteria) {
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('category');
        expect(c).toHaveProperty('description');
        expect(c).toHaveProperty('check');
        expect(c).toHaveProperty('severity');
        expect(c).toHaveProperty('autofix');
        expect(['static', 'dynamic']).toContain(c.check);
        expect(['error', 'warning', 'info']).toContain(c.severity);
      }
    }
  });

  it('should have unique IDs within each category', () => {
    for (const [catName, criteria] of Object.entries(BASE_CRITERIA)) {
      const ids = criteria.map(c => c.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });

  // ── Dynamic Criteria Generation ──

  it('should return empty for chat_only', () => {
    const result = generateCriteria(
      { category: 'chat_only', complexity: 'trivial', outputType: 'text' },
      'Was ist TypeScript?',
    );
    expect(result).toEqual([]);
  });

  it('should include base criteria for general_code', () => {
    const result = generateCriteria(
      { category: 'general_code', complexity: 'simple', outputType: 'code' },
      'Create a function',
    );
    expect(result.length).toBeGreaterThanOrEqual(BASE_CRITERIA.general_code.length);
  });

  it('should extract numbered requirements', () => {
    const result = generateCriteria(
      { category: 'general_code', complexity: 'medium', outputType: 'code' },
      '1. Add error handling 2. Add logging 3. Add retry logic',
    );
    const dynamic = result.filter(c => c.id.startsWith('dyn-'));
    expect(dynamic.length).toBe(3);
    expect(dynamic[0].description).toContain('Add error handling');
  });

  it('should extract count requirements', () => {
    const result = generateCriteria(
      { category: 'ui_component', complexity: 'medium', outputType: 'code' },
      'Create a navbar with 5 links and 3 buttons',
    );
    const dynamic = result.filter(c => c.id.startsWith('dyn-'));
    expect(dynamic.some(c => c.description.includes('5 links'))).toBe(true);
  });

  // ── Spiral Criteria ──

  it('should extract spiral criteria from context', () => {
    const result = generateCriteria(
      { category: 'ui_component', complexity: 'simple', outputType: 'code' },
      'Create a card component',
      'Project uses tailwind CSS with colors #1a1a2e and #00ff88. Follows camelCase.',
    );
    const spiral = result.filter(c => c.id.startsWith('spiral-'));
    expect(spiral.length).toBeGreaterThan(0);
    expect(spiral.some(c => c.description.toLowerCase().includes('tailwind'))).toBe(true);
  });

  it('should extract color criteria from spiral', () => {
    const result = generateCriteria(
      { category: 'ui_component', complexity: 'simple', outputType: 'code' },
      'Create a button',
      'Primary color is #ff6600, secondary #00aaff',
    );
    const colorCriteria = result.filter(c => c.description.includes('#'));
    expect(colorCriteria.length).toBeGreaterThan(0);
  });
});
