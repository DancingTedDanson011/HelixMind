import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetryManager } from '../../../src/cli/jarvis/telemetry.js';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { LearningEntry, SkillEffectiveness } from '../../../src/cli/jarvis/types.js';

function makeLearning(overrides: Partial<LearningEntry> = {}): LearningEntry {
  return {
    id: 1,
    category: 'tool_error',
    errorPattern: 'ENOENT: /home/user/project/src/app.ts not found',
    solution: 'Check file exists with list_directory before writing to /home/user/project/src/app.ts',
    context: 'write_file .ts',
    confidence: 0.8,
    successCount: 3,
    failCount: 0,
    tags: ['filesystem', 'write'],
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    ...overrides,
  };
}

function makeSkillEff(overrides: Partial<SkillEffectiveness> = {}): SkillEffectiveness {
  return {
    skillName: 'test-skill',
    timesUsed: 10,
    timesSuccessful: 8,
    avgQualityDelta: 0.3,
    lastUsedAt: Date.now(),
    ...overrides,
  };
}

describe('TelemetryManager', () => {
  let tempDir: string;
  let tm: TelemetryManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), `telemetry-test-${randomUUID()}-`));
    tm = new TelemetryManager(tempDir, 'https://test.example.com/api/telemetry');
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
  });

  // ─── Default State ──────────────────────────────────────────────────

  describe('default state', () => {
    it('should be disabled by default', () => {
      expect(tm.isEnabled()).toBe(false);
      expect(tm.getConfig().enabled).toBe(false);
      expect(tm.getConfig().privacyLevel).toBe(0);
    });

    it('should generate an installId', () => {
      const config = tm.getConfig();
      expect(config.installId).toBeTruthy();
      expect(config.installId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should have lastSyncAt = 0', () => {
      expect(tm.getConfig().lastSyncAt).toBe(0);
    });
  });

  // ─── Configuration ──────────────────────────────────────────────────

  describe('configuration', () => {
    it('should set enabled state', () => {
      tm.setEnabled(true);
      expect(tm.getConfig().enabled).toBe(true);
    });

    it('should set privacy level', () => {
      tm.setPrivacyLevel(2);
      expect(tm.getConfig().privacyLevel).toBe(2);
    });

    it('should report isEnabled only when enabled AND level > 0', () => {
      tm.setEnabled(true);
      expect(tm.isEnabled()).toBe(false); // level still 0

      tm.setPrivacyLevel(1);
      expect(tm.isEnabled()).toBe(true);

      tm.setEnabled(false);
      expect(tm.isEnabled()).toBe(false);
    });
  });

  // ─── Config Persistence ─────────────────────────────────────────────

  describe('persistence', () => {
    it('should persist and reload config', () => {
      tm.setEnabled(true);
      tm.setPrivacyLevel(2);

      const tm2 = new TelemetryManager(tempDir, 'https://test.example.com/api/telemetry');
      const config = tm2.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.privacyLevel).toBe(2);
      expect(config.installId).toBe(tm.getConfig().installId); // same ID
    });

    it('should handle corrupted config file', () => {
      const configPath = join(tempDir, '.helixmind', 'jarvis', 'telemetry-config.json');
      mkdirSync(join(tempDir, '.helixmind', 'jarvis'), { recursive: true });
      writeFileSync(configPath, '{not valid json!!!', 'utf-8');

      const tm2 = new TelemetryManager(tempDir, 'https://test.example.com/api/telemetry');
      expect(tm2.getConfig().enabled).toBe(false);
      expect(tm2.getConfig().privacyLevel).toBe(0);
    });
  });

  // ─── Payload Collection per Privacy Level ───────────────────────────

  describe('collectPayload', () => {
    const learnings = [makeLearning()];
    const skills = [makeSkillEff()];
    const toolUsage = { read_file: 10, write_file: 5 };
    const errorPatterns = { 'ENOENT: /home/user/file.ts': 3 };

    it('should return null when disabled', () => {
      expect(tm.collectPayload(learnings, skills, toolUsage, errorPatterns)).toBeNull();
    });

    it('should return null at level 0 even when enabled', () => {
      tm.setEnabled(true);
      // privacyLevel is still 0
      expect(tm.collectPayload(learnings, skills, toolUsage, errorPatterns)).toBeNull();
    });

    it('level 1: should include toolUsage and errorPatterns only', () => {
      tm.setEnabled(true);
      tm.setPrivacyLevel(1);
      const payload = tm.collectPayload(learnings, skills, toolUsage, errorPatterns);

      expect(payload).not.toBeNull();
      expect(payload!.toolUsage).toEqual(toolUsage);
      expect(payload!.errorPatterns).toBeDefined();
      expect(payload!.learnings).toBeUndefined();
      expect(payload!.skillEffectiveness).toBeUndefined();
    });

    it('level 1: should anonymize error pattern keys', () => {
      tm.setEnabled(true);
      tm.setPrivacyLevel(1);
      const payload = tm.collectPayload(learnings, skills, toolUsage, errorPatterns);

      const keys = Object.keys(payload!.errorPatterns!);
      for (const key of keys) {
        expect(key).not.toContain('/home/user');
      }
    });

    it('level 2: should include anonymized learnings + skill effectiveness', () => {
      tm.setEnabled(true);
      tm.setPrivacyLevel(2);
      const payload = tm.collectPayload(learnings, skills, toolUsage, errorPatterns);

      expect(payload!.learnings).toHaveLength(1);
      expect(payload!.skillEffectiveness).toHaveLength(1);
      expect(payload!.toolUsage).toBeDefined(); // still includes level 1
    });

    it('level 3: should include completionRates', () => {
      tm.setEnabled(true);
      tm.setPrivacyLevel(3);
      const payload = tm.collectPayload(learnings, skills, toolUsage, errorPatterns);

      expect(payload!.completionRates).toBeDefined();
      expect(payload!.learnings).toBeDefined();
    });

    it('should include system info in payload', () => {
      tm.setEnabled(true);
      tm.setPrivacyLevel(1);
      const payload = tm.collectPayload([], [], toolUsage);

      expect(payload!.installId).toBeTruthy();
      expect(payload!.nodeVersion).toMatch(/^v/);
      expect(payload!.os).toBeTruthy();
      expect(payload!.timestamp).toBeGreaterThan(0);
    });
  });

  // ─── Anonymization ──────────────────────────────────────────────────

  describe('anonymization', () => {
    it('anonymizePath should return only extension', () => {
      expect(tm.anonymizePath('/home/user/project/src/app.ts')).toBe('.ts');
      expect(tm.anonymizePath('C:\\Users\\test\\file.json')).toBe('.json');
      expect(tm.anonymizePath('noext')).toBe('<no-ext>');
    });

    it('anonymizeErrorPattern should strip Unix paths', () => {
      const result = tm.anonymizeErrorPattern('ENOENT: /home/user/project/src/app.ts not found');
      expect(result).not.toContain('/home/user');
      expect(result).toContain('<path>');
    });

    it('anonymizeErrorPattern should strip Windows paths', () => {
      const result = tm.anonymizeErrorPattern('ENOENT: C:\\Users\\John\\Desktop\\project\\file.ts');
      expect(result).not.toContain('C:\\Users');
      expect(result).toContain('<path>');
    });

    it('anonymizeErrorPattern should strip line:col references', () => {
      const result = tm.anonymizeErrorPattern('Error at file.ts:42:13');
      expect(result).not.toContain(':42:13');
      expect(result).toContain(':<line>');
    });

    it('anonymizeErrorPattern should strip timestamps', () => {
      const result = tm.anonymizeErrorPattern('Error at 1709571234567');
      expect(result).not.toContain('1709571234567');
      expect(result).toContain('<timestamp>');
    });

    it('anonymizeLearning should not leak file paths in solution', () => {
      const entry = makeLearning({
        solution: 'Check /home/user/project/src/file.ts exists first',
      });
      const anon = tm.anonymizeLearning(entry);
      expect(anon.solution).not.toContain('/home/user');
    });

    it('anonymizeLearning should not leak Windows paths in solution', () => {
      const entry = makeLearning({
        solution: 'Check C:\\Users\\John\\Desktop\\project\\file.ts exists',
      });
      const anon = tm.anonymizeLearning(entry);
      expect(anon.solution).not.toContain('C:\\Users');
    });

    it('anonymizeLearning should filter path-like tags', () => {
      const entry = makeLearning({
        tags: ['filesystem', '/home/user/secret', 'typescript'],
      });
      const anon = tm.anonymizeLearning(entry);
      expect(anon.tags).not.toContain('/home/user/secret');
      expect(anon.tags).toContain('filesystem');
      expect(anon.tags).toContain('typescript');
    });

    it('anonymizeLearning should keep category and confidence', () => {
      const entry = makeLearning({ category: 'framework_gotcha', confidence: 0.9 });
      const anon = tm.anonymizeLearning(entry);
      expect(anon.category).toBe('framework_gotcha');
      expect(anon.confidence).toBe(0.9);
    });

    it('anonymizeLearning should produce a clean context', () => {
      const entry = makeLearning({ context: 'write_file .ts' });
      const anon = tm.anonymizeLearning(entry);
      // Should keep tool name and extension
      expect(anon.context).toContain('write_file');
      expect(anon.context).toContain('.ts');
    });
  });

  // ─── Sync with mock fetch ───────────────────────────────────────────

  describe('sync', () => {
    it('should return true on successful POST', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      tm.setEnabled(true);
      tm.setPrivacyLevel(1);
      const payload = tm.collectPayload([], [], { read_file: 1 });
      const result = await tm.sync(payload!);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toBe('https://test.example.com/api/telemetry');
      expect(tm.getConfig().lastSyncAt).toBeGreaterThan(0);

      vi.unstubAllGlobals();
    });

    it('should return false on HTTP error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal('fetch', mockFetch);

      tm.setEnabled(true);
      tm.setPrivacyLevel(1);
      const payload = tm.collectPayload([], [], { read_file: 1 });
      const result = await tm.sync(payload!);

      expect(result).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should return false on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      tm.setEnabled(true);
      tm.setPrivacyLevel(1);
      const payload = tm.collectPayload([], [], { read_file: 1 });
      const result = await tm.sync(payload!);

      expect(result).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  // ─── Community Learnings ────────────────────────────────────────────

  describe('fetchCommunityLearnings', () => {
    it('should return learnings array on success', async () => {
      const mockLearnings = [
        { category: 'tool_error', errorPattern: 'ENOENT', solution: 'check path', context: 'write_file', confidence: 0.9, tags: ['fs'] },
      ];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ learnings: mockLearnings }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await tm.fetchCommunityLearnings();
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('tool_error');

      vi.unstubAllGlobals();
    });

    it('should return empty array on HTTP error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal('fetch', mockFetch);

      const result = await tm.fetchCommunityLearnings();
      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('should return empty array on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await tm.fetchCommunityLearnings();
      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('should return empty array on malformed response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ notLearnings: 'bad data' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await tm.fetchCommunityLearnings();
      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });
  });
});
