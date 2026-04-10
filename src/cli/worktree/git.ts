import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type {
  GitWorktreeStatus,
  WorktreeHandle,
  WorktreePolicy,
  WorktreeRequest,
} from './types.js';
import { buildWorktreeSessionKey } from './session.js';

const execFileAsync = promisify(execFile);

export async function createGitWorktree(
  request: WorktreeRequest,
  policy: WorktreePolicy,
): Promise<WorktreeHandle> {
  const root = getWorktreePath(request);
  const branch = getWorktreeBranchName(request, policy);
  const id = buildWorktreeSessionKey(request.sessionId, request.reason);

  const existing = await inspectGitWorktree(root);
  if (existing.isWorktree) {
    return {
      id,
      root,
      branch,
      created: false,
      reason: request.reason,
      projectRoot: request.projectRoot,
    };
  }

  if (existing.pathExists) {
    await rm(root, { recursive: true, force: true });
  }

  await mkdir(dirname(root), { recursive: true });

  const baseRef = request.branchBase ?? await getCurrentBranch(request.projectRoot);
  await execGit(
    ['worktree', 'add', '-B', branch, root, baseRef],
    request.projectRoot,
  );

  return {
    id,
    root,
    branch,
    created: true,
    reason: request.reason,
    projectRoot: request.projectRoot,
  };
}

export async function inspectGitWorktree(root: string): Promise<GitWorktreeStatus> {
  const exists = await pathExistsOnDisk(root);
  if (!exists) {
    return { pathExists: false, isWorktree: false };
  }

  try {
    const branch = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], root)).trim();
    return {
      pathExists: true,
      isWorktree: true,
      branch,
    };
  } catch {
    return {
      pathExists: true,
      isWorktree: false,
    };
  }
}

export async function removeGitWorktree(handle: WorktreeHandle): Promise<void> {
  try {
    await execGit(['worktree', 'remove', '--force', handle.root], handle.projectRoot);
  } finally {
    try {
      await execGit(['branch', '-D', handle.branch], handle.projectRoot);
    } catch {
      // Best-effort cleanup for already-removed or missing branches.
    }
  }
}

export async function keepGitWorktree(handle: WorktreeHandle): Promise<WorktreeHandle> {
  return handle;
}

export function getWorktreePath(request: WorktreeRequest): string {
  const slug = sanitizeSegment(`${request.reason}-${request.sessionId}`);
  return join(request.projectRoot, '.helixmind', 'worktrees', slug);
}

export function getWorktreeBranchName(
  request: WorktreeRequest,
  policy: WorktreePolicy,
): string {
  return [
    policy.branchPrefix,
    request.reason,
    sanitizeSegment(request.sessionId),
  ].join('/');
}

export async function getCurrentBranch(projectRoot: string): Promise<string> {
  return (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot)).trim();
}

async function execGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout;
}

async function pathExistsOnDisk(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'worktree';
}
