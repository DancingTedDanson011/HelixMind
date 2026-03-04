/**
 * SwarmController — connects TaskOrchestrator + ParallelExecutor + SessionManager
 * to auto-decompose complex requests and execute them via parallel worker sessions.
 *
 * This is the single glue file that wires existing infrastructure together:
 * - TaskOrchestrator: heuristic detection + LLM decomposition (from jarvis/)
 * - ParallelExecutor: file locking + worker lifecycle (from jarvis/)
 * - SessionManager: background session spawning (from sessions/)
 * - Brain events: swarm_created/updated/completed push to web dashboard
 */
import { randomUUID } from 'node:crypto';
import type { TaskOrchestrator } from '../jarvis/orchestrator.js';
import type { ParallelExecutor } from '../jarvis/parallel.js';
import type { SessionManager } from '../sessions/manager.js';
import type { Session } from '../sessions/session.js';
import type { LLMProvider } from '../providers/types.js';
import type { PermissionManager } from './permissions.js';
import type { CheckpointStore } from '../checkpoints/store.js';
import type { ActivityIndicator } from '../ui/activity.js';
import { resolveAgentIdentity, type AgentIdentity } from './plan-types.js';
import type { SubTask, OrchestrationPlan } from '../jarvis/types.js';
import type { SwarmInfo, SwarmSubTaskInfo } from '@helixmind/protocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwarmOptions {
  provider: LLMProvider;
  project: any;
  spiralEngine: any;
  config: any;
  permissions: PermissionManager;
  checkpointStore: CheckpointStore;
  onTokens: (input: number, output: number) => void;
  onToolCall: () => void;
  /** Called when swarm status changes (for statusbar) */
  onStatusChange?: (active: number, total: number) => void;
  /** Assembler + agent runner injected from chat.ts */
  runWorkerSession: (
    session: Session,
    prompt: string,
    agentIdentity: AgentIdentity,
  ) => Promise<{ text: string; errors: string[] }>;
  /** LLM message sender for orchestrator plan decomposition */
  sendPlanMessage: (prompt: string) => Promise<string>;
  /** Push swarm events to brain server */
  pushSwarmCreated?: (swarm: SwarmInfo) => void;
  pushSwarmUpdated?: (swarm: SwarmInfo) => void;
  pushSwarmCompleted?: (swarm: SwarmInfo) => void;
  /** Push worker events to brain server */
  pushWorkerStarted?: (worker: { workerId: number; taskId: number; taskTitle: string; status: 'running'; startedAt: number }) => void;
  pushWorkerCompleted?: (worker: { workerId: number; taskId: number; taskTitle: string; status: 'completed' | 'failed'; startedAt: number; completedAt: number }) => void;
}

// ---------------------------------------------------------------------------
// SwarmController
// ---------------------------------------------------------------------------

export class SwarmController {
  private orchestrator: TaskOrchestrator;
  private executor: ParallelExecutor;
  private sessionMgr: SessionManager;
  private opts: SwarmOptions;
  private swarmInfo: SwarmInfo | null = null;
  private aborted = false;
  private workerSessions: Map<number, Session> = new Map();

  constructor(
    orchestrator: TaskOrchestrator,
    executor: ParallelExecutor,
    sessionMgr: SessionManager,
    opts: SwarmOptions,
  ) {
    this.orchestrator = orchestrator;
    this.executor = executor;
    this.sessionMgr = sessionMgr;
    this.opts = opts;
  }

  /** Heuristic check — delegates to orchestrator (NO LLM call) */
  shouldSwarm(userMessage: string): boolean {
    return this.orchestrator.shouldOrchestrate(userMessage);
  }

  /** Get current swarm status */
  getStatus(): SwarmInfo | null {
    return this.swarmInfo;
  }

  /** Abort all workers and mark swarm as aborted */
  abort(): void {
    this.aborted = true;
    this.orchestrator.abortAll();
    this.executor.abortAll();

    // Abort all worker sessions
    for (const session of this.workerSessions.values()) {
      session.abort();
    }

    if (this.swarmInfo) {
      this.swarmInfo.status = 'aborted';
      this.swarmInfo.completedAt = Date.now();
      for (const task of this.swarmInfo.subTasks) {
        if (task.status === 'pending' || task.status === 'running') {
          task.status = 'failed';
          task.result = 'Aborted';
          task.completedAt = Date.now();
        }
      }
      this.opts.pushSwarmCompleted?.(this.swarmInfo);
    }
  }

  /**
   * Main entry point: decompose → execute in parallel → return summary.
   * Returns empty string '' if the request is too simple for swarm.
   */
  async run(userMessage: string): Promise<string> {
    this.aborted = false;

    // Phase 1: LLM decomposition
    this.swarmInfo = this.buildInitialSwarmInfo(userMessage);
    this.swarmInfo.status = 'planning';
    this.opts.pushSwarmCreated?.(this.swarmInfo);

    let plan: OrchestrationPlan;
    try {
      plan = await this.orchestrator.createPlan(userMessage, this.opts.sendPlanMessage);
    } catch (err) {
      this.swarmInfo.status = 'failed';
      this.swarmInfo.reason = err instanceof Error ? err.message : String(err);
      this.swarmInfo.completedAt = Date.now();
      this.opts.pushSwarmCompleted?.(this.swarmInfo);
      return '';
    }

    // If LLM says no orchestration needed or only 1 task, bail to normal flow
    if (!plan.shouldOrchestrate || plan.subTasks.length <= 1) {
      this.swarmInfo.status = 'completed';
      this.swarmInfo.reason = plan.reason || 'Single task — normal flow';
      this.swarmInfo.completedAt = Date.now();
      this.opts.pushSwarmCompleted?.(this.swarmInfo);
      return '';
    }

    // Phase 2: Build SwarmInfo from plan
    this.swarmInfo.status = 'executing';
    this.swarmInfo.reason = plan.reason;
    this.swarmInfo.subTasks = plan.subTasks.map(t => this.toSwarmSubTask(t));
    this.swarmInfo.parallelGroups = plan.parallelGroups;
    this.opts.pushSwarmUpdated?.(this.swarmInfo);
    this.opts.onStatusChange?.(0, plan.subTasks.length);

    // Phase 3: Execute via orchestrator (iterates parallel groups)
    const spawnWorker = async (subTask: SubTask): Promise<{ success: boolean; result: string }> => {
      return this.spawnWorker(subTask);
    };

    const { completed, failed } = await this.orchestrator.execute(plan, spawnWorker, this.executor);

    // Phase 4: Finalize
    this.swarmInfo.totalCompleted = completed;
    this.swarmInfo.totalFailed = failed;
    this.swarmInfo.status = failed > 0 && completed === 0 ? 'failed' : 'completed';
    this.swarmInfo.completedAt = Date.now();

    // Sync final task statuses from plan
    for (const subTask of plan.subTasks) {
      const swarmTask = this.swarmInfo.subTasks.find(t => t.id === subTask.id);
      if (swarmTask) {
        swarmTask.status = subTask.status === 'completed' ? 'completed' : subTask.status === 'failed' ? 'failed' : swarmTask.status;
        swarmTask.result = subTask.result;
      }
    }

    this.opts.pushSwarmCompleted?.(this.swarmInfo);
    this.opts.onStatusChange?.(0, 0);

    // Build summary
    return this.buildSummary(plan);
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async spawnWorker(subTask: SubTask): Promise<{ success: boolean; result: string }> {
    if (this.aborted) {
      return { success: false, result: 'Aborted' };
    }

    const workerName = `Worker-${subTask.id}`;
    const session = this.sessionMgr.create(workerName, '\u{1F41D}', []);
    session.swarmId = this.swarmInfo!.id;
    session.swarmTaskId = subTask.id;
    this.workerSessions.set(subTask.id, session);

    // Update swarm info
    const swarmTask = this.swarmInfo!.subTasks.find(t => t.id === subTask.id);
    if (swarmTask) {
      swarmTask.status = 'running';
      swarmTask.sessionId = session.id;
      swarmTask.startedAt = Date.now();
    }
    this.opts.pushSwarmUpdated?.(this.swarmInfo!);

    // Push worker started event
    const workerInfo = {
      workerId: subTask.id,
      taskId: subTask.id,
      taskTitle: subTask.title,
      status: 'running' as const,
      startedAt: Date.now(),
    };
    this.opts.pushWorkerStarted?.(workerInfo);

    // Update statusbar
    const running = this.swarmInfo!.subTasks.filter(t => t.status === 'running').length;
    this.opts.onStatusChange?.(running, this.swarmInfo!.subTasks.length);

    // Resolve agent identity for colored output
    const agentIdentity = resolveAgentIdentity(workerName) ?? {
      name: `@${workerName.toLowerCase()}`,
      displayName: workerName,
      color: '#ffd700',
      icon: '\u{1F41D}',
    };

    // Build focused worker prompt
    const workerPrompt = this.buildWorkerMessage(subTask);

    session.start();

    try {
      const { text, errors } = await this.opts.runWorkerSession(session, workerPrompt, agentIdentity);
      const success = errors.length === 0;

      session.complete({
        text: text.slice(0, 2000),
        steps: [],
        errors,
        durationMs: session.elapsed,
      });

      // Update swarm task
      if (swarmTask) {
        swarmTask.status = success ? 'completed' : 'failed';
        swarmTask.completedAt = Date.now();
        swarmTask.result = text.slice(0, 500);
      }
      this.opts.pushSwarmUpdated?.(this.swarmInfo!);

      // Push worker completed event
      this.opts.pushWorkerCompleted?.({
        workerId: subTask.id,
        taskId: subTask.id,
        taskTitle: subTask.title,
        status: success ? 'completed' : 'failed',
        startedAt: workerInfo.startedAt,
        completedAt: Date.now(),
      });

      // Update statusbar
      const nowRunning = this.swarmInfo!.subTasks.filter(t => t.status === 'running').length;
      this.opts.onStatusChange?.(nowRunning, this.swarmInfo!.subTasks.length);

      this.sessionMgr.complete(session.id, session.result!);
      this.workerSessions.delete(subTask.id);

      return { success, result: text };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      session.complete({
        text: errorMsg,
        steps: [],
        errors: [errorMsg],
        durationMs: session.elapsed,
      });

      if (swarmTask) {
        swarmTask.status = 'failed';
        swarmTask.completedAt = Date.now();
        swarmTask.result = errorMsg;
      }
      this.opts.pushSwarmUpdated?.(this.swarmInfo!);

      this.opts.pushWorkerCompleted?.({
        workerId: subTask.id,
        taskId: subTask.id,
        taskTitle: subTask.title,
        status: 'failed',
        startedAt: workerInfo.startedAt,
        completedAt: Date.now(),
      });

      this.sessionMgr.complete(session.id, session.result!);
      this.workerSessions.delete(subTask.id);

      return { success: false, result: errorMsg };
    }
  }

  private buildWorkerMessage(subTask: SubTask): string {
    const files = subTask.affectedFiles.length > 0
      ? `\nTarget files: ${subTask.affectedFiles.join(', ')}`
      : '';
    return `You are Worker-${subTask.id}, a focused coding agent.

YOUR TASK: ${subTask.title}

DESCRIPTION: ${subTask.description}${files}

IMPORTANT:
- Focus ONLY on this specific task. Do not do anything else.
- If a file is locked by another agent, skip it and note that in your response.
- Be concise in your responses. Complete the task and report what you did.`;
  }

  private buildInitialSwarmInfo(userMessage: string): SwarmInfo {
    return {
      id: randomUUID(),
      originalRequest: userMessage.slice(0, 500),
      status: 'idle',
      reason: '',
      subTasks: [],
      parallelGroups: [],
      startedAt: Date.now(),
      totalCompleted: 0,
      totalFailed: 0,
    };
  }

  private toSwarmSubTask(subTask: SubTask): SwarmSubTaskInfo {
    return {
      id: subTask.id,
      title: subTask.title,
      description: subTask.description,
      affectedFiles: subTask.affectedFiles,
      dependencies: subTask.dependencies,
      status: subTask.status === 'completed' ? 'completed' : subTask.status === 'failed' ? 'failed' : subTask.status === 'running' ? 'running' : 'pending',
    };
  }

  private buildSummary(plan: OrchestrationPlan): string {
    const completed = plan.subTasks.filter(t => t.status === 'completed');
    const failed = plan.subTasks.filter(t => t.status === 'failed');

    let summary = `\u{1F41D} **Swarm Complete** — ${completed.length}/${plan.subTasks.length} tasks succeeded`;
    if (failed.length > 0) {
      summary += `, ${failed.length} failed`;
    }
    summary += '\n\n';

    for (const task of plan.subTasks) {
      const icon = task.status === 'completed' ? '\u2705' : '\u274C';
      const result = task.result ? `: ${task.result.slice(0, 200)}` : '';
      summary += `${icon} **${task.title}**${result}\n`;
    }

    return summary;
  }
}
