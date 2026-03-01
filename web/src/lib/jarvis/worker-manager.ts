/**
 * Jarvis Worker Manager — Manages Jarvis worker instances per user.
 * Each user can have N workers (depending on plan).
 * Workers run the Jarvis LLM loop server-side and proxy tool calls to the CLI.
 */
import { randomUUID } from 'crypto';
import { canStartJarvis } from './plan-check.js';
import type { JarvisWorker, WorkerStatus, AutonomyLevel, JarvisTask } from './types.js';

// ---------------------------------------------------------------------------
// In-Memory Worker Pool (will be DB-backed in production)
// ---------------------------------------------------------------------------

const workerPool = new Map<string, JarvisWorker[]>(); // userId → workers

// ---------------------------------------------------------------------------
// Worker Lifecycle
// ---------------------------------------------------------------------------

export interface StartWorkerResult {
  success: boolean;
  worker?: JarvisWorker;
  error?: string;
}

/**
 * Start a new Jarvis worker for a user.
 * Checks plan limits before starting.
 */
export function startWorker(userId: string, plan: string): StartWorkerResult {
  const currentWorkers = getActiveWorkers(userId);
  const check = canStartJarvis(plan, currentWorkers.length);

  if (!check.allowed) {
    return { success: false, error: check.reason };
  }

  const worker: JarvisWorker = {
    id: `jarvis_${randomUUID().slice(0, 12)}`,
    userId,
    status: 'running',
    currentTaskId: null,
    autonomyLevel: 2, // Default: Propose
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
    tasksCompleted: 0,
    tasksFailed: 0,
  };

  if (!workerPool.has(userId)) {
    workerPool.set(userId, []);
  }
  workerPool.get(userId)!.push(worker);

  return { success: true, worker };
}

/**
 * Stop a Jarvis worker.
 */
export function stopWorker(userId: string, workerId?: string): boolean {
  const workers = workerPool.get(userId);
  if (!workers) return false;

  if (workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return false;
    worker.status = 'stopped';
    return true;
  }

  // Stop the first running worker
  const running = workers.find(w => w.status === 'running' || w.status === 'paused');
  if (!running) return false;
  running.status = 'stopped';
  return true;
}

/**
 * Pause a Jarvis worker.
 */
export function pauseWorker(userId: string, workerId?: string): boolean {
  const workers = workerPool.get(userId);
  if (!workers) return false;

  const worker = workerId
    ? workers.find(w => w.id === workerId)
    : workers.find(w => w.status === 'running');

  if (!worker || worker.status !== 'running') return false;
  worker.status = 'paused';
  return true;
}

/**
 * Resume a paused Jarvis worker.
 */
export function resumeWorker(userId: string, workerId?: string): boolean {
  const workers = workerPool.get(userId);
  if (!workers) return false;

  const worker = workerId
    ? workers.find(w => w.id === workerId)
    : workers.find(w => w.status === 'paused');

  if (!worker || worker.status !== 'paused') return false;
  worker.status = 'running';
  return true;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all active (non-stopped) workers for a user.
 */
export function getActiveWorkers(userId: string): JarvisWorker[] {
  const workers = workerPool.get(userId) ?? [];
  return workers.filter(w => w.status !== 'stopped');
}

/**
 * Get all workers for a user (including stopped).
 */
export function getAllWorkers(userId: string): JarvisWorker[] {
  return workerPool.get(userId) ?? [];
}

/**
 * Get a specific worker by ID.
 */
export function getWorker(userId: string, workerId: string): JarvisWorker | null {
  const workers = workerPool.get(userId) ?? [];
  return workers.find(w => w.id === workerId) ?? null;
}

// ---------------------------------------------------------------------------
// Worker Updates
// ---------------------------------------------------------------------------

/**
 * Update worker status when it picks up or completes a task.
 */
export function updateWorkerTask(
  userId: string,
  workerId: string,
  taskId: number | null,
  status?: WorkerStatus,
): void {
  const worker = getWorker(userId, workerId);
  if (!worker) return;

  worker.currentTaskId = taskId;
  worker.lastActivityAt = Date.now();
  if (status) worker.status = status;
}

/**
 * Record task completion/failure on a worker.
 */
export function recordTaskResult(
  userId: string,
  workerId: string,
  success: boolean,
): void {
  const worker = getWorker(userId, workerId);
  if (!worker) return;

  if (success) {
    worker.tasksCompleted++;
  } else {
    worker.tasksFailed++;
  }
  worker.currentTaskId = null;
  worker.lastActivityAt = Date.now();
}

/**
 * Set autonomy level for a worker.
 */
export function setWorkerAutonomy(
  userId: string,
  workerId: string,
  level: AutonomyLevel,
): boolean {
  const worker = getWorker(userId, workerId);
  if (!worker) return false;
  worker.autonomyLevel = level;
  return true;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Remove stopped workers older than maxAge (default: 1 hour).
 */
export function cleanupStoppedWorkers(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [userId, workers] of workerPool) {
    const active = workers.filter(
      w => w.status !== 'stopped' || (now - w.lastActivityAt) < maxAgeMs,
    );
    if (active.length === 0) {
      workerPool.delete(userId);
    } else {
      workerPool.set(userId, active);
    }
  }
}

/**
 * Get total active worker count across all users (for monitoring).
 */
export function getTotalActiveWorkers(): number {
  let count = 0;
  for (const workers of workerPool.values()) {
    count += workers.filter(w => w.status === 'running' || w.status === 'paused').length;
  }
  return count;
}
