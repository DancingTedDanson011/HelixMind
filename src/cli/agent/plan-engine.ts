/**
 * Plan Engine — core plan lifecycle management.
 *
 * Creates, approves, rejects, modifies, and tracks execution of plans.
 * Plans can originate from user plan mode, Jarvis proposals, or auto-complex tasks.
 */
import { randomUUID } from 'node:crypto';
import type {
  ExecutionPlan,
  PlanStep,
  PlanStatus,
  PlanStepStatus,
} from './plan-types.js';

/** Raw plan structure as returned by the LLM */
export interface LLMPlanResponse {
  title: string;
  description: string;
  steps: Array<{
    title: string;
    description: string;
    tools?: string[];
    affectedFiles?: string[];
    dependencies?: number[];
  }>;
}

export class PlanEngine {
  private plans = new Map<string, ExecutionPlan>();
  private _activePlanId: string | null = null;
  private onChange?: (event: string, plan: ExecutionPlan) => void;

  constructor(onChange?: (event: string, plan: ExecutionPlan) => void) {
    this.onChange = onChange;
  }

  /** Set the change callback (for pushing events to Brain/Web) */
  setOnChange(handler: (event: string, plan: ExecutionPlan) => void): void {
    this.onChange = handler;
  }

  /**
   * Create a plan from an LLM-generated response (parsed JSON).
   */
  createFromLLMResponse(
    parsed: LLMPlanResponse,
    source: ExecutionPlan['source'] = 'user_plan_mode',
  ): ExecutionPlan {
    const steps: PlanStep[] = parsed.steps.map((s, idx) => ({
      id: idx,
      title: s.title,
      description: s.description,
      tools: s.tools ?? [],
      affectedFiles: s.affectedFiles ?? [],
      dependencies: s.dependencies ?? [],
      status: 'pending' as PlanStepStatus,
    }));

    const plan: ExecutionPlan = {
      id: randomUUID(),
      title: parsed.title,
      description: parsed.description,
      steps,
      status: 'pending_approval',
      source,
      createdAt: Date.now(),
      totalStepsCompleted: 0,
      totalStepsFailed: 0,
    };

    this.plans.set(plan.id, plan);
    this.onChange?.('plan_created', plan);
    return plan;
  }

  /**
   * Parse an LLM text response to extract a JSON plan.
   * Looks for ```json ... ``` blocks containing the plan structure.
   */
  parseLLMPlan(llmText: string): LLMPlanResponse | null {
    // Extract JSON from code blocks
    const jsonMatch = llmText.match(/```json\s*\n([\s\S]*?)\n\s*```/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (!parsed.title || !Array.isArray(parsed.steps)) return null;
      return parsed as LLMPlanResponse;
    } catch {
      return null;
    }
  }

  /**
   * Create a plan from a Jarvis ProposalEntry.
   */
  createFromProposal(proposal: {
    id: number;
    title: string;
    description: string;
    affectedFiles: string[];
    steps?: Array<{
      title: string;
      description: string;
      affectedFiles: string[];
      dependencies: number[];
    }>;
  }): ExecutionPlan {
    const steps: PlanStep[] = proposal.steps
      ? proposal.steps.map((s, idx) => ({
          id: idx,
          title: s.title,
          description: s.description,
          tools: [],
          affectedFiles: s.affectedFiles,
          dependencies: s.dependencies,
          status: 'pending' as PlanStepStatus,
        }))
      : [{
          id: 0,
          title: proposal.title,
          description: proposal.description,
          tools: [],
          affectedFiles: proposal.affectedFiles,
          dependencies: [],
          status: 'pending' as PlanStepStatus,
        }];

    const plan: ExecutionPlan = {
      id: randomUUID(),
      title: proposal.title,
      description: proposal.description,
      steps,
      status: 'pending_approval',
      source: 'jarvis_proposal',
      createdAt: Date.now(),
      totalStepsCompleted: 0,
      totalStepsFailed: 0,
      proposalId: proposal.id,
    };

    this.plans.set(plan.id, plan);
    this.onChange?.('plan_created', plan);
    return plan;
  }

  /** Approve a plan — marks it ready for execution */
  approve(planId: string): ExecutionPlan | undefined {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== 'pending_approval') return undefined;

    plan.status = 'approved';
    plan.approvedAt = Date.now();
    this._activePlanId = planId;
    this.onChange?.('plan_approved', plan);
    return plan;
  }

  /** Reject a plan with a reason */
  reject(planId: string, reason: string): ExecutionPlan | undefined {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== 'pending_approval') return undefined;

    plan.status = 'rejected';
    plan.rejectionReason = reason;
    if (this._activePlanId === planId) this._activePlanId = null;
    this.onChange?.('plan_rejected', plan);
    return plan;
  }

  /** Modify a specific step in a pending plan */
  modifyStep(planId: string, stepId: number, changes: Partial<PlanStep>): boolean {
    const plan = this.plans.get(planId);
    if (!plan || (plan.status !== 'pending_approval' && plan.status !== 'modified')) return false;

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return false;

    Object.assign(step, changes);
    plan.status = 'modified';
    this.onChange?.('plan_modified', plan);
    return true;
  }

  /** Mark a plan as executing */
  startExecution(planId: string): ExecutionPlan | undefined {
    const plan = this.plans.get(planId);
    if (!plan || (plan.status !== 'approved' && plan.status !== 'modified')) return undefined;

    plan.status = 'executing';
    this._activePlanId = planId;
    this.onChange?.('plan_executing', plan);
    return plan;
  }

  /** Get the next step that is ready to execute (all dependencies met) */
  getNextStep(planId: string): PlanStep | undefined {
    const plan = this.plans.get(planId);
    if (!plan) return undefined;

    for (const step of plan.steps) {
      if (step.status !== 'pending') continue;

      // Check all dependencies are completed
      const depsOk = step.dependencies.every(depId => {
        const dep = plan.steps.find(s => s.id === depId);
        return dep && dep.status === 'done';
      });

      if (depsOk) return step;
    }
    return undefined;
  }

  /** Mark a step as running */
  startStep(planId: string, stepId: number): void {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'running';
    step.startedAt = Date.now();
    this.onChange?.('plan_step_started', plan);
  }

  /** Mark a step as completed */
  completeStep(planId: string, stepId: number, result: string): void {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'done';
    step.result = result;
    step.completedAt = Date.now();
    plan.totalStepsCompleted++;

    // Check if plan is complete
    const allDone = plan.steps.every(s => s.status === 'done' || s.status === 'skipped');
    if (allDone) {
      plan.status = 'completed';
      plan.completedAt = Date.now();
      if (this._activePlanId === planId) this._activePlanId = null;
    }

    this.onChange?.('plan_step_completed', plan);
  }

  /** Mark a step as failed */
  failStep(planId: string, stepId: number, error: string): void {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'error';
    step.error = error;
    step.completedAt = Date.now();
    plan.totalStepsFailed++;

    // Mark plan as failed if a step fails
    plan.status = 'failed';
    plan.completedAt = Date.now();
    if (this._activePlanId === planId) this._activePlanId = null;

    this.onChange?.('plan_step_failed', plan);
  }

  /** Get the currently active plan */
  getActive(): ExecutionPlan | undefined {
    if (!this._activePlanId) return undefined;
    return this.plans.get(this._activePlanId);
  }

  /** Get a plan by ID */
  get(planId: string): ExecutionPlan | undefined {
    return this.plans.get(planId);
  }

  /** Get all plans */
  getAll(): ExecutionPlan[] {
    return [...this.plans.values()];
  }

  /** Clear completed/rejected plans from memory */
  pruneOld(): void {
    for (const [id, plan] of this.plans) {
      if (plan.status === 'completed' || plan.status === 'rejected' || plan.status === 'failed') {
        if (Date.now() - (plan.completedAt ?? plan.createdAt) > 60 * 60 * 1000) {
          this.plans.delete(id);
        }
      }
    }
  }
}
