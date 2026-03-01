/**
 * Server-Side Jarvis Types — Shared types for the Jarvis AGI backend.
 * These mirror/extend the CLI jarvis types for server-side execution.
 */

// ─── Task Types ──────────────────────────────────────────────────────

export type JarvisTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type JarvisTaskPriority = 'high' | 'medium' | 'low';
export type JarvisDaemonState = 'stopped' | 'running' | 'paused';

export interface JarvisTask {
  id: number;
  title: string;
  description: string;
  status: JarvisTaskStatus;
  priority: JarvisTaskPriority;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  error?: string;
  retries: number;
  maxRetries: number;
  sessionId?: string;
  dependencies?: number[];
  tags?: string[];
}

// ─── Autonomy ────────────────────────────────────────────────────────

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: 'Observe',
  1: 'Think',
  2: 'Propose',
  3: 'Act-Safe',
  4: 'Act-Ask',
  5: 'Act-Critical',
};

// ─── Worker ──────────────────────────────────────────────────────────

export type WorkerStatus = 'idle' | 'running' | 'paused' | 'error' | 'stopped';

export interface JarvisWorker {
  id: string;
  userId: string;
  status: WorkerStatus;
  currentTaskId: number | null;
  autonomyLevel: AutonomyLevel;
  startedAt: number;
  lastActivityAt: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface JarvisStatusInfo {
  daemonState: JarvisDaemonState;
  currentTaskId: number | null;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  uptimeMs: number;
  autonomyLevel?: AutonomyLevel;
  activeWorkers?: number;
}

// ─── Remote Tool Execution ───────────────────────────────────────────

export interface RemoteToolCall {
  callId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  jarvisSessionId: string;
  timestamp: number;
}

export interface RemoteToolResult {
  callId: string;
  jarvisSessionId: string;
  success: boolean;
  result?: string;
  error?: string;
  timestamp: number;
}

// ─── Plan Limits ─────────────────────────────────────────────────────

export interface JarvisPlanLimits {
  maxInstances: number;
  deepThinking: boolean;
  scheduling: boolean;
  triggers: boolean;
  parallel: boolean;
}

export const JARVIS_PLAN_LIMITS: Record<string, JarvisPlanLimits> = {
  FREE: { maxInstances: 0, deepThinking: false, scheduling: false, triggers: false, parallel: false },
  FREE_PLUS: { maxInstances: 1, deepThinking: false, scheduling: false, triggers: false, parallel: false },
  PRO: { maxInstances: 3, deepThinking: true, scheduling: true, triggers: true, parallel: false },
  TEAM: { maxInstances: Infinity, deepThinking: true, scheduling: true, triggers: true, parallel: true },
  ENTERPRISE: { maxInstances: Infinity, deepThinking: true, scheduling: true, triggers: true, parallel: true },
};
