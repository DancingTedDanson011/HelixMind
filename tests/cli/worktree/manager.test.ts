import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { WorktreeManager } from '../../../src/cli/worktree/manager.js';

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
  const root = join(tmpdir(), `helixmind-worktree-manager-${randomUUID()}`);
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

describe('WorktreeManager', () => {
  it('does not allocate worktrees when policy mode is off', async () => {
    const manager = new WorktreeManager({ mode: 'off' });
    const result = await manager.acquire({
      reason: 'autonomous',
      sessionId: 'session-off',
      projectRoot: 'C:\\not-used',
    });
    expect(result).toBeUndefined();
  });

  it('acquires and releases worktrees', async () => {
    if (!hasGit) {
      expect(true).toBe(true);
      return;
    }

    const root = createRepo();
    const manager = new WorktreeManager({
      mode: 'force',
      cleanup: 'remove',
    });

    const handle = await manager.acquire({
      reason: 'swarm_worker',
      sessionId: 'worker-1',
      projectRoot: root,
    });

    expect(handle).toBeDefined();
    expect(manager.list()).toHaveLength(1);
    expect(handle && existsSync(handle.root)).toBe(true);

    const released = await manager.release('worker-1', 'swarm_worker');
    expect(released).toBe(true);
    expect(manager.list()).toHaveLength(0);
    expect(handle && existsSync(handle.root)).toBe(false);
  });

  it('keeps worktrees on disk when cleanup mode is keep', async () => {
    if (!hasGit) {
      expect(true).toBe(true);
      return;
    }

    const root = createRepo();
    const manager = new WorktreeManager({
      mode: 'force',
      cleanup: 'keep',
    });

    const handle = await manager.acquire({
      reason: 'plan_execution',
      sessionId: 'plan-1',
      projectRoot: root,
    });

    expect(handle).toBeDefined();
    const released = await manager.release('plan-1', 'plan_execution');
    expect(released).toBe(true);
    expect(handle && existsSync(handle.root)).toBe(true);
  });
});
