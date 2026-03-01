/**
 * Parallel Task Executor — run multiple Jarvis tasks concurrently.
 * Each worker gets its own AgentController, conversation history, and undo stack.
 * File-lock map prevents 2 workers from editing the same file.
 */
import type { JarvisTask, TaskWorkerState, ParallelConfig } from './types.js';

const DEFAULT_CONFIG: ParallelConfig = {
  maxWorkers: 3,
  maxConcurrentLLMCalls: 3,
};

export class ParallelExecutor {
  private config: ParallelConfig;
  private workers: Map<number, WorkerHandle> = new Map();
  private fileLocks: Map<string, number> = new Map();  // filePath → workerId
  private nextWorkerId = 1;
  private activeLLMCalls = 0;

  constructor(config?: Partial<ParallelConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Can we start another worker?
   */
  canStartMore(): boolean {
    return this.workers.size < this.config.maxWorkers;
  }

  /**
   * Start a worker for a task.
   * Returns a WorkerHandle for management.
   */
  startWorker(
    task: JarvisTask,
    executor: (task: JarvisTask, lockFile: (path: string) => boolean, unlockFile: (path: string) => void) => Promise<{ success: boolean; result: string }>,
  ): TaskWorkerState {
    const workerId = this.nextWorkerId++;

    const handle: WorkerHandle = {
      workerId,
      taskId: task.id,
      taskTitle: task.title,
      status: 'running',
      startedAt: Date.now(),
      abortController: new AbortController(),
      promise: null as unknown as Promise<{ success: boolean; result: string }>,
    };

    // Create file lock functions scoped to this worker
    const lockFile = (path: string): boolean => {
      const existing = this.fileLocks.get(path);
      if (existing !== undefined && existing !== workerId) {
        return false;  // Another worker has the lock
      }
      this.fileLocks.set(path, workerId);
      return true;
    };

    const unlockFile = (path: string): void => {
      if (this.fileLocks.get(path) === workerId) {
        this.fileLocks.delete(path);
      }
    };

    // Start execution
    handle.promise = executor(task, lockFile, unlockFile)
      .then(result => {
        handle.status = result.success ? 'completed' : 'failed';
        handle.completedAt = Date.now();
        // Release all file locks for this worker
        for (const [path, wId] of this.fileLocks) {
          if (wId === workerId) this.fileLocks.delete(path);
        }
        return result;
      })
      .catch(err => {
        handle.status = 'failed';
        handle.completedAt = Date.now();
        // Release all file locks
        for (const [path, wId] of this.fileLocks) {
          if (wId === workerId) this.fileLocks.delete(path);
        }
        return { success: false, result: err instanceof Error ? err.message : String(err) };
      });

    this.workers.set(workerId, handle);

    return {
      workerId,
      taskId: task.id,
      taskTitle: task.title,
      status: 'running',
      startedAt: handle.startedAt,
    };
  }

  /**
   * Get status of all active workers.
   */
  getActiveWorkers(): TaskWorkerState[] {
    const result: TaskWorkerState[] = [];
    for (const handle of this.workers.values()) {
      result.push({
        workerId: handle.workerId,
        taskId: handle.taskId,
        taskTitle: handle.taskTitle,
        status: handle.status,
        startedAt: handle.startedAt,
        completedAt: handle.completedAt,
      });
    }
    return result;
  }

  /**
   * Get count of running workers.
   */
  getRunningCount(): number {
    let count = 0;
    for (const handle of this.workers.values()) {
      if (handle.status === 'running') count++;
    }
    return count;
  }

  /**
   * Abort a specific worker.
   */
  abortWorker(workerId: number): boolean {
    const handle = this.workers.get(workerId);
    if (!handle) return false;
    handle.abortController.abort();
    handle.status = 'failed';
    return true;
  }

  /**
   * Abort all workers.
   */
  abortAll(): void {
    for (const handle of this.workers.values()) {
      if (handle.status === 'running') {
        handle.abortController.abort();
        handle.status = 'failed';
      }
    }
    this.fileLocks.clear();
  }

  /**
   * Clean up completed workers.
   */
  cleanup(): void {
    for (const [id, handle] of this.workers) {
      if (handle.status !== 'running') {
        this.workers.delete(id);
      }
    }
  }

  /**
   * Wait for all workers to complete.
   */
  async waitAll(): Promise<void> {
    const promises = Array.from(this.workers.values())
      .filter(h => h.status === 'running')
      .map(h => h.promise);
    await Promise.allSettled(promises);
  }

  /**
   * Check if a file is locked by any worker.
   */
  isFileLocked(path: string): boolean {
    return this.fileLocks.has(path);
  }

  /**
   * Acquire an LLM call slot (for rate limiting).
   */
  acquireLLMSlot(): boolean {
    if (this.activeLLMCalls >= this.config.maxConcurrentLLMCalls) return false;
    this.activeLLMCalls++;
    return true;
  }

  /**
   * Release an LLM call slot.
   */
  releaseLLMSlot(): void {
    this.activeLLMCalls = Math.max(0, this.activeLLMCalls - 1);
  }
}

interface WorkerHandle {
  workerId: number;
  taskId: number;
  taskTitle: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  abortController: AbortController;
  promise: Promise<{ success: boolean; result: string }>;
}
