import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BugJournal } from '../../../src/cli/bugs/journal.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('BugJournal', () => {
  let tempDir: string;
  let journal: BugJournal;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), `bugs-test-${randomUUID()}-`));
    journal = new BugJournal(tempDir);
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
  });

  describe('create', () => {
    it('should create a bug with auto-incrementing ID', () => {
      const bug1 = journal.create('Login button crashes');
      const bug2 = journal.create('Sidebar overflows on mobile');

      expect(bug1.id).toBe(1);
      expect(bug2.id).toBe(2);
      expect(bug1.status).toBe('open');
      expect(bug1.description).toBe('Login button crashes');
    });

    it('should accept optional file and line', () => {
      const bug = journal.create('Null pointer', {
        file: 'src/app.ts',
        line: 42,
      });

      expect(bug.file).toBe('src/app.ts');
      expect(bug.line).toBe(42);
    });

    it('should accept initial evidence', () => {
      const bug = journal.create('Runtime error', {
        evidence: [
          { type: 'error_message', content: 'TypeError: null', timestamp: Date.now() },
        ],
      });

      expect(bug.evidence).toHaveLength(1);
      expect(bug.evidence[0].type).toBe('error_message');
    });
  });

  describe('get', () => {
    it('should retrieve a bug by ID', () => {
      const created = journal.create('Test bug');
      const retrieved = journal.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.description).toBe('Test bug');
    });

    it('should return undefined for non-existent ID', () => {
      expect(journal.get(999)).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update bug description', () => {
      const bug = journal.create('Vague bug');
      const updated = journal.update(bug.id, { description: 'Specific bug' });

      expect(updated!.description).toBe('Specific bug');
    });

    it('should update status and set fixedAt', () => {
      const bug = journal.create('A bug');
      const fixed = journal.update(bug.id, { status: 'fixed' });

      expect(fixed!.status).toBe('fixed');
      expect(fixed!.fixedAt).toBeDefined();
    });

    it('should return undefined for non-existent bug', () => {
      expect(journal.update(999, { description: 'nope' })).toBeUndefined();
    });
  });

  describe('addEvidence', () => {
    it('should append evidence to a bug', () => {
      const bug = journal.create('Buggy');
      journal.addEvidence(bug.id, {
        type: 'stack_trace',
        content: 'at app.ts:10',
        timestamp: Date.now(),
      });

      const updated = journal.get(bug.id)!;
      expect(updated.evidence).toHaveLength(1);
      expect(updated.evidence[0].type).toBe('stack_trace');
    });
  });

  describe('markFixed / markVerified', () => {
    it('should mark as fixed with description', () => {
      const bug = journal.create('Broken');
      journal.markFixed(bug.id, 'Wrapped in try-catch');

      const fixed = journal.get(bug.id)!;
      expect(fixed.status).toBe('fixed');
      expect(fixed.fixDescription).toBe('Wrapped in try-catch');
      expect(fixed.fixedAt).toBeDefined();
    });

    it('should mark as verified', () => {
      const bug = journal.create('Was broken');
      journal.markFixed(bug.id);
      journal.markVerified(bug.id);

      const verified = journal.get(bug.id)!;
      expect(verified.status).toBe('verified');
      expect(verified.verifiedAt).toBeDefined();
    });
  });

  describe('getByStatus / getOpenBugs', () => {
    it('should filter by status', () => {
      journal.create('Open bug 1');
      journal.create('Open bug 2');
      const b3 = journal.create('Fixed bug');
      journal.markFixed(b3.id);

      expect(journal.getByStatus('open')).toHaveLength(2);
      expect(journal.getByStatus('fixed')).toHaveLength(1);
      expect(journal.getOpenBugs()).toHaveLength(2);
    });

    it('should include investigating in open bugs', () => {
      const b = journal.create('Bug');
      journal.update(b.id, { status: 'investigating' });

      expect(journal.getOpenBugs()).toHaveLength(1);
    });
  });

  describe('persistence', () => {
    it('should persist bugs across instances', () => {
      journal.create('Persisted bug');
      journal.create('Another bug');

      // Create new journal pointing to same directory
      const journal2 = new BugJournal(tempDir);

      expect(journal2.count).toBe(2);
      expect(journal2.get(1)!.description).toBe('Persisted bug');
    });

    it('should create .helixmind directory if needed', () => {
      const freshDir = mkdtempSync(join(tmpdir(), `bugs-fresh-${randomUUID()}-`));
      try {
        const j = new BugJournal(freshDir);
        j.create('Test');
        expect(existsSync(join(freshDir, '.helixmind', 'bugs.json'))).toBe(true);
      } finally {
        try { rmSync(freshDir, { recursive: true }); } catch { /* ignore */ }
      }
    });
  });

  describe('getSummaryForPrompt', () => {
    it('should return null when no bugs', () => {
      expect(journal.getSummaryForPrompt()).toBeNull();
    });

    it('should return summary with open bugs', () => {
      journal.create('Login broken', { file: 'auth.ts', line: 10 });
      journal.create('CSS overflow');

      const summary = journal.getSummaryForPrompt()!;
      expect(summary).toContain('## Bug Journal');
      expect(summary).toContain('#1');
      expect(summary).toContain('#2');
      expect(summary).toContain('auth.ts:10');
    });

    it('should show fixed bugs awaiting verification', () => {
      const b = journal.create('Was broken');
      journal.markFixed(b.id, 'Patched it');

      const summary = journal.getSummaryForPrompt()!;
      expect(summary).toContain('Fixed (awaiting verification');
      expect(summary).toContain('Patched it');
    });

    it('should return null when all bugs are verified', () => {
      const b = journal.create('Old bug');
      journal.markFixed(b.id);
      journal.markVerified(b.id);

      expect(journal.getSummaryForPrompt()).toBeNull();
    });
  });

  describe('getStatusLine', () => {
    it('should return empty string when no bugs', () => {
      expect(journal.getStatusLine()).toBe('');
    });

    it('should show counts by status', () => {
      journal.create('Open 1');
      journal.create('Open 2');
      const b = journal.create('Fixed');
      journal.markFixed(b.id);

      const line = journal.getStatusLine();
      expect(line).toContain('2 open');
      expect(line).toContain('1 fixed');
    });
  });

  describe('addRelatedFile', () => {
    it('should add a related file without duplicates', () => {
      const bug = journal.create('Bug');
      journal.addRelatedFile(bug.id, 'src/app.ts');
      journal.addRelatedFile(bug.id, 'src/app.ts'); // duplicate
      journal.addRelatedFile(bug.id, 'src/other.ts');

      const b = journal.get(bug.id)!;
      expect(b.relatedFiles).toHaveLength(2);
    });
  });

  describe('onChange callback', () => {
    it('should fire on create', () => {
      let event = '';
      const j = new BugJournal(tempDir, (e) => { event = e; });
      j.create('New bug');
      expect(event).toBe('bug_created');
    });

    it('should fire on update', () => {
      let event = '';
      const j = new BugJournal(tempDir, (e) => { event = e; });
      const b = j.create('Bug');
      j.markFixed(b.id);
      expect(event).toBe('bug_updated');
    });
  });
});
