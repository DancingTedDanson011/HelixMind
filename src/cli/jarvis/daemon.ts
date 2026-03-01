/**
 * Jarvis Daemon — persistent autonomous AGI task executor.
 * Picks tasks from the queue and executes them using the agent loop.
 * When idle, runs the Thinking Loop (Quick/Medium/Deep).
 * Integrates Ethics, Identity, Proposals, Autonomy, and Parallel Execution.
 */
import chalk from 'chalk';
import { renderInfo } from '../ui/chat-view.js';
import type { JarvisQueue } from './queue.js';
import type { JarvisTask, ThinkingCallbacks } from './types.js';
import { assertCanExecute } from './core-ethics.js';
import { runThinkingLoop } from './thinking-loop.js';

export interface JarvisDaemonCallbacks {
  sendMessage: (prompt: string) => Promise<string>;
  isAborted: () => boolean;
  isPaused: () => boolean;
  onTaskStart: (task: JarvisTask) => void;
  onTaskComplete: (task: JarvisTask, result: string) => void;
  onTaskFailed: (task: JarvisTask, error: string) => void;
  updateStatus: () => void;
  storeInSpiral?: (content: string, type: string, tags: string[]) => Promise<void>;
  querySpiral?: (query: string, limit?: number) => Promise<string[]>;
  getIdentityPrompt?: () => string;
  getEthicsPrompt?: () => string;
  getProposalsSummary?: () => string;
  getIdentityName?: () => string;
  getUserGoals?: () => string[];
  /** Thinking loop callbacks — when provided, enables AGI thinking between tasks */
  thinkingCallbacks?: Partial<ThinkingCallbacks>;
}

function buildTaskPrompt(
  task: JarvisTask,
  identityPrompt?: string,
  ethicsPrompt?: string,
  identityName?: string,
  userGoals?: string[],
): string {
  const name = identityName || 'JARVIS';
  const sections = [
    `You are ${name} — HelixMind's autonomous AGI task executor.`,
  ];

  if (identityPrompt) sections.push(identityPrompt);
  if (ethicsPrompt) sections.push(ethicsPrompt);
  if (userGoals && userGoals.length > 0) {
    sections.push(`User Goals:\n${userGoals.map(g => `- ${g}`).join('\n')}`);
  }

  sections.push(`TASK #${task.id}: ${task.title}
${task.description}

RULES:
- Focus exclusively on this task
- Work methodically — break into subtasks if needed
- Use all available tools (read_file, write_file, edit_file, run_command, git_status, etc.)
- End with a single-line summary starting with "DONE:" describing what you accomplished
- If you cannot complete the task, explain why and respond with: TASK_FAILED: <reason>`);

  return sections.join('\n\n');
}

function buildRetryPrompt(task: JarvisTask, identityName?: string): string {
  const name = identityName || 'JARVIS';
  return `You are ${name}. Retrying TASK #${task.id}: ${task.title}

Previous attempt failed with: ${task.error || 'unknown error'}

Analyze the failure, try a different approach, and complete the task.
End with "DONE:" or "TASK_FAILED:" as appropriate.`;
}

function extractResult(text: string): { success: boolean; summary: string } {
  // Check for failure marker
  const failMatch = text.match(/TASK_FAILED:\s*(.+)/i);
  if (failMatch) {
    const reason = failMatch[1].trim();
    return { success: false, summary: reason.length > 200 ? reason.slice(0, 197) + '...' : reason };
  }

  // Check for success marker
  const doneMatch = text.match(/DONE:\s*(.+)/i);
  if (doneMatch) {
    const s = doneMatch[1].trim();
    return { success: true, summary: s.length > 200 ? s.slice(0, 197) + '...' : s };
  }

  // Fallback: last non-empty line — treat as success
  const lines = text.trim().split('\n').filter(l => l.trim());
  const last = lines[lines.length - 1]?.trim() || text.slice(0, 100);
  return { success: true, summary: last.length > 200 ? last.slice(0, 197) + '...' : last };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runJarvisDaemon(
  queue: JarvisQueue,
  callbacks: JarvisDaemonCallbacks,
): Promise<number> {
  let completedCount = 0;

  const d = chalk.dim;
  const j = chalk.hex('#ff00ff');
  const g = chalk.hex('#FFB800');

  const identityName = callbacks.getIdentityName?.() || 'JARVIS';
  const displayName = identityName.toUpperCase() + ' AGI';
  const namePad = Math.max(0, 34 - displayName.length);

  process.stdout.write('\n');
  process.stdout.write(d('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(d('\u2502  ') + g('\u{1F31F}') + ' ' + j(displayName) + d(' '.repeat(namePad) + '\u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'Autonomous agent — thinking, learning,' + d('     \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'proposing, executing tasks' + d('                 \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + d('/jarvis stop or ESC to stop') + d('             \u2502') + '\n');
  process.stdout.write(d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');

  queue.setDaemonState('running');
  callbacks.updateStatus();

  // Check if thinking callbacks are available for AGI mode
  const hasThinking = !!callbacks.thinkingCallbacks;

  while (!callbacks.isAborted()) {
    // Handle pause
    if (callbacks.isPaused()) {
      await sleep(2000);
      continue;
    }

    const task = queue.getNextTask();

    if (!task) {
      // No task available — run thinking loop if available, else idle
      if (hasThinking) {
        try {
          await runThinkingLoop(
            callbacks.thinkingCallbacks as ThinkingCallbacks,
            () => !!queue.getNextTask(),
          );
        } catch {
          // Thinking loop error — fall back to simple idle
          await sleep(30_000);
        }
      } else {
        await sleep(30_000);
      }
      continue;
    }

    // Start task
    queue.updateTask(task.id, { status: 'running', startedAt: Date.now() });
    callbacks.onTaskStart(task);
    callbacks.updateStatus();

    process.stdout.write(chalk.dim(`  \u2500\u2500 Task #${task.id}: `) + chalk.white(task.title) + chalk.dim(' \u2500'.repeat(10)) + '\n');

    try {
      // Ethics check before task execution
      try {
        assertCanExecute({
          action: 'execute_task',
          toolName: 'agent_loop',
          target: task.title,
          autonomyLevel: 2,
          recentActions: [],
        });
      } catch (ethicsErr) {
        // Ethics violation — fail the task
        queue.updateTask(task.id, {
          status: 'failed',
          error: `Ethics violation: ${ethicsErr instanceof Error ? ethicsErr.message : String(ethicsErr)}`,
        });
        callbacks.onTaskFailed(task, 'Ethics violation');
        callbacks.updateStatus();
        continue;
      }

      const identityPrompt = callbacks.getIdentityPrompt?.();
      const ethicsPrompt = callbacks.getEthicsPrompt?.();
      const iName = callbacks.getIdentityName?.();
      const uGoals = callbacks.getUserGoals?.();
      const prompt = task.retries > 0
        ? buildRetryPrompt(task, iName)
        : buildTaskPrompt(task, identityPrompt, ethicsPrompt, iName, uGoals);

      const resultText = await callbacks.sendMessage(prompt);

      if (callbacks.isAborted()) break;

      const { success, summary } = extractResult(resultText);

      if (success) {
        queue.updateTask(task.id, {
          status: 'completed',
          completedAt: Date.now(),
          result: summary,
        });
        completedCount++;
        callbacks.onTaskComplete(task, summary);
        renderInfo(chalk.green(`  \u2713 Task #${task.id}: ${summary}`));

        // Store result in spiral memory
        if (callbacks.storeInSpiral) {
          try {
            await callbacks.storeInSpiral(
              `Jarvis Task #${task.id} completed: ${task.title}\n${summary}`,
              'pattern',
              ['jarvis', 'task_result', ...(task.tags || [])],
            );
          } catch {
            // Non-critical — don't fail the task
          }
        }
      } else {
        // Task reported failure
        const newRetries = task.retries + 1;
        if (newRetries < task.maxRetries) {
          queue.updateTask(task.id, {
            status: 'pending',
            retries: newRetries,
            error: summary,
          });
          renderInfo(chalk.yellow(`  \u21BB Task #${task.id} failed, will retry (${newRetries}/${task.maxRetries}): ${summary}`));
        } else {
          queue.updateTask(task.id, {
            status: 'failed',
            retries: newRetries,
            error: summary,
          });
          callbacks.onTaskFailed(task, summary);
          renderInfo(chalk.red(`  \u2717 Task #${task.id} failed permanently: ${summary}`));
        }
      }
    } catch (err) {
      if (callbacks.isAborted()) break;

      const errorMsg = err instanceof Error ? err.message : String(err);
      const newRetries = task.retries + 1;

      if (newRetries < task.maxRetries) {
        queue.updateTask(task.id, {
          status: 'pending',
          retries: newRetries,
          error: errorMsg,
        });
        renderInfo(chalk.yellow(`  \u21BB Task #${task.id} error, will retry: ${errorMsg}`));
      } else {
        queue.updateTask(task.id, {
          status: 'failed',
          retries: newRetries,
          error: errorMsg,
        });
        callbacks.onTaskFailed(task, errorMsg);
        renderInfo(chalk.red(`  \u2717 Task #${task.id} error: ${errorMsg}`));
      }
    }

    callbacks.updateStatus();
  }

  queue.setDaemonState('stopped');
  callbacks.updateStatus();

  if (callbacks.isAborted()) {
    process.stdout.write('\n');
    renderInfo(chalk.yellow(`  \u23F9 Jarvis stopped after ${completedCount} tasks.`));
    process.stdout.write('\n');
  }

  return completedCount;
}
