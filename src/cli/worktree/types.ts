export type WorktreeMode = 'off' | 'auto' | 'force';

export type WorktreeReason =
  | 'autonomous'
  | 'plan_execution'
  | 'swarm_worker';

export interface WorktreePolicy {
  mode: WorktreeMode;
  cleanup: 'remove' | 'keep';
  maxAgeHours: number;
  branchPrefix: string;
}

export interface WorktreeRequest {
  reason: WorktreeReason;
  sessionId: string;
  projectRoot: string;
  branchBase?: string;
}

export interface WorktreeHandle {
  id: string;
  root: string;
  branch: string;
  created: boolean;
  reason: WorktreeReason;
  projectRoot: string;
}

export interface GitWorktreeStatus {
  pathExists: boolean;
  isWorktree: boolean;
  branch?: string;
}
