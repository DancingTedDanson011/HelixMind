/**
 * Plan Executor — runs an approved plan step-by-step via the agent loop.
 *
 * Each step gets its own agent loop iteration with a focused prompt.
 * History is shared between steps to maintain context.
 */
import type { ToolMessage } from '../providers/types.js';
import type { AgentLoopOptions, AgentLoopResult } from './loop.js';
import { runAgentLoop, AgentAbortError } from './loop.js';
import type { AgentController } from './loop.js';
import type { ExecutionPlan, PlanStep } from './plan-types.js';
import type { PlanEngine } from './plan-engine.js';

export interface PlanExecutorCallbacks {
  onPlanStepStart?: (step: PlanStep, idx: number, total: number) => void;
  onPlanStepEnd?: (step: PlanStep, status: 'done' | 'error') => void;
  onPlanComplete?: (plan: ExecutionPlan) => void;
}

/**
 * Execute an approved plan step-by-step.
 *
 * For each step:
 * 1. Fire onPlanStepStart callback
 * 2. Build a focused prompt for just that step
 * 3. Run the agent loop (with full tool access)
 * 4. Mark step complete/failed in the engine
 * 5. Fire onPlanStepEnd callback
 *
 * History carries across steps so the LLM maintains full context.
 */
export async function executePlan(opts: {
  plan: ExecutionPlan;
  planEngine: PlanEngine;
  agentLoopOptions: Omit<AgentLoopOptions, 'planMode'>;
  controller: AgentController;
  conversationHistory: ToolMessage[];
  callbacks?: PlanExecutorCallbacks;
}): Promise<AgentLoopResult> {
  const { plan, planEngine, agentLoopOptions, controller, callbacks } = opts;
  let history = [...opts.conversationHistory];

  planEngine.startExecution(plan.id);

  let totalToolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allSteps: import('../ui/activity.js').TaskStep[] = [];
  const allErrors: string[] = [];
  let lastText = '';

  const totalSteps = plan.steps.length;

  while (true) {
    const step = planEngine.getNextStep(plan.id);
    if (!step) break;

    // Check abort
    if (controller.isAborted) {
      throw new AgentAbortError();
    }

    const stepIdx = plan.steps.indexOf(step);
    callbacks?.onPlanStepStart?.(step, stepIdx + 1, totalSteps);
    planEngine.startStep(plan.id, step.id);

    // Build a focused prompt for this step
    const stepPrompt = buildStepPrompt(step, stepIdx + 1, totalSteps, plan);

    try {
      const result = await runAgentLoop(stepPrompt, history, {
        ...agentLoopOptions,
        planMode: false, // Full tool access during execution
        maxIterations: 50,
      }, controller);

      // Adopt updated history for next step
      history = result.updatedHistory;

      // Accumulate results
      totalToolCalls += result.toolCalls;
      totalInputTokens += result.tokensUsed.input;
      totalOutputTokens += result.tokensUsed.output;
      allSteps.push(...result.steps);
      allErrors.push(...result.errors);
      lastText = result.text;

      if (result.errors.length > 0 && result.steps.some(s => s.status === 'error')) {
        planEngine.failStep(plan.id, step.id, result.errors.join('; '));
        callbacks?.onPlanStepEnd?.(step, 'error');
        break; // Stop on first failure
      } else {
        planEngine.completeStep(plan.id, step.id, result.text.slice(0, 200));
        callbacks?.onPlanStepEnd?.(step, 'done');
      }
    } catch (err) {
      if (err instanceof AgentAbortError) {
        planEngine.failStep(plan.id, step.id, 'Aborted by user');
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      planEngine.failStep(plan.id, step.id, errMsg);
      callbacks?.onPlanStepEnd?.(step, 'error');
      allErrors.push(errMsg);
      break;
    }
  }

  // Check if plan completed
  const updatedPlan = planEngine.get(plan.id)!;
  if (updatedPlan.status === 'completed') {
    callbacks?.onPlanComplete?.(updatedPlan);
  }

  return {
    text: lastText,
    toolCalls: totalToolCalls,
    tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
    aborted: false,
    steps: allSteps,
    errors: allErrors,
    updatedHistory: history,
  };
}

/** Build a focused execution prompt for a single plan step */
function buildStepPrompt(step: PlanStep, stepNum: number, totalSteps: number, plan: ExecutionPlan): string {
  const lines: string[] = [];
  lines.push(`Execute step ${stepNum} of ${totalSteps} in plan "${plan.title}":`);
  lines.push('');
  lines.push(`## Step: ${step.title}`);
  lines.push(step.description);

  if (step.affectedFiles.length > 0) {
    lines.push('');
    lines.push(`Target files: ${step.affectedFiles.join(', ')}`);
  }

  lines.push('');
  lines.push('Complete this step fully, then stop. Do not proceed to subsequent steps.');

  return lines.join('\n');
}
