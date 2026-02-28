import { describe, it, expect } from 'vitest';
import { getSuggestions, getBestCompletion } from '../../../src/cli/ui/command-suggest.js';

describe('Command Suggestions', () => {
  it('should return suggestions for partial command', () => {
    const results = getSuggestions('/he');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.cmd === '/help')).toBe(true);
    expect(results.some(r => r.cmd === '/helix')).toBe(true);
  });

  it('should return empty for exact match', () => {
    const results = getSuggestions('/help');
    expect(results).toEqual([]);
  });

  it('should return empty for single slash', () => {
    const results = getSuggestions('/');
    expect(results).toEqual([]);
  });

  it('should return empty for non-slash input', () => {
    const results = getSuggestions('hello');
    expect(results).toEqual([]);
  });

  it('should match /br to /brain', () => {
    const results = getSuggestions('/br');
    expect(results.some(r => r.cmd === '/brain')).toBe(true);
  });

  it('should match /au to /auto', () => {
    const results = getSuggestions('/au');
    expect(results.some(r => r.cmd === '/auto')).toBe(true);
  });

  it('should match /sec to /security', () => {
    const results = getSuggestions('/sec');
    expect(results.some(r => r.cmd === '/security')).toBe(true);
  });

  it('should limit results', () => {
    const results = getSuggestions('/s', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('getBestCompletion should return first match', () => {
    const result = getBestCompletion('/he');
    expect(result).toBe('/help');
  });

  it('getBestCompletion should return null for no match', () => {
    const result = getBestCompletion('/zzz');
    expect(result).toBeNull();
  });

  it('should have descriptions for all commands', () => {
    const results = getSuggestions('/h');
    for (const r of results) {
      expect(r.description).toBeTruthy();
    }
  });

  it('should match /brain with sub-commands', () => {
    const results = getSuggestions('/brain ');
    expect(results.some(r => r.cmd === '/brain local')).toBe(true);
    expect(results.some(r => r.cmd === '/brain global')).toBe(true);
  });
});
