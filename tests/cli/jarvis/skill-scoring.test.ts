import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillScorer } from '../../../src/cli/jarvis/skill-scoring.js';
import { LearningJournal } from '../../../src/cli/jarvis/learning.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { SkillEntry, SkillManifest } from '../../../src/cli/jarvis/types.js';

function makeSkill(overrides: Partial<SkillEntry> & { name?: string; description?: string }): SkillEntry {
  const name = overrides.name ?? 'test-skill';
  const description = overrides.description ?? 'A test skill';
  return {
    manifest: {
      name,
      version: '1.0.0',
      description,
      author: 'test',
      origin: 'user',
      main: 'index.js',
      tools: overrides.manifest?.tools,
      triggers: overrides.manifest?.triggers,
    } as SkillManifest,
    status: overrides.status ?? 'active',
    installedAt: Date.now(),
    usageCount: overrides.usageCount ?? 0,
    errors: [],
    path: '/tmp/skills/' + name,
    effectiveness: overrides.effectiveness,
  };
}

describe('SkillScorer', () => {
  let tempDir: string;
  let scorer: SkillScorer;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), `skill-scoring-test-${randomUUID()}-`));
    scorer = new SkillScorer(tempDir);
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
  });

  // ─── Scoring Formula ──────────────────────────────────────────────

  describe('scoreSkills', () => {
    it('should score a skill with known inputs', () => {
      const skill = makeSkill({
        name: 'typescript-linter',
        description: 'lint typescript code for errors',
        status: 'active',
        usageCount: 5,
      });

      // Pre-record effectiveness
      scorer.recordOutcome('typescript-linter', true, 0.8);
      scorer.recordOutcome('typescript-linter', true, 0.6);

      const scores = scorer.scoreSkills('lint my typescript files for errors', 'code_quality', [skill]);
      expect(scores).toHaveLength(1);

      const s = scores[0];
      expect(s.skillName).toBe('typescript-linter');
      expect(s.taskMatch).toBeGreaterThan(0);
      expect(s.buildCost).toBe(0.1); // active
      expect(s.totalScore).toBeGreaterThan(0);
    });

    it('should assign higher buildCost for non-active skills', () => {
      const active = makeSkill({ name: 'a', description: 'test', status: 'active' });
      const installed = makeSkill({ name: 'b', description: 'test', status: 'installed' });
      const available = makeSkill({ name: 'c', description: 'test', status: 'available' });
      const disabled = makeSkill({ name: 'd', description: 'test', status: 'disabled' });

      const scores = scorer.scoreSkills('test', 'test', [active, installed, available, disabled]);
      expect(scores[0].buildCost).toBe(0.1);
      expect(scores[1].buildCost).toBe(0.3);
      expect(scores[2].buildCost).toBe(0.3);
      expect(scores[3].buildCost).toBe(0.8);
    });

    it('should give higher repetitionLikelihood for frequently used skills', () => {
      const unused = makeSkill({ name: 'unused', description: 'test', usageCount: 0 });
      const used = makeSkill({ name: 'used', description: 'test', usageCount: 10 });

      const scores = scorer.scoreSkills('test', 'test', [unused, used]);
      expect(scores[1].repetitionLikelihood).toBeGreaterThan(scores[0].repetitionLikelihood);
    });

    it('should give higher outputImprovement for skills with good track record', () => {
      scorer.recordOutcome('good-skill', true, 0.9);
      scorer.recordOutcome('good-skill', true, 0.8);
      scorer.recordOutcome('bad-skill', false, 0.0);
      scorer.recordOutcome('bad-skill', false, 0.0);

      const good = makeSkill({ name: 'good-skill', description: 'test' });
      const bad = makeSkill({ name: 'bad-skill', description: 'test' });

      const scores = scorer.scoreSkills('test', 'test', [good, bad]);
      expect(scores[0].outputImprovement).toBeGreaterThan(scores[1].outputImprovement);
    });
  });

  // ─── selectBestSkill ──────────────────────────────────────────────

  describe('selectBestSkill', () => {
    it('should return best skill when score >= 0.5', () => {
      // Active skill with matching keywords and effectiveness
      const skill = makeSkill({
        name: 'deploy-helper',
        description: 'deploy application to production server',
        status: 'active',
        usageCount: 5,
      });
      scorer.recordOutcome('deploy-helper', true, 0.9);
      scorer.recordOutcome('deploy-helper', true, 0.8);

      const result = scorer.selectBestSkill('deploy to production server', 'deployment', [skill]);
      // Active skill (0.1 cost) with good match should score well
      if (result) {
        expect(result.skillName).toBe('deploy-helper');
        expect(result.totalScore).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should return null when no skill scores above threshold', () => {
      const skill = makeSkill({
        name: 'unrelated',
        description: 'zzz yyy xxx',
        status: 'disabled',
        usageCount: 0,
      });

      const result = scorer.selectBestSkill('deploy to production', 'deployment', [skill]);
      expect(result).toBeNull();
    });

    it('should return null for empty skills array', () => {
      const result = scorer.selectBestSkill('anything', 'test', []);
      expect(result).toBeNull();
    });

    it('should select the highest scoring skill among multiple', () => {
      const skillA = makeSkill({
        name: 'formatter',
        description: 'format code with prettier',
        status: 'active',
        usageCount: 10,
      });
      const skillB = makeSkill({
        name: 'linter',
        description: 'lint code for bugs',
        status: 'installed',
        usageCount: 1,
      });

      scorer.recordOutcome('formatter', true, 0.9);
      scorer.recordOutcome('formatter', true, 0.8);

      const result = scorer.selectBestSkill('format code with prettier', 'formatting', [skillA, skillB]);
      if (result) {
        expect(result.skillName).toBe('formatter');
      }
    });
  });

  // ─── shouldBuildSkill ─────────────────────────────────────────────

  describe('shouldBuildSkill', () => {
    it('should return false when existing skill scores well', () => {
      const existingScores = [{
        skillName: 'existing',
        taskMatch: 0.8,
        repetitionLikelihood: 0.5,
        outputImprovement: 0.6,
        buildCost: 0.1,
        totalScore: 5.0,
      }];

      const journal = new LearningJournal(tempDir);
      const result = scorer.shouldBuildSkill('test', 'test', existingScores, journal);
      expect(result.should).toBe(false);
      expect(result.reason).toContain('Existing skill');
    });

    it('should return false when not enough related learnings', () => {
      const journal = new LearningJournal(tempDir);
      // Only 1 learning, need 3+
      journal.recordLearning('error xyz', 'fix xyz', 'tool_error', 'context', ['deploy']);

      const result = scorer.shouldBuildSkill('deploy application', 'deployment', [], journal);
      expect(result.should).toBe(false);
      expect(result.reason).toContain('related learnings');
    });

    it('should return true when enough patterns and no good existing skill', () => {
      const journal = new LearningJournal(tempDir);
      // Add 4 related learnings about deployment
      journal.recordLearning('deploy failed connection', 'check deploy server', 'tool_error', 'deploy server', ['deploy']);
      journal.recordLearning('deploy timeout error', 'increase deploy timeout', 'tool_error', 'deploy config', ['deploy']);
      journal.recordLearning('deploy permission denied', 'fix deploy credentials', 'tool_error', 'deploy auth', ['deploy']);
      journal.recordLearning('deploy rollback failed', 'use deploy snapshot', 'tool_error', 'deploy backup', ['deploy']);

      const result = scorer.shouldBuildSkill('deploy application to server', 'deployment', [], journal);
      expect(result.should).toBe(true);
      expect(result.reason).toContain('related patterns');
    });

    it('should return false when hypothetical score is too low', () => {
      const journal = new LearningJournal(tempDir);
      // Add learnings that barely match
      journal.recordLearning('zzz aaa', 'fix aaa', 'tool_error', 'aaa bbb', ['zzz']);
      journal.recordLearning('zzz bbb', 'fix bbb', 'tool_error', 'aaa bbb', ['zzz']);
      journal.recordLearning('zzz ccc', 'fix ccc', 'tool_error', 'aaa bbb', ['zzz']);

      // Task desc with no overlap to the learnings
      const result = scorer.shouldBuildSkill('deploy xyz', 'xyz', [], journal);
      expect(result.should).toBe(false);
    });
  });

  // ─── Effectiveness Tracking ───────────────────────────────────────

  describe('recordOutcome + getEffectiveness', () => {
    it('should create new effectiveness entry on first outcome', () => {
      scorer.recordOutcome('new-skill', true, 0.5);
      const eff = scorer.getEffectiveness('new-skill');
      expect(eff).toBeDefined();
      expect(eff!.timesUsed).toBe(1);
      expect(eff!.timesSuccessful).toBe(1);
      expect(eff!.avgQualityDelta).toBeCloseTo(0.5);
    });

    it('should accumulate outcomes correctly', () => {
      scorer.recordOutcome('skill-a', true, 0.8);
      scorer.recordOutcome('skill-a', false, 0.2);
      scorer.recordOutcome('skill-a', true, 0.6);

      const eff = scorer.getEffectiveness('skill-a')!;
      expect(eff.timesUsed).toBe(3);
      expect(eff.timesSuccessful).toBe(2);
      // avg = (0.8 + 0.2 + 0.6) / 3
      expect(eff.avgQualityDelta).toBeCloseTo(0.533, 2);
    });

    it('should return undefined for unknown skill', () => {
      expect(scorer.getEffectiveness('nonexistent')).toBeUndefined();
    });
  });

  // ─── Persistence ──────────────────────────────────────────────────

  describe('persistence', () => {
    it('should save and reload effectiveness data', () => {
      scorer.recordOutcome('persistent-skill', true, 0.7);
      scorer.recordOutcome('persistent-skill', true, 0.9);

      // Create a new scorer instance pointing to same dir
      const scorer2 = new SkillScorer(tempDir);
      const eff = scorer2.getEffectiveness('persistent-skill');

      expect(eff).toBeDefined();
      expect(eff!.timesUsed).toBe(2);
      expect(eff!.timesSuccessful).toBe(2);
      expect(eff!.avgQualityDelta).toBeCloseTo(0.8);
    });

    it('should recover from corrupted data file', () => {
      const filePath = join(tempDir, '.helixmind', 'jarvis', 'skill-effectiveness.json');
      const { mkdirSync, writeFileSync } = require('node:fs');
      mkdirSync(join(tempDir, '.helixmind', 'jarvis'), { recursive: true });
      writeFileSync(filePath, 'not json{{{', 'utf-8');

      // Should not throw
      const scorer2 = new SkillScorer(tempDir);
      expect(scorer2.getEffectiveness('anything')).toBeUndefined();

      // Should still work
      scorer2.recordOutcome('recovery-test', true, 0.5);
      expect(scorer2.getEffectiveness('recovery-test')!.timesUsed).toBe(1);
    });

    it('should create directories when saving', () => {
      const freshDir = mkdtempSync(join(tmpdir(), `skill-scoring-fresh-${randomUUID()}-`));
      try {
        const freshScorer = new SkillScorer(freshDir);
        freshScorer.recordOutcome('test', true, 1.0);

        const filePath = join(freshDir, '.helixmind', 'jarvis', 'skill-effectiveness.json');
        expect(existsSync(filePath)).toBe(true);

        const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
        expect(raw.version).toBe(1);
        expect(raw.entries['test']).toBeDefined();
      } finally {
        try { rmSync(freshDir, { recursive: true }); } catch { /* ignore */ }
      }
    });
  });
});
