/**
 * TaskOrchestrator — splits complex user requests into parallel sub-agents.
 * Uses heuristic pre-check + LLM decomposition + parallel execution groups.
 */
import type { SubTask, OrchestrationPlan, JarvisTaskPriority } from './types.js';
import type { ParallelExecutor } from './parallel.js';

// ─── Heuristic patterns ──────────────────────────────────────────────

/** Action verbs commonly found in coding requests */
const ACTION_VERBS = /\b(create|add|update|fix|remove|delete|refactor|rename|move|implement|write|change|modify|extract|install|configure|setup|test|migrate)\b/gi;

/** Keywords suggesting multiple tasks */
const MULTI_KEYWORDS = /\b(also|additionally|plus|then also|as well|furthermore|on top of that|while you're at it)\b/i;

/** Numbered step pattern */
const NUMBERED_STEPS = /(?:^|\n)\s*(?:\d+[\.\):]|[-*])\s+\S/gm;

/** File path pattern (Unix + Windows) */
const FILE_PATH = /(?:\.\/|\/|[a-zA-Z]:\\|\b(?:src|lib|test|app|components|pages|utils|config|public)\/)\S+\.\w{1,10}/g;

/** Keywords that imply the work is mostly sequential, not parallelizable */
const SEQUENTIAL_KEYWORDS = /\b(then|after|before|once|finally|first|second|third|zuerst|danach|anschließend)\b/i;

/** Keywords that explicitly invite parallel execution */
const PARALLEL_KEYWORDS = /\b(parallel|concurrent|concurrently|simultaneous|simultaneously|independent|separate workers|gleichzeitig|parallelisieren|unabhängig)\b/i;

/** Read-only prompts should stay on the cheap single-agent path */
const READ_ONLY_KEYWORDS = /\b(explain|describe|summarize|review|analyze|compare|how does|what does|why does|warum|wieso|wie funktioniert|erklär|beschreib|analysiere)\b/i;

/** Coordinated actions are a stronger signal than multiple verbs alone */
const COORDINATION_KEYWORDS = /\b(and|und|also|plus|as well|together with|along with)\b/i;

export interface OrchestrationHeuristic {
  shouldOrchestrate: boolean;
  score: number;
  estimatedTasks: number;
  reasons: string[];
  blockers: string[];
}

/**
 * Score whether a prompt is worth decomposing into swarm workers.
 * This stays heuristic-only: cheap, deterministic, and explainable.
 */
export function analyzeOrchestrationNeed(userMessage: string): OrchestrationHeuristic {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return {
      shouldOrchestrate: false,
      score: 0,
      estimatedTasks: 1,
      reasons: [],
      blockers: ['empty request'],
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const blockers: string[] = [];

  const verbs = trimmed.match(ACTION_VERBS) ?? [];
  const files = trimmed.match(FILE_PATH) ?? [];
  const steps = trimmed.match(NUMBERED_STEPS) ?? [];
  const sentences = trimmed
    .split(/[.;]\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  const actionSentences = sentences.filter(sentence => {
    ACTION_VERBS.lastIndex = 0;
    return ACTION_VERBS.test(sentence);
  });

  if (steps.length >= 2) {
    score += 3;
    reasons.push(`${steps.length} explicit steps`);
  }

  if (verbs.length >= 3) {
    score += 2;
    reasons.push(`${verbs.length} action verbs`);
  } else if (verbs.length >= 2) {
    score += 1;
    reasons.push('multiple actions');
  }

  if (verbs.length >= 2 && COORDINATION_KEYWORDS.test(trimmed)) {
    score += 2;
    reasons.push('coordinated actions');
  }

  if (MULTI_KEYWORDS.test(trimmed)) {
    score += 2;
    reasons.push('multi-task wording');
  }

  if (files.length >= 3) {
    score += 3;
    reasons.push(`${files.length} file targets`);
  } else if (files.length === 2) {
    score += 1;
    reasons.push('multiple file targets');
  }

  if (actionSentences.length >= 2) {
    score += 1;
    reasons.push('multiple action sentences');
  }

  if (PARALLEL_KEYWORDS.test(trimmed)) {
    score += 2;
    reasons.push('parallel hint');
  }

  if (READ_ONLY_KEYWORDS.test(trimmed) && verbs.length === 0) {
    score -= 3;
    blockers.push('read-only request');
  }

  if (SEQUENTIAL_KEYWORDS.test(trimmed) && steps.length < 2) {
    score -= 1;
    blockers.push('mostly sequential wording');
  }

  if (trimmed.includes('?') && verbs.length <= 1 && steps.length === 0) {
    score -= 2;
    blockers.push('question-shaped request');
  }

  if (verbs.length <= 1 && files.length <= 1 && steps.length === 0 && trimmed.length < 120) {
    score -= 2;
    blockers.push('small single-focus task');
  }

  const estimatedTasks = Math.max(
    1,
    Math.min(
      4,
      steps.length || files.length || (verbs.length >= 2 ? verbs.length : actionSentences.length || 1),
    ),
  );

  return {
    shouldOrchestrate: score >= 3,
    score,
    estimatedTasks,
    reasons,
    blockers,
  };
}

// ─── Orchestrator ────────────────────────────────────────────────────

export class TaskOrchestrator {
  private currentPlan: OrchestrationPlan | null = null;
  private aborted = false;
  private onChange?: (event: string, plan: OrchestrationPlan) => void;

  constructor(onChange?: (event: string, plan: OrchestrationPlan) => void) {
    this.onChange = onChange;
  }

  /**
   * Heuristic check — NO LLM call.
   * Returns true if the input looks like it contains multiple tasks.
   */
  shouldOrchestrate(userMessage: string): boolean {
    return analyzeOrchestrationNeed(userMessage).shouldOrchestrate;
  }

  analyze(userMessage: string): OrchestrationHeuristic {
    return analyzeOrchestrationNeed(userMessage);
  }

  /**
   * LLM call to decompose a message into sub-tasks with dependencies.
   */
  async createPlan(
    userMessage: string,
    sendMessage: (prompt: string) => Promise<string>,
  ): Promise<OrchestrationPlan> {
    const prompt = `You are a task decomposition engine. Split this user request into independent sub-tasks for parallel execution by coding agents.

For each sub-task provide:
- id (starting at 1)
- title (short imperative)
- description (what exactly to do)
- affectedFiles (predicted file paths that will be read/written)
- dependencies (array of sub-task IDs that must complete first, [] if none)
- priority ("high" | "medium" | "low")

Then group tasks that can run in parallel into groups. Tasks within a group run concurrently; groups execute sequentially.

If the request is a SINGLE simple task, return shouldOrchestrate: false.

Return ONLY valid JSON (no markdown, no explanation):
{
  "shouldOrchestrate": true/false,
  "reason": "why split or not",
  "subTasks": [...],
  "parallelGroups": [[1,2], [3]]
}

User request:
${userMessage}`;

    const raw = await sendMessage(prompt);
    const parsed = extractJSON(raw);

    const plan: OrchestrationPlan = {
      originalRequest: userMessage,
      subTasks: (Array.isArray(parsed.subTasks) ? parsed.subTasks : []).map((t: Record<string, unknown>, i: number) => ({
        id: (t.id as number) ?? i + 1,
        title: (t.title as string) ?? `Task ${i + 1}`,
        description: (t.description as string) ?? '',
        affectedFiles: Array.isArray(t.affectedFiles) ? t.affectedFiles as string[] : [],
        dependencies: Array.isArray(t.dependencies) ? t.dependencies as number[] : [],
        priority: validatePriority(t.priority as string),
        status: 'pending' as const,
      })),
      parallelGroups: Array.isArray(parsed.parallelGroups) ? parsed.parallelGroups : [],
      shouldOrchestrate: parsed.shouldOrchestrate === true,
      reason: (parsed.reason as string) ?? '',
    };

    // If no parallel groups provided, build from dependencies
    if (plan.shouldOrchestrate && plan.parallelGroups.length === 0) {
      plan.parallelGroups = buildParallelGroups(plan.subTasks);
    }

    this.currentPlan = plan;
    this.emitChange('plan_created', plan);
    return plan;
  }

  /**
   * Execute the plan by iterating over parallel groups.
   */
  async execute(
    plan: OrchestrationPlan,
    startWorker: (subTask: SubTask) => Promise<{ success: boolean; result: string }>,
    _parallelExecutor: ParallelExecutor,
  ): Promise<{ completed: number; failed: number; results: Map<number, string> }> {
    this.currentPlan = plan;
    this.aborted = false;
    const results = new Map<number, string>();
    let completed = 0;
    let failed = 0;

    for (const group of plan.parallelGroups) {
      if (this.aborted) break;

      const groupTasks = group
        .map(id => plan.subTasks.find(t => t.id === id))
        .filter((t): t is SubTask => t !== undefined);

      // Mark group as running
      for (const task of groupTasks) {
        task.status = 'running';
      }
      this.emitChange('group_started', plan);

      // Run group in parallel
      const settled = await Promise.allSettled(
        groupTasks.map(async task => {
          if (this.aborted) {
            task.status = 'failed';
            task.result = 'Aborted';
            return { id: task.id, success: false, result: 'Aborted' };
          }
          try {
            const res = await startWorker(task);
            task.status = res.success ? 'completed' : 'failed';
            task.result = res.result;
            return { id: task.id, ...res };
          } catch (err) {
            task.status = 'failed';
            task.result = err instanceof Error ? err.message : String(err);
            return { id: task.id, success: false, result: task.result };
          }
        }),
      );

      // Collect results
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          const { id, success, result } = outcome.value;
          results.set(id, result);
          if (success) completed++;
          else failed++;
        } else {
          failed++;
        }
      }

      this.emitChange('group_completed', plan);
    }

    this.emitChange('execution_done', plan);
    return { completed, failed, results };
  }

  /**
   * Get current execution status.
   */
  getStatus(): { active: number; completed: number; failed: number; total: number } | null {
    if (!this.currentPlan) return null;
    const tasks = this.currentPlan.subTasks;
    return {
      active: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      total: tasks.length,
    };
  }

  getCurrentPlan(): OrchestrationPlan | null {
    return this.currentPlan;
  }

  abortAll(): void {
    this.aborted = true;
    if (this.currentPlan) {
      for (const task of this.currentPlan.subTasks) {
        if (task.status === 'pending' || task.status === 'running') {
          task.status = 'failed';
          task.result = 'Aborted';
        }
      }
      this.emitChange('aborted', this.currentPlan);
    }
  }

  setOnChange(handler: (event: string, plan: OrchestrationPlan) => void): void {
    this.onChange = handler;
  }

  private emitChange(event: string, plan: OrchestrationPlan): void {
    this.onChange?.(event, plan);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract JSON from a string that may contain markdown code blocks.
 */
function extractJSON(raw: string): Record<string, unknown> {
  // Try direct parse first
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch { /* continue */ }

  // Try extracting from code block
  const codeBlock = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock[1].trim()) as Record<string, unknown>;
    } catch { /* continue */ }
  }

  // Try finding first { ... } block
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.slice(braceStart, braceEnd + 1)) as Record<string, unknown>;
    } catch { /* continue */ }
  }

  return { shouldOrchestrate: false, reason: 'Failed to parse LLM response', subTasks: [], parallelGroups: [] };
}

function validatePriority(value: unknown): JarvisTaskPriority {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

/**
 * Build parallel groups from sub-task dependencies using topological sort.
 */
function buildParallelGroups(subTasks: SubTask[]): number[][] {
  const groups: number[][] = [];
  const completed = new Set<number>();

  while (completed.size < subTasks.length) {
    const ready = subTasks
      .filter(t => !completed.has(t.id) && t.dependencies.every(d => completed.has(d)))
      .map(t => t.id);

    if (ready.length === 0) {
      // Remaining tasks have circular deps — just add them all
      const remaining = subTasks.filter(t => !completed.has(t.id)).map(t => t.id);
      groups.push(remaining);
      break;
    }

    groups.push(ready);
    for (const id of ready) completed.add(id);
  }

  return groups;
}
