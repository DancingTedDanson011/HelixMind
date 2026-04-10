import type { WorktreeHandle, WorktreeReason } from './types.js';

export class WorktreeSessionMap {
  private handles = new Map<string, WorktreeHandle>();

  get(sessionId: string, reason: WorktreeReason): WorktreeHandle | undefined {
    return this.handles.get(buildWorktreeSessionKey(sessionId, reason));
  }

  set(sessionId: string, reason: WorktreeReason, handle: WorktreeHandle): void {
    this.handles.set(buildWorktreeSessionKey(sessionId, reason), handle);
  }

  delete(sessionId: string, reason: WorktreeReason): boolean {
    return this.handles.delete(buildWorktreeSessionKey(sessionId, reason));
  }

  values(): WorktreeHandle[] {
    return [...this.handles.values()];
  }

  clear(): void {
    this.handles.clear();
  }
}

export function buildWorktreeSessionKey(
  sessionId: string,
  reason: WorktreeReason,
): string {
  return `${reason}:${sessionId}`;
}
