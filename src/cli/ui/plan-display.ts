/**
 * Plan Display — terminal UI components for plan review, approval, and progress.
 *
 * Plan Review uses full-screen takeover pattern (like CheckpointBrowser):
 *   - \x1b[2J\x1b[H clear + raw stdin for arrow-key navigation
 *   - Interactive step browsing with detail expansion
 *   - Inline approval actions (Enter → options, ESC → reject)
 *
 * No Ink/Clack — stays consistent with the existing ANSI UI approach.
 */
import chalk from 'chalk';
import type { ExecutionPlan, PlanStep } from '../agent/plan-types.js';
import { renderAgentTag } from './agent-display.js';
import { AGENT_IDENTITIES } from '../agent/plan-types.js';
import { createKeybindingState, processKeypress } from '../checkpoints/keybinding.js';

// ---------------------------------------------------------------------------
// Plan Browser Result — returned from the interactive full-screen review
// ---------------------------------------------------------------------------

export type PlanApprovalChoice = 'approve' | 'approve_auto' | 'modify' | 'reject';

export interface PlanBrowserResult {
  choice: PlanApprovalChoice;
}

// ---------------------------------------------------------------------------
// Full-Screen Interactive Plan Browser
// ---------------------------------------------------------------------------

/**
 * Run the interactive plan browser. Full-screen takeover like CheckpointBrowser.
 *
 * Navigation:
 *   ↑/↓  — select step
 *   Enter — open approval actions (when on footer) or expand step detail
 *   ESC   — close / reject
 *   1-4   — quick-pick approval action
 */
export function runPlanBrowser(plan: ExecutionPlan): Promise<PlanBrowserResult> {
  const steps = plan.steps;
  // Items: each step + 1 approval footer row
  const totalItems = steps.length + 1; // last item = approval actions

  return new Promise<PlanBrowserResult>((resolve) => {
    let selectedIndex = steps.length; // start at approval footer
    let inActions = false; // sub-menu for approval
    let actionIndex = 0;  // within approval actions
    const keyState = createKeybindingState();
    keyState.inBrowser = true;

    const actions: Array<{ label: string; key: string; choice: PlanApprovalChoice }> = [
      { label: '\u2713 Approve & Execute',              key: '1', choice: 'approve' },
      { label: '\u270E Modify steps',                   key: '2', choice: 'modify' },
      { label: '\u2717 Reject plan',                    key: '3', choice: 'reject' },
      { label: '\u26A1 Approve (auto-accept permissions)', key: '4', choice: 'approve_auto' },
    ];

    const maxVisible = Math.min(totalItems, Math.max(6, (process.stdout.rows || 24) - 12));

    function render(): void {
      const termWidth = Math.max(60, (process.stdout.columns || 80) - 2);
      process.stdout.write('\x1b[2J\x1b[H');

      // Header
      process.stdout.write(chalk.bold.cyan('  Plan Review') + '\n');
      process.stdout.write(chalk.dim('  Navigate steps with \u2191/\u2193, Enter to approve, Esc to reject') + '\n\n');

      // Title + description
      process.stdout.write(`  ${chalk.bold(plan.title)}\n`);
      if (plan.description) {
        const descLines = wrapText(plan.description, termWidth - 6);
        for (const line of descLines) {
          process.stdout.write(`  ${chalk.dim(line)}\n`);
        }
      }
      process.stdout.write('\n');

      // Summary line
      const totalTools = steps.reduce((sum, s) => sum + s.tools.length, 0);
      process.stdout.write(`  ${chalk.dim(`${steps.length} steps \u00B7 ~${totalTools} tool calls`)}\n\n`);

      // Scrollable step list
      const start = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
      const end = Math.min(totalItems, start + maxVisible);

      for (let i = start; i < end; i++) {
        const isSelected = i === selectedIndex;

        if (i < steps.length) {
          // Step row
          const step = steps[i];
          const statusIcon = getStepIcon(step.status);
          const stepNum = step.id + 1;
          const pointer = isSelected ? chalk.cyan('\u25B8 ') : '  ';

          const toolHint = step.tools.length > 0
            ? chalk.dim(` [${step.tools.join(', ')}]`)
            : '';

          if (isSelected) {
            process.stdout.write(`  ${pointer}${statusIcon} ${chalk.bold.white(`${stepNum}.`)} ${chalk.white(step.title)}${toolHint}\n`);

            // Expanded detail for selected step
            if (step.affectedFiles.length > 0) {
              const fileStr = step.affectedFiles.map(f => chalk.dim(f)).join(', ');
              process.stdout.write(`       \u2192 ${fileStr}\n`);
            }
            if (step.dependencies.length > 0) {
              const depStr = step.dependencies.map(d => `step ${d + 1}`).join(', ');
              process.stdout.write(`       ${chalk.dim(`depends: ${depStr}`)}\n`);
            }
            if (step.description && step.description !== step.title) {
              const descLines = wrapText(step.description, termWidth - 10);
              for (const line of descLines) {
                process.stdout.write(`       ${chalk.dim(line)}\n`);
              }
            }
            process.stdout.write('\n');
          } else {
            process.stdout.write(`  ${pointer}${statusIcon} ${chalk.dim(`${stepNum}.`)} ${chalk.dim(step.title)}${toolHint}\n`);
          }
        } else {
          // Approval footer row
          const pointer = isSelected ? chalk.cyan('\u25B8 ') : '  ';
          if (isSelected) {
            process.stdout.write(`\n  ${pointer}${chalk.bold.green('Actions')}\n`);
          } else {
            process.stdout.write(`\n  ${pointer}${chalk.dim('Actions')}\n`);
          }
        }
      }

      // Action sub-menu (when in actions mode)
      if (inActions) {
        process.stdout.write('\n');
        for (let a = 0; a < actions.length; a++) {
          const act = actions[a];
          const isActSel = a === actionIndex;
          const pointer = isActSel ? chalk.cyan('\u25B8 ') : '  ';
          const label = isActSel ? chalk.white(act.label) : chalk.dim(act.label);
          process.stdout.write(`    ${pointer}${chalk.cyan(`[${act.key}]`)} ${label}\n`);
        }
        process.stdout.write('\n' + chalk.dim('  \u2191/\u2193 select \u00B7 Enter confirm \u00B7 Esc back') + '\n');
      } else {
        // Normal footer hints
        process.stdout.write('\n' + chalk.dim('  \u2191/\u2193 navigate \u00B7 Enter actions \u00B7 Esc reject \u00B7 1-4 quick action') + '\n');
      }
    }

    function handleKey(chunk: Buffer): void {
      const str = chunk.toString();
      const key = parseKey(str);
      const result = processKeypress(key, keyState);

      if (inActions) {
        // In approval sub-menu
        switch (result.action) {
          case 'up':
            if (actionIndex > 0) { actionIndex--; render(); }
            break;
          case 'down':
            if (actionIndex < actions.length - 1) { actionIndex++; render(); }
            break;
          case 'enter':
            cleanup();
            resolve({ choice: actions[actionIndex].choice });
            return;
          case 'escape':
            inActions = false;
            render();
            break;
          case 'digit':
            if (result.digit && result.digit >= 1 && result.digit <= actions.length) {
              cleanup();
              resolve({ choice: actions[result.digit - 1].choice });
              return;
            }
            break;
        }
        return;
      }

      // Normal navigation mode
      switch (result.action) {
        case 'up':
          if (selectedIndex > 0) { selectedIndex--; render(); }
          break;
        case 'down':
          if (selectedIndex < totalItems - 1) { selectedIndex++; render(); }
          break;
        case 'enter':
          if (selectedIndex === steps.length) {
            // On the approval footer — open actions sub-menu
            inActions = true;
            actionIndex = 0;
            render();
          }
          // On a step — just highlight/expand (already done by render)
          break;
        case 'escape':
          cleanup();
          resolve({ choice: 'reject' });
          return;
        case 'digit':
          // Quick-pick: 1-4 maps to approval actions directly
          if (result.digit && result.digit >= 1 && result.digit <= actions.length) {
            cleanup();
            resolve({ choice: actions[result.digit - 1].choice });
            return;
          }
          break;
      }
    }

    let wasRaw = false;

    function cleanup(): void {
      process.stdin.removeListener('data', handleKey);
      if (process.stdin.isTTY && !wasRaw) {
        process.stdin.setRawMode(false);
      }
      // Clear screen and return to normal
      process.stdout.write('\x1b[2J\x1b[H');
    }

    if (process.stdin.isTTY) {
      wasRaw = process.stdin.isRaw ?? false;
      process.stdin.setRawMode(true);
    }

    process.stdin.on('data', handleKey);
    render();
  });
}

// ---------------------------------------------------------------------------
// Static Plan Review — for /plan show (non-interactive, simple print)
// ---------------------------------------------------------------------------

/**
 * Render a plan statically in the terminal (non-interactive).
 * Used by /plan show when no approval is needed.
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
    ? chalk.red(` \u2014 ${step.error.slice(0, 60)}`)
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

function parseKey(str: string): { name?: string; sequence?: string; ctrl?: boolean } {
  if (str === '\x1b' || str === '\x1b\x1b') return { name: 'escape' };
  if (str === '\x1b[A') return { name: 'up' };
  if (str === '\x1b[B') return { name: 'down' };
  if (str === '\r' || str === '\n') return { name: 'return' };
  if (str.length === 1 && str >= '1' && str <= '9') return { sequence: str };
  if (str.charCodeAt(0) === 3) return { name: 'c', ctrl: true };
  return { sequence: str };
}
