/**
 * Plan Display — terminal UI components for plan review, approval, and progress.
 *
 * Uses existing ANSI primitives (selectMenu, chalk, box drawing characters).
 * No Ink/Clack — stays consistent with the existing UI approach.
 */
import chalk from 'chalk';
import type { ExecutionPlan, PlanStep } from '../agent/plan-types.js';
import { selectMenu, type MenuItem } from './select-menu.js';
import { renderAgentTag } from './agent-display.js';
import { AGENT_IDENTITIES } from '../agent/plan-types.js';

// ---------------------------------------------------------------------------
// Plan Review — shows the full plan in a bordered box
// ---------------------------------------------------------------------------

/**
 * Render a plan for review in the terminal.
 * Shows title, description, and all steps with their tools/files.
 */
export function renderPlanReview(plan: ExecutionPlan): void {
  const termWidth = Math.max(60, (process.stdout.columns || 80) - 4);
  const titleLine = ` Plan: ${plan.title} `;
  const topBorder = '\u250C\u2500' + titleLine + '\u2500'.repeat(Math.max(0, termWidth - titleLine.length - 3));

  process.stdout.write('\n');
  process.stdout.write(`  ${chalk.cyan(topBorder)}\n`);
  process.stdout.write(`  ${chalk.cyan('\u2502')}\n`);

  // Description
  if (plan.description) {
    const descLines = wrapText(plan.description, termWidth - 6);
    for (const line of descLines) {
      process.stdout.write(`  ${chalk.cyan('\u2502')}  ${chalk.dim(line)}\n`);
    }
    process.stdout.write(`  ${chalk.cyan('\u2502')}\n`);
  }

  // Steps
  process.stdout.write(`  ${chalk.cyan('\u2502')}  ${chalk.bold('Steps:')}\n`);

  for (const step of plan.steps) {
    const statusIcon = getStepIcon(step.status);
    const stepNum = step.id + 1;
    const toolHint = step.tools.length > 0
      ? chalk.dim(` [${step.tools.join(', ')}]`)
      : '';

    process.stdout.write(`  ${chalk.cyan('\u2502')}  ${statusIcon} ${chalk.bold(`${stepNum}.`)} ${step.title}${toolHint}\n`);

    // Show affected files
    if (step.affectedFiles.length > 0) {
      const fileStr = step.affectedFiles.map(f => chalk.dim(f)).join(', ');
      process.stdout.write(`  ${chalk.cyan('\u2502')}     \u2192 ${fileStr}\n`);
    }

    // Show dependencies
    if (step.dependencies.length > 0) {
      const depStr = step.dependencies.map(d => `step ${d + 1}`).join(', ');
      process.stdout.write(`  ${chalk.cyan('\u2502')}     ${chalk.dim(`depends: ${depStr}`)}\n`);
    }
  }

  // Footer
  const totalTools = plan.steps.reduce((sum, s) => sum + s.tools.length, 0);
  const footerText = `\u2500 ${plan.steps.length} steps \u00B7 ~${totalTools} tool calls `;
  const bottomBorder = '\u2514' + footerText + '\u2500'.repeat(Math.max(0, termWidth - footerText.length - 1));
  process.stdout.write(`  ${chalk.cyan('\u2502')}\n`);
  process.stdout.write(`  ${chalk.cyan(bottomBorder)}\n`);
  process.stdout.write('\n');
}

// ---------------------------------------------------------------------------
// Plan Approval Menu — uses existing selectMenu
// ---------------------------------------------------------------------------

export type PlanApprovalChoice = 'approve' | 'approve_auto' | 'modify' | 'reject';

/**
 * Show the plan approval menu. Returns the user's choice.
 */
export async function showPlanApprovalMenu(): Promise<PlanApprovalChoice> {
  const items: MenuItem[] = [
    {
      label: '\u2713 Approve & Execute',
      description: 'Run the plan step by step',
      key: 'a',
    },
    {
      label: '\u270E Modify steps',
      description: 'Edit the plan before executing',
      key: 'm',
    },
    {
      label: '\u2717 Reject plan',
      description: 'Discard and return to prompt',
      key: 'r',
    },
    {
      label: '\u26A1 Approve (auto-accept permissions)',
      description: 'Execute with skip-permissions mode',
      key: '!',
    },
  ];

  const idx = await selectMenu(items, {
    title: 'Plan Review',
    cancelLabel: 'Reject',
  });

  switch (idx) {
    case 0: return 'approve';
    case 1: return 'modify';
    case 2: return 'reject';
    case 3: return 'approve_auto';
    case -1: return 'reject'; // ESC
    default: return 'reject';
  }
}

// ---------------------------------------------------------------------------
// Step Progress — inline step-by-step indicators
// ---------------------------------------------------------------------------

/**
 * Render a plan step start indicator.
 * Example: "  \u25B8 @main [Step 2/5] Creating auth middleware..."
 */
export function renderPlanStepStart(step: PlanStep, idx: number, total: number, agentName?: string): void {
  const identity = agentName ? AGENT_IDENTITIES[agentName] : AGENT_IDENTITIES.main;
  const tag = identity ? renderAgentTag(identity) : chalk.cyan('@main');
  process.stdout.write(
    `\n  ${chalk.cyan('\u25B8')} ${tag} ${chalk.cyan(`[Step ${idx}/${total}]`)} ${step.title}${chalk.dim('...')}\n`,
  );
}

/**
 * Render a plan step completion indicator.
 * Example: "  \u2713 @main [Step 1/5] Read existing patterns (2.3s)"
 */
export function renderPlanStepEnd(step: PlanStep, idx: number, total: number, status: 'done' | 'error'): void {
  const icon = status === 'done' ? chalk.green('\u2713') : chalk.red('\u2717');
  const duration = step.startedAt && step.completedAt
    ? chalk.dim(` (${((step.completedAt - step.startedAt) / 1000).toFixed(1)}s)`)
    : '';
  const errorHint = status === 'error' && step.error
    ? chalk.red(` — ${step.error.slice(0, 60)}`)
    : '';

  process.stdout.write(
    `  ${icon} ${chalk.dim(`[Step ${idx}/${total}]`)} ${step.title}${duration}${errorHint}\n`,
  );
}

/**
 * Render a compact plan completion summary.
 */
export function renderPlanComplete(plan: ExecutionPlan): void {
  const done = plan.steps.filter(s => s.status === 'done').length;
  const failed = plan.steps.filter(s => s.status === 'error').length;
  const duration = plan.completedAt && plan.approvedAt
    ? ((plan.completedAt - plan.approvedAt) / 1000).toFixed(1) + 's'
    : '';

  const statusIcon = plan.status === 'completed' ? chalk.green('\u2713') : chalk.red('\u2717');
  const statusText = plan.status === 'completed'
    ? chalk.green('Plan completed')
    : chalk.red('Plan failed');

  process.stdout.write('\n');
  process.stdout.write(`  ${statusIcon} ${statusText}: "${plan.title}"\n`);
  process.stdout.write(`     ${chalk.dim(`${done} steps done`)}`);
  if (failed > 0) {
    process.stdout.write(chalk.red(`, ${failed} failed`));
  }
  if (duration) {
    process.stdout.write(chalk.dim(` in ${duration}`));
  }
  process.stdout.write('\n\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStepIcon(status: string): string {
  switch (status) {
    case 'done':    return chalk.green('\u2713');
    case 'running': return chalk.yellow('\u25B8');
    case 'error':   return chalk.red('\u2717');
    case 'skipped': return chalk.dim('\u2500');
    default:        return chalk.dim('\u25A1'); // pending = empty box
  }
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
