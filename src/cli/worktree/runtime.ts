import type { WorktreeManager } from './manager.js';
import type { WorktreeHandle, WorktreeRequest } from './types.js';

export interface ExecutionRuntime {
  projectRoot: string;
  executionRoot: string;
  worktree?: WorktreeHandle;
  isolated: boolean;
  release: () => Promise<void>;
}

export async function prepareExecutionRuntime(
  manager: WorktreeManager,
  request: WorktreeRequest,
  onStatus?: (message: string) => void,
): Promise<ExecutionRuntime> {
  let handle: WorktreeHandle | undefined;
  let released = false;

  try {
    handle = await manager.acquire(request);
    if (handle) {
      onStatus?.(`Using isolated worktree: ${handle.root}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStatus?.(`Worktree unavailable, using project root: ${message}`);
  }

  return {
    projectRoot: request.projectRoot,
    executionRoot: handle?.root ?? request.projectRoot,
    worktree: handle,
    isolated: !!handle,
    release: async () => {
      if (released || !handle) return;
      released = true;
      await manager.release(request.sessionId, request.reason);
    },
  };
}
