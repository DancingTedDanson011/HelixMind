import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LearningJournal } from '../../../src/cli/jarvis/learning.js';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('LearningJournal', () => {
  let tempDir: string;
  let journal: LearningJournal;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), `learning-test-${randomUUID()}-`));
    journal = new LearningJournal(tempDir);
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
  });

  // ─── CRUD ──────────────────────────────────────────────────────────

  describe('recordLearning', () => {
    it('should create a learning entry with auto-incrementing ID', () => {
      const entry1 = journal.recordLearning(
        'ENOENT: no such file',
        'Check file exists first with list_directory',
        'tool_error',
        'write_file .ts',
        ['filesystem'],
      );
      const entry2 = journal.recordLearning(
        'SyntaxError: Unexpected token',
        'Validate JSON before writing',
        'framework_gotcha',
        'write_file .json',
        ['json'],
      );

      expect(entry1.id).toBe(1);
      expect(entry2.id).toBe(2);
      expect(entry1.category).toBe('tool_error');
      expect(entry1.confidence).toBe(0.5);
      expect(entry1.successCount).toBe(0);
    });

    it('should update existing entry with same error pattern + context', () => {
      journal.recordLearning('ENOENT', 'Fix A', 'tool_error', 'write_file .ts');
      const updated = journal.recordLearning('ENOENT', 'Fix B', 'tool_error', 'write_file .ts');

      expect(updated.id).toBe(1); // Same entry
      expect(updated.solution).toBe('Fix B'); // Updated solution
      expect(updated.successCount).toBe(1); // Incremented
      expect(updated.confidence).toBeGreaterThan(0.5); // Boosted
      expect(journal.count).toBe(1); // No duplicate
    });

    it('should normalize error patterns (strip paths)', () => {
      const entry = journal.recordLearning(
        'ENOENT: /home/user/project/src/app.ts not found',
        'Check path',
        'tool_error',
        'read_file',
      );
      expect(entry.errorPattern).not.toContain('/home/user');
      expect(entry.errorPattern).toContain('<path>');
    });

    it('should normalize Windows paths', () => {
      const entry = journal.recordLearning(
        'ENOENT: C:\\Users\\test\\file.ts not found',
        'Check path',
        'tool_error',
        'read_file',
      );
      expect(entry.errorPattern).not.toContain('C:\\Users');
      expect(entry.errorPattern).toContain('<path>');
    });
  });

  describe('get', () => {
    it('should retrieve a learning by ID', () => {
      const created = journal.recordLearning('error', 'fix', 'tool_error', 'ctx');
      const retrieved = journal.get(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.solution).toBe('fix');
    });

    it('should return undefined for non-existent ID', () => {
      expect(journal.get(999)).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all entries', () => {
      journal.recordLearning('err1', 'fix1', 'tool_error', 'ctx1');
      journal.recordLearning('err2', 'fix2', 'tool_error', 'ctx2');
      expect(journal.getAll()).toHaveLength(2);
    });

    it('should return a copy (not reference)', () => {
      journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      const all = journal.getAll();
      all.length = 0;
      expect(journal.count).toBe(1);
    });
  });

  // ─── Confidence Mathematics ─────────────────────────────────────────

  describe('confidence', () => {
    it('should start at 0.5', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      expect(entry.confidence).toBe(0.5);
    });

    it('should increase by 0.1 on success', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      journal.reinforceSuccess(entry.id);
      expect(journal.get(entry.id)!.confidence).toBeCloseTo(0.6, 5);
      expect(journal.get(entry.id)!.successCount).toBe(1);
    });

    it('should decrease by 0.15 on failure', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      journal.reinforceFailure(entry.id);
      expect(journal.get(entry.id)!.confidence).toBeCloseTo(0.35, 5);
      expect(journal.get(entry.id)!.failCount).toBe(1);
    });

    it('should cap at 1.0', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      for (let i = 0; i < 20; i++) journal.reinforceSuccess(entry.id);
      expect(journal.get(entry.id)!.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should not go below 0', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      for (let i = 0; i < 20; i++) journal.reinforceFailure(entry.id);
      expect(journal.get(entry.id)!.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle reinforcement of non-existent IDs gracefully', () => {
      expect(() => journal.reinforceSuccess(999)).not.toThrow();
      expect(() => journal.reinforceFailure(999)).not.toThrow();
    });
  });

  // ─── Query ──────────────────────────────────────────────────────────

  describe('queryRelevant', () => {
    it('should match by tool name in context', () => {
      journal.recordLearning('ENOENT', 'use list_dir', 'tool_error', 'write_file .ts', ['fs']);
      journal.recordLearning('timeout', 'reduce batch', 'tool_error', 'run_command', ['perf']);

      const results = journal.queryRelevant('write_file', { path: 'src/app.ts' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].context).toContain('write_file');
    });

    it('should match by file extension', () => {
      journal.recordLearning('import error', 'use .js ext', 'framework_gotcha', 'edit_file .ts', ['esm']);
      journal.recordLearning('css error', 'check selector', 'tool_error', 'edit_file .css', ['css']);

      const results = journal.queryRelevant('edit_file', { path: 'src/app.ts' });
      const tsResult = results.find(r => r.context.includes('.ts'));
      expect(tsResult).toBeDefined();
    });

    it('should filter out low-confidence entries', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'write_file .ts');
      // Lower confidence below threshold
      for (let i = 0; i < 5; i++) journal.reinforceFailure(entry.id);

      const results = journal.queryRelevant('write_file', { path: 'test.ts' });
      // Should not include near-zero confidence entries
      for (const r of results) {
        expect(r.confidence).toBeGreaterThanOrEqual(0.1);
      }
    });

    it('should respect maxTokens limit', () => {
      // Add many learnings
      for (let i = 0; i < 50; i++) {
        journal.recordLearning(
          `Error type ${i}: ${'x'.repeat(100)}`,
          `Solution ${i}: ${'y'.repeat(100)}`,
          'tool_error',
          'write_file .ts',
          ['tag1'],
        );
      }

      const results = journal.queryRelevant('write_file', { path: 'test.ts' }, 200);
      // Should be limited by token budget
      const totalChars = results.reduce((sum, e) =>
        sum + e.category.length + e.errorPattern.length + e.solution.length, 0);
      expect(totalChars / 4).toBeLessThanOrEqual(300); // rough check with margin
    });
  });

  // ─── Prompt Section ─────────────────────────────────────────────────

  describe('getPromptSection', () => {
    it('should return null when no relevant learnings', () => {
      expect(journal.getPromptSection('write_file', {})).toBeNull();
    });

    it('should return formatted hints when relevant learnings exist', () => {
      journal.recordLearning('ENOENT', 'check path', 'tool_error', 'write_file .ts', ['fs']);
      const section = journal.getPromptSection('write_file', { path: 'src/test.ts' });
      expect(section).toContain('[Learning Hints');
      expect(section).toContain('ENOENT');
      expect(section).toContain('check path');
    });
  });

  describe('getSummaryForPrompt', () => {
    it('should return null when no high-confidence learnings', () => {
      expect(journal.getSummaryForPrompt()).toBeNull();
    });

    it('should return summary with high-confidence learnings', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      // Boost to >= 0.6
      journal.reinforceSuccess(entry.id);
      journal.reinforceSuccess(entry.id);

      const summary = journal.getSummaryForPrompt();
      expect(summary).toContain('## Failure Memory');
      expect(summary).toContain('fix');
    });
  });

  // ─── Decay & Pruning ───────────────────────────────────────────────

  describe('applyDecay', () => {
    it('should decay confidence over time periods', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      expect(entry.confidence).toBe(0.5);

      // Manually set lastDecayAt to 14 days ago (2 periods)
      (journal as any).data.lastDecayAt = Date.now() - 14 * 24 * 60 * 60 * 1000;
      journal.applyDecay();

      const updated = journal.get(entry.id);
      // 0.5 * 0.95^2 = 0.45125
      expect(updated!.confidence).toBeCloseTo(0.451, 2);
    });

    it('should prune entries below 0.1 threshold', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      // Set confidence very low
      for (let i = 0; i < 5; i++) journal.reinforceFailure(entry.id);

      // Set decay to long ago — enough to push below threshold
      (journal as any).data.lastDecayAt = Date.now() - 365 * 24 * 60 * 60 * 1000;
      journal.applyDecay();

      expect(journal.count).toBe(0);
    });
  });

  // ─── Persistence ────────────────────────────────────────────────────

  describe('persistence', () => {
    it('should persist and reload data', () => {
      journal.recordLearning('err1', 'fix1', 'tool_error', 'ctx1', ['tag1']);
      journal.recordLearning('err2', 'fix2', 'framework_gotcha', 'ctx2', ['tag2']);

      // Create new instance from same path
      const journal2 = new LearningJournal(tempDir);
      expect(journal2.count).toBe(2);
      expect(journal2.get(1)!.solution).toBe('fix1');
      expect(journal2.get(2)!.category).toBe('framework_gotcha');
    });

    it('should handle corrupted file gracefully', () => {
      const filePath = join(tempDir, '.helixmind', 'jarvis', 'learnings.json');
      const { mkdirSync, writeFileSync } = require('node:fs');
      mkdirSync(join(tempDir, '.helixmind', 'jarvis'), { recursive: true });
      writeFileSync(filePath, '{invalid json!!!', 'utf-8');

      const journal2 = new LearningJournal(tempDir);
      expect(journal2.count).toBe(0);
    });
  });

  // ─── Promotion ──────────────────────────────────────────────────────

  describe('promotion', () => {
    it('should identify promotion candidates (confidence >= 0.8)', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      // Boost to 0.8+
      for (let i = 0; i < 4; i++) journal.reinforceSuccess(entry.id);
      // confidence: 0.5 + 4*0.1 = 0.9

      const candidates = journal.getPromotionCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].id).toBe(entry.id);
    });

    it('should not re-promote already promoted entries', () => {
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      for (let i = 0; i < 4; i++) journal.reinforceSuccess(entry.id);
      journal.markPromoted(entry.id, 'spiral-node-123');

      const candidates = journal.getPromotionCandidates();
      expect(candidates).toHaveLength(0);
    });
  });

  // ─── Status Line ────────────────────────────────────────────────────

  describe('getStatusLine', () => {
    it('should return empty string when no entries', () => {
      expect(journal.getStatusLine()).toBe('');
    });

    it('should return formatted status', () => {
      journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      expect(journal.getStatusLine()).toContain('1 learnings');
    });
  });

  // ─── onChange callback ──────────────────────────────────────────────

  describe('onChange', () => {
    it('should fire onChange on recordLearning', () => {
      const events: string[] = [];
      journal.setOnChange((event) => events.push(event));

      journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      expect(events).toContain('learning_recorded');
    });

    it('should fire onChange on reinforce', () => {
      const events: string[] = [];
      const entry = journal.recordLearning('err', 'fix', 'tool_error', 'ctx');
      journal.setOnChange((event) => events.push(event));

      journal.reinforceSuccess(entry.id);
      expect(events).toContain('learning_reinforced');

      journal.reinforceFailure(entry.id);
      expect(events).toContain('learning_weakened');
    });
  });
});
