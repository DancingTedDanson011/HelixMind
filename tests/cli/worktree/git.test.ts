import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGitWorktree,
  inspectGitWorktree,
  removeGitWorktree,
} from '../../../src/cli/worktree/git.js';
import { resolveWorktreePolicy } from '../../../src/cli/worktree/policy.js';

const hasGit = (() => {
  try {
    execFileSync('git', ['--version']);
    return true;
  } catch {
    return false;
  }
})();

const repos: string[] = [];

function createRepo(): string {
  const root = join(tmpdir(), `helixmind-worktree-test-${randomUUID()}`);
  repos.push(root);
  mkdirSync(root, { recursive: true });
  execFileSync('git', ['init', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'tester'], { cwd: root });
  writeFileSync(join(root, 'README.md'), '# test\n', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root });
  return root;
}

afterEach(() => {
  for (const root of repos.splice(0)) {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Best-effort temp cleanup.
    }
  }
});

describe('git worktree helpers', () => {
  it('creates, inspects, and removes a worktree', async () => {
    if (!hasGit) {
      expect(true).toBe(true);
      return;
    }

    const root = createRepo();
    const handle = await createGitWorktree({
      reason: 'autonomous',
      sessionId: 'session-1',
      projectRoot: root,
    }, resolveWorktreePolicy({ mode: 'force' }));

    expect(handle.created).toBe(true);
    expect(existsSync(handle.root)).toBe(true);

    const status = await inspectGitWorktree(handle.root);
    expect(status.isWorktree).toBe(true);
    expect(status.branch).toBe(handle.branch);

    await removeGitWorktree(handle);
    expect(existsSync(handle.root)).toBe(false);
  });

  it('reuses an existing worktree path on repeated acquire', async () => {
    if (!hasGit) {
      expect(true).toBe(true);
      return;
    }

    const root = createRepo();
    const policy = resolveWorktreePolicy({ mode: 'force' });
    const request = {
      reason: 'plan_execution' as const,
      sessionId: 'session-2',
      projectRoot: root,
    };

    const first = await createGitWorktree(request, policy);
    const second = await createGitWorktree(request, policy);

    expect(first.root).toBe(second.root);
    expect(second.created).toBe(false);
  });
});
