import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { JarvisTask, JarvisTaskStatus, JarvisTaskPriority, JarvisQueueData, JarvisDaemonState, JarvisStatusInfo } from './types.js';

const EMPTY_DATA: JarvisQueueData = { version: 1, nextId: 1, tasks: [], daemonState: 'stopped' };

const PRIORITY_ORDER: Record<JarvisTaskPriority, number> = { high: 0, medium: 1, low: 2 };

export class JarvisQueue {
  private data: JarvisQueueData;
  private filePath: string;
  private onChange?: (event: string, task: JarvisTask) => void;
  private daemonStartTime: number | null = null;

  constructor(projectRoot: string, onChange?: (event: string, task: JarvisTask) => void) {
    this.filePath = join(projectRoot, '.helixmind', 'jarvis', 'tasks.json');
    this.onChange = onChange;
    this.data = this.load();

    // Crash recovery: reset any stale 'running' tasks back to 'pending'
    for (const task of this.data.tasks) {
      if (task.status === 'running') {
        task.status = 'pending';
        task.updatedAt = Date.now();
      }
    }
    if (this.data.tasks.some(t => t.status === 'pending')) {
      this.save();
    }
  }

  private load(): JarvisQueueData {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as JarvisQueueData;
        if (parsed.version === 1 && Array.isArray(parsed.tasks)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted file — start fresh
    }
    return { ...EMPTY_DATA, tasks: [] };
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  addTask(title: string, description: string, opts?: {
    priority?: JarvisTaskPriority;
    dependencies?: number[];
    tags?: string[];
    maxRetries?: number;
  }): JarvisTask {
    const task: JarvisTask = {
      id: this.data.nextId++,
      title,
      description,
      status: 'pending',
      priority: opts?.priority ?? 'medium',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retries: 0,
      maxRetries: opts?.maxRetries ?? 3,
      dependencies: opts?.dependencies,
      tags: opts?.tags,
    };
    this.data.tasks.push(task);
    this.save();
    this.onChange?.('task_created', task);
    return task;
  }

  getTask(id: number): JarvisTask | undefined {
    return this.data.tasks.find(t => t.id === id);
  }

  updateTask(id: number, updates: Partial<Pick<JarvisTask,
    'status' | 'priority' | 'title' | 'description' | 'result' | 'error' |
    'startedAt' | 'completedAt' | 'retries' | 'sessionId' | 'tags'
  >>): JarvisTask | undefined {
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return undefined;

    if (updates.status !== undefined) task.status = updates.status;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.result !== undefined) task.result = updates.result;
    if (updates.error !== undefined) task.error = updates.error;
    if (updates.startedAt !== undefined) task.startedAt = updates.startedAt;
    if (updates.completedAt !== undefined) task.completedAt = updates.completedAt;
    if (updates.retries !== undefined) task.retries = updates.retries;
    if (updates.sessionId !== undefined) task.sessionId = updates.sessionId;
    if (updates.tags !== undefined) task.tags = updates.tags;

    task.updatedAt = Date.now();
    this.save();
    this.onChange?.('task_updated', task);
    return task;
  }

  removeTask(id: number): boolean {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.tasks.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * Returns the next task to execute: highest priority pending task
   * whose dependencies (if any) are all completed.
   */
  getNextTask(): JarvisTask | undefined {
    const pending = this.data.tasks
      .filter(t => t.status === 'pending')
      .filter(t => {
        if (!t.dependencies || t.dependencies.length === 0) return true;
        return t.dependencies.every(depId => {
          const dep = this.data.tasks.find(d => d.id === depId);
          return dep?.status === 'completed';
        });
      });

    pending.sort((a, b) => {
      if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      return a.createdAt - b.createdAt;
    });

    return pending[0];
  }

  getByStatus(status: JarvisTaskStatus): JarvisTask[] {
    return this.data.tasks.filter(t => t.status === status);
  }

  getAllTasks(): JarvisTask[] {
    return [...this.data.tasks];
  }

  clearCompleted(): number {
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter(t => t.status !== 'completed');
    const removed = before - this.data.tasks.length;
    if (removed > 0) this.save();
    return removed;
  }

  get count(): number {
    return this.data.tasks.length;
  }

  get pendingCount(): number {
    return this.getByStatus('pending').length;
  }

  // --- Daemon state (persisted) ---

  getDaemonState(): JarvisDaemonState {
    return this.data.daemonState;
  }

  setDaemonState(state: JarvisDaemonState): void {
    this.data.daemonState = state;
    if (state === 'running') {
      this.data.lastRunAt = Date.now();
      this.daemonStartTime = Date.now();
    } else if (state === 'stopped') {
      this.daemonStartTime = null;
    }
    this.save();
  }

  getStatus(): JarvisStatusInfo {
    const running = this.data.tasks.find(t => t.status === 'running');
    return {
      daemonState: this.data.daemonState,
      currentTaskId: running?.id ?? null,
      pendingCount: this.getByStatus('pending').length,
      completedCount: this.getByStatus('completed').length,
      failedCount: this.getByStatus('failed').length,
      totalCount: this.data.tasks.length,
      uptimeMs: this.daemonStartTime ? Date.now() - this.daemonStartTime : 0,
    };
  }

  /**
   * Build a summary string for injection into the system prompt.
   */
  getSummaryForPrompt(): string | null {
    if (this.data.tasks.length === 0) return null;

    const pending = this.getByStatus('pending');
    const running = this.getByStatus('running');
    const failed = this.getByStatus('failed');

    if (pending.length === 0 && running.length === 0 && failed.length === 0) return null;

    const lines: string[] = ['## Jarvis Task Queue'];

    if (running.length > 0) {
      lines.push(`\nRunning:`);
      for (const t of running) {
        lines.push(`- #${t.id}: ${t.title} [${t.priority}]`);
      }
    }

    if (pending.length > 0) {
      lines.push(`\nPending (${pending.length}):`);
      for (const t of pending.slice(0, 5)) {
        lines.push(`- #${t.id}: ${t.title} [${t.priority}]`);
      }
      if (pending.length > 5) lines.push(`  ... and ${pending.length - 5} more`);
    }

    if (failed.length > 0) {
      lines.push(`\nFailed (${failed.length}):`);
      for (const t of failed.slice(0, 3)) {
        lines.push(`- #${t.id}: ${t.title} — ${t.error || 'unknown error'}`);
      }
    }

    return lines.join('\n');
  }

  /** Short status line for the status bar */
  getStatusLine(): string {
    const pending = this.getByStatus('pending').length;
    const running = this.getByStatus('running').length;
    const completed = this.getByStatus('completed').length;
    const failed = this.getByStatus('failed').length;

    if (pending + running + completed + failed === 0) return '';

    const parts: string[] = [];
    if (running > 0) parts.push(`${running} running`);
    if (pending > 0) parts.push(`${pending} pending`);
    if (completed > 0) parts.push(`${completed} done`);
    if (failed > 0) parts.push(`${failed} failed`);
    return parts.join(', ');
  }

  /** Set or replace the onChange callback */
  setOnChange(handler: (event: string, task: JarvisTask) => void): void {
    this.onChange = handler;
  }
}
