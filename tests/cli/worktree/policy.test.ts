import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKTREE_POLICY,
  resolveWorktreePolicy,
  shouldUseWorktree,
} from '../../../src/cli/worktree/policy.js';

describe('worktree policy', () => {
  it('resolves defaults and sanitizes values', () => {
    expect(resolveWorktreePolicy()).toEqual(DEFAULT_WORKTREE_POLICY);
    expect(resolveWorktreePolicy({
      maxAgeHours: -4,
      branchPrefix: '  ../weird prefix  ',
    })).toMatchObject({
      maxAgeHours: DEFAULT_WORKTREE_POLICY.maxAgeHours,
      branchPrefix: 'weird-prefix',
    });
  });

  it('enables worktrees only when policy says so', () => {
    expect(shouldUseWorktree(resolveWorktreePolicy({ mode: 'off' }), 'autonomous')).toBe(false);
    expect(shouldUseWorktree(resolveWorktreePolicy({ mode: 'auto' }), 'plan_execution')).toBe(true);
    expect(shouldUseWorktree(resolveWorktreePolicy({ mode: 'force' }), 'swarm_worker')).toBe(true);
  });
});
