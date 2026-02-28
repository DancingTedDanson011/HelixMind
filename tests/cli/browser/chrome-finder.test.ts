import { describe, it, expect } from 'vitest';
import { findChrome } from '../../../src/cli/browser/chrome-finder.js';
import { platform } from 'node:os';

describe('findChrome', () => {
  it('should return a string or null', () => {
    const result = findChrome();
    if (result !== null) {
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    } else {
      // Chrome not found on this system — that's OK
      expect(result).toBeNull();
    }
  });

  it('should find Chrome on Windows if available', () => {
    if (platform() !== 'win32') return; // skip on non-Windows
    const result = findChrome();
    // On a typical Windows dev machine Chrome or Edge should be found
    // But we don't fail the test if it's not — CI environments may not have it
    if (result) {
      expect(result.toLowerCase()).toMatch(/chrome|msedge/);
    }
  });

  it('should find Chrome on macOS if available', () => {
    if (platform() !== 'darwin') return;
    const result = findChrome();
    if (result) {
      expect(result).toContain('Chrome');
    }
  });

  it('should find Chrome on Linux if available', () => {
    if (platform() !== 'linux') return;
    const result = findChrome();
    if (result) {
      expect(result).toMatch(/chrome|chromium/);
    }
  });
});
