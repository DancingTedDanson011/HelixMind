import type { WorktreePolicy, WorktreeReason } from './types.js';

export const DEFAULT_WORKTREE_POLICY: WorktreePolicy = {
  mode: 'off',
  cleanup: 'keep',
  maxAgeHours: 72,
  branchPrefix: 'helix',
};

export function resolveWorktreePolicy(
  input: Partial<WorktreePolicy> = {},
): WorktreePolicy {
  return {
    mode: input.mode ?? DEFAULT_WORKTREE_POLICY.mode,
    cleanup: input.cleanup ?? DEFAULT_WORKTREE_POLICY.cleanup,
    maxAgeHours: normalizePositiveInteger(input.maxAgeHours, DEFAULT_WORKTREE_POLICY.maxAgeHours),
    branchPrefix: normalizeBranchPrefix(input.branchPrefix ?? DEFAULT_WORKTREE_POLICY.branchPrefix),
  };
}

export function shouldUseWorktree(
  policy: WorktreePolicy,
  reason: WorktreeReason,
): boolean {
  if (policy.mode === 'off') return false;
  if (policy.mode === 'force') return true;

  return [
    'autonomous',
    'plan_execution',
    'swarm_worker',
  ].includes(reason);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeBranchPrefix(prefix: string): string {
  const cleaned = prefix
    .trim()
    .replace(/[^A-Za-z0-9/_-]/g, '-')
    .replace(/\/+/g, '/')
    .replace(/\.\.+/g, '-')
    .replace(/^\/|\/$/g, '');

  const withoutDots = cleaned
    .split('/')
    .map(segment => segment.replace(/^-+|-+$/g, ''))
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .join('/');

  return withoutDots || DEFAULT_WORKTREE_POLICY.branchPrefix;
}
