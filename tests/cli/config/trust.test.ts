import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';

describe('Directory Trust', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `trust-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  describe('isSystemDirectory', () => {
    it('should detect Windows system directories', async () => {
      const { isSystemDirectory } = await import('../../../src/cli/config/trust.js');

      // These should always be flagged regardless of platform
      // (the function checks platform() internally)
      if (process.platform === 'win32') {
        expect(isSystemDirectory('C:\\Windows\\System32')).toBe(true);
        expect(isSystemDirectory('C:\\Windows')).toBe(true);
        expect(isSystemDirectory('C:\\Program Files\\nodejs')).toBe(true);
        expect(isSystemDirectory('C:\\Program Files (x86)\\app')).toBe(true);
      }
    });

    it('should NOT flag regular directories', async () => {
      const { isSystemDirectory } = await import('../../../src/cli/config/trust.js');
      expect(isSystemDirectory(testDir)).toBe(false);
      expect(isSystemDirectory(homedir())).toBe(false);
      expect(isSystemDirectory(join(homedir(), 'Desktop', 'MyProject'))).toBe(false);
    });
  });

  describe('isDirectoryTrusted', () => {
    it('should trust home directory', async () => {
      const { isDirectoryTrusted } = await import('../../../src/cli/config/trust.js');
      expect(isDirectoryTrusted(homedir())).toBe(true);
    });

    it('should trust direct children of home', async () => {
      const { isDirectoryTrusted } = await import('../../../src/cli/config/trust.js');
      expect(isDirectoryTrusted(join(homedir(), 'Desktop'))).toBe(true);
      expect(isDirectoryTrusted(join(homedir(), 'Documents'))).toBe(true);
    });

    it('should trust directories with existing .helixmind/', async () => {
      const { isDirectoryTrusted } = await import('../../../src/cli/config/trust.js');
      mkdirSync(join(testDir, '.helixmind'), { recursive: true });
      expect(isDirectoryTrusted(testDir)).toBe(true);
    });

    it('should NOT trust unknown directories without .helixmind/', async () => {
      const { isDirectoryTrusted } = await import('../../../src/cli/config/trust.js');
      // A deep tmp directory that isn't home or a direct child of home
      expect(isDirectoryTrusted(testDir)).toBe(false);
    });
  });

  describe('trustDirectory', () => {
    it('should add a directory to the trust list', async () => {
      const { isDirectoryTrusted, trustDirectory } = await import('../../../src/cli/config/trust.js');
      // testDir is NOT trusted initially
      // (unless it's a direct child of home, which the tmpdir usually isn't)
      const deepDir = join(testDir, 'sub', 'project');
      mkdirSync(deepDir, { recursive: true });

      expect(isDirectoryTrusted(deepDir)).toBe(false);
      trustDirectory(deepDir);
      expect(isDirectoryTrusted(deepDir)).toBe(true);
    });
  });
});
