/**
 * Safety-fix regression tests (JARVIS-CRITICAL-3, HIGH-1..HIGH-5, HIGH-7, MEDIUM-1).
 * These are stubs — expand with edge cases as the fixes mature.
 */
import { describe, it, expect } from 'vitest';
import { AutonomyManager } from '../../../src/cli/jarvis/autonomy.js';
import {
  isSelfModifyTarget,
  commandMentionsSelfModify,
  canExecute,
} from '../../../src/cli/jarvis/core-ethics.js';
import { computeNextCronFire } from '../../../src/cli/jarvis/scheduler.js';
import { staticallyValidateSkillCode } from '../../../src/cli/jarvis/skills.js';
import type { JarvisIdentity } from '../../../src/cli/jarvis/types.js';

function makeIdentity(over: Partial<JarvisIdentity['trust']> = {}): JarvisIdentity {
  return {
    name: 'Jarvis',
    traits: { confidence: 0.5, caution: 0.5, proactivity: 0.5, verbosity: 0.5, creativity: 0.5, empathy: 0.5 },
    trust: {
      approvalRate: 0,
      successRate: 0,
      totalProposals: 0,
      totalApproved: 0,
      totalDenied: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      autonomyHistory: [],
      ...over,
    },
    autonomyLevel: 2,
    recentLearnings: [],
    strengths: [],
    weaknesses: [],
    userGoals: [],
    customized: false,
    createdAt: Date.now(),
    lastEvolvedAt: Date.now(),
  };
}

describe('JARVIS-CRITICAL-3: AutonomyManager.setLevel validation', () => {
  it('rejects non-integer levels', () => {
    const m = new AutonomyManager(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => m.setLevel(2.5 as any)).toThrow(/Invalid autonomy level/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => m.setLevel('3' as any)).toThrow(/Invalid autonomy level/);
  });

  it('rejects out-of-range levels', () => {
    const m = new AutonomyManager(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => m.setLevel(-1 as any)).toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => m.setLevel(6 as any)).toThrow();
  });

  it('blocks L4+ without sufficient trust when identity is provided', () => {
    const m = new AutonomyManager(2);
    const id = makeIdentity({ totalProposals: 5, totalApproved: 5 });
    expect(() => m.setLevel(4, id)).toThrow(/approvals/);
  });

  it('allows L4 when trust thresholds met', () => {
    const m = new AutonomyManager(2);
    const id = makeIdentity({ totalProposals: 25, totalApproved: 24 });
    m.setLevel(4, id);
    expect(m.getLevel()).toBe(4);
  });
});

describe('JARVIS-HIGH-2: self-modify path matching', () => {
  it('matches safety-critical files even with relative prefixes', () => {
    expect(isSelfModifyTarget('src/cli/jarvis/core-ethics.ts')).toBe(true);
    expect(isSelfModifyTarget('./src/cli/jarvis/core-ethics.ts')).toBe(true);
    expect(isSelfModifyTarget('src\\cli\\jarvis\\core-ethics.ts')).toBe(true);
    expect(isSelfModifyTarget('/abs/src/cli/jarvis/autonomy.ts')).toBe(true);
  });

  it('does not match adjacent files (no substring false positives)', () => {
    expect(isSelfModifyTarget('src/cli/jarvis/core-ethics.test.ts')).toBe(false);
    expect(isSelfModifyTarget('src/other/sandbox.ts.bak')).toBe(false);
    expect(isSelfModifyTarget('docs/sandbox.md')).toBe(false);
  });

  it('blocks run_command targeting safety-critical files', () => {
    expect(commandMentionsSelfModify('rm -f src/cli/agent/sandbox.ts')).toBe(true);
    expect(commandMentionsSelfModify('cat README.md')).toBe(false);
  });

  it('canExecute blocks writes to safety-critical files', () => {
    const result = canExecute({
      action: 'write_file:src/cli/jarvis/core-ethics.ts',
      toolName: 'write_file',
      target: 'src/cli/jarvis/core-ethics.ts',
      autonomyLevel: 5,
      recentActions: [],
    });
    expect(result.allowed).toBe(false);
  });
});

describe('JARVIS-HIGH-1: skill static validation', () => {
  it('rejects code importing child_process', () => {
    const r = staticallyValidateSkillCode(
      `import { exec } from 'child_process';\nexec('whoami');`,
      '/tmp/skills/x',
    );
    expect(r.safe).toBe(false);
  });

  it('rejects eval() and new Function()', () => {
    expect(staticallyValidateSkillCode(`eval("1+1")`, '/tmp/skills/x').safe).toBe(false);
    expect(staticallyValidateSkillCode(`new Function("return 1")`, '/tmp/skills/x').safe).toBe(false);
  });

  it('allows benign code', () => {
    const r = staticallyValidateSkillCode(
      `export default { async hello() { return "hi"; } };`,
      '/tmp/skills/x',
    );
    expect(r.safe).toBe(true);
  });
});

describe('JARVIS-HIGH-5: cron next-fire', () => {
  it('returns a minute-aligned timestamp', () => {
    const from = new Date('2025-01-01T12:00:00Z').getTime();
    const next = computeNextCronFire('*/5 * * * *', from);
    expect(next).toBeDefined();
    // Must be a future minute boundary divisible by 5.
    const d = new Date(next!);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMinutes() % 5).toBe(0);
    expect(next!).toBeGreaterThan(from);
  });

  it('returns undefined for malformed expressions', () => {
    expect(computeNextCronFire('not a cron', Date.now())).toBeUndefined();
    expect(computeNextCronFire('* *', Date.now())).toBeUndefined();
  });
});
