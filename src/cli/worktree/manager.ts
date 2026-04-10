import { WorktreeSessionMap } from './session.js';
import {
  createGitWorktree,
  keepGitWorktree,
  removeGitWorktree,
} from './git.js';
import {
  DEFAULT_WORKTREE_POLICY,
  resolveWorktreePolicy,
  shouldUseWorktree,
} from './policy.js';
import type { WorktreeHandle, WorktreePolicy, WorktreeRequest } from './types.js';

export class WorktreeManager {
  private readonly policy: WorktreePolicy;
  private readonly sessions = new WorktreeSessionMap();

  constructor(policy: Partial<WorktreePolicy> = {}) {
    this.policy = resolveWorktreePolicy({
      ...DEFAULT_WORKTREE_POLICY,
      ...policy,
    });
  }

  get activePolicy(): WorktreePolicy {
    return this.policy;
  }

  async acquire(request: WorktreeRequest): Promise<WorktreeHandle | undefined> {
    if (!shouldUseWorktree(this.policy, request.reason)) {
      return undefined;
    }

    const existing = this.sessions.get(request.sessionId, request.reason);
    if (existing) {
      return existing;
    }

    const handle = await createGitWorktree(request, this.policy);
    this.sessions.set(request.sessionId, request.reason, handle);
    return handle;
  }

  get(sessionId: string, reason: WorktreeRequest['reason']): WorktreeHandle | undefined {
    return this.sessions.get(sessionId, reason);
  }

  list(): WorktreeHandle[] {
    return this.sessions.values();
  }

  async release(
    sessionId: string,
    reason: WorktreeRequest['reason'],
    cleanup: WorktreePolicy['cleanup'] = this.policy.cleanup,
  ): Promise<boolean> {
    const handle = this.sessions.get(sessionId, reason);
    if (!handle) return false;

    if (cleanup === 'remove') {
      await removeGitWorktree(handle);
    } else {
      await keepGitWorktree(handle);
    }

    this.sessions.delete(sessionId, reason);
    return true;
  }
}
