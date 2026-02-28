/**
 * Autonomous work mode — HelixMind continuously scans and fixes issues.
 * Runs until nothing more to optimize or /stop is called.
 */
import chalk from 'chalk';
import { renderInfo } from '../ui/chat-view.js';

const SCAN_PROMPT = `You are in AUTONOMOUS MODE. Scan this repository thoroughly for the most impactful issue to fix.

Priority order:
1. CRITICAL bugs or logic errors that cause crashes or wrong behavior
2. Security vulnerabilities (injection, path traversal, hardcoded secrets)
3. Missing error handling that could cause unhandled exceptions
4. Broken or missing tests for important functionality
5. Performance bottlenecks
6. Dead code, unused imports, inconsistent patterns
7. Code quality improvements

RULES:
- Pick ONE issue — the most impactful one
- Fix it completely (code + test if applicable)
- End with a single-line summary starting with "DONE:" describing what you fixed
- If you genuinely cannot find ANY issue worth fixing, respond with exactly: ALL_TASKS_COMPLETE`;

function continuePrompt(completed: string[]): string {
  return `You are in AUTONOMOUS MODE (round ${completed.length + 1}).

Already completed:
${completed.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

Continue scanning for MORE issues in DIFFERENT areas of the codebase.
Pick the next most impactful issue and fix it completely.

End with a single-line summary starting with "DONE:" describing what you fixed.
If you genuinely cannot find anything more to improve: ALL_TASKS_COMPLETE`;
}

export const SECURITY_PROMPT = `Perform a comprehensive SECURITY AUDIT of this codebase.

Check every file systematically for:
1. **Command Injection** — user input passed to shell commands without sanitization
2. **Path Traversal** — user-controlled paths that could escape the project root
3. **XSS / Injection** — unsanitized output in HTML/templates
4. **Hardcoded Secrets** — API keys, passwords, tokens in source code
5. **Insecure Dependencies** — check package.json for known vulnerable packages
6. **Missing Input Validation** — unvalidated user input at boundaries
7. **Unsafe File Operations** — writing to arbitrary paths, following symlinks
8. **Information Disclosure** — verbose error messages, debug endpoints
9. **Authentication Issues** — missing auth checks, weak token generation
10. **Race Conditions** — TOCTOU, concurrent access without locks

For EACH finding, report:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **File**: exact file path and line number
- **Issue**: what's wrong and why it's dangerous
- **Fix**: specific code change needed

After the report, automatically fix all CRITICAL and HIGH severity issues.`;

export interface AutonomousCallbacks {
  sendMessage: (prompt: string) => Promise<string>;
  isAborted: () => boolean;
  onRoundStart: (round: number) => void;
  onRoundEnd: (round: number, summary: string) => void;
  updateStatus: () => void;
}

function goalPrompt(goal: string): string {
  return `You are in AUTONOMOUS MODE with a specific goal.

GOAL: ${goal}

Work on this goal step by step. Break it down into subtasks if needed.
Fix, implement, or change whatever is necessary to achieve the goal.

RULES:
- Focus exclusively on the given goal
- Work methodically — one subtask at a time
- End each round with a single-line summary starting with "DONE:" describing what you accomplished
- When the goal is fully achieved, respond with exactly: ALL_TASKS_COMPLETE`;
}

function continueGoalPrompt(goal: string, completed: string[]): string {
  return `You are in AUTONOMOUS MODE (round ${completed.length + 1}).

GOAL: ${goal}

Already completed:
${completed.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

Continue working towards the goal. Pick the next subtask and complete it.

End with a single-line summary starting with "DONE:" describing what you accomplished.
When the goal is fully achieved: ALL_TASKS_COMPLETE`;
}

export async function runAutonomousLoop(
  callbacks: AutonomousCallbacks,
  initialGoal?: string,
): Promise<number> {
  const completed: string[] = [];
  let round = 0;
  let goal: string | undefined = initialGoal;

  const d = chalk.dim;
  const c = chalk.hex('#00d4ff');

  process.stdout.write('\n');
  process.stdout.write(d('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(d('\u2502  ') + c('\u{1F504} AUTONOMOUS MODE') + d('                        \u2502') + '\n');
  if (goal) {
    process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
    // Truncate goal to fit in the box (39 chars max)
    const goalDisplay = goal.length > 39 ? goal.slice(0, 36) + '...' : goal;
    const padding = ' '.repeat(Math.max(0, 39 - goalDisplay.length));
    process.stdout.write(d('\u2502  ') + chalk.white.bold('Goal: ') + goalDisplay + padding + d('\u2502') + '\n');
  } else {
    process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
    process.stdout.write(d('\u2502  ') + 'HelixMind will continuously scan and fix' + d('    \u2502') + '\n');
    process.stdout.write(d('\u2502  ') + 'issues until nothing remains.' + d('               \u2502') + '\n');
  }
  process.stdout.write(d('\u2502') + d('                                             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + d('/stop or ESC to stop') + d('                    \u2502') + '\n');
  process.stdout.write(d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');

  while (!callbacks.isAborted()) {
    round++;
    callbacks.onRoundStart(round);
    callbacks.updateStatus();

    let prompt: string;
    if (goal) {
      prompt = round === 1 ? goalPrompt(goal) : continueGoalPrompt(goal, completed);
    } else {
      prompt = round === 1 ? SCAN_PROMPT : continuePrompt(completed);
    }

    process.stdout.write(chalk.dim(`  \u2500\u2500 Round ${round} `) + chalk.dim('\u2500'.repeat(35)) + '\n');

    try {
      const resultText = await callbacks.sendMessage(prompt);
      if (callbacks.isAborted()) break;

      // Check if agent says it's done
      if (resultText.includes('ALL_TASKS_COMPLETE')) {
        if (goal) {
          // Goal achieved — transition to general scan mode
          process.stdout.write('\n');
          renderInfo(chalk.green(`  \u2705 Goal achieved (${completed.length} tasks). Switching to general scan mode...`));
          process.stdout.write('\n');
          goal = undefined; // switch to scan mode for subsequent rounds
          continue;
        } else {
          // General scan found nothing — truly done
          process.stdout.write('\n');
          renderInfo(chalk.green(`  \u2705 Autonomous mode complete \u2014 ${completed.length} tasks finished.`));
          process.stdout.write('\n');
          break;
        }
      }

      // Extract summary from "DONE: ..." line or last line
      const summary = extractSummary(resultText);
      completed.push(summary);
      callbacks.onRoundEnd(round, summary);

      renderInfo(chalk.green(`  \u2713 Round ${round}: ${summary}`));
    } catch (err) {
      if (callbacks.isAborted()) break;
      renderInfo(chalk.red(`  \u2717 Round ${round} error: ${err}`));
    }
  }

  if (callbacks.isAborted()) {
    process.stdout.write('\n');
    renderInfo(chalk.yellow(`  \u23F9 Autonomous mode stopped after ${completed.length} tasks.`));
    process.stdout.write('\n');
  }

  return completed.length;
}

// ---------------------------------------------------------------------------
// Monitor mode helpers
// ---------------------------------------------------------------------------

export const MONITOR_MODES = [
  { key: 'passive' as const, label: '\u{1F50D} Passive', description: 'Read-only, alerts only' },
  { key: 'defensive' as const, label: '\u{1F6E1}\uFE0F Defensive', description: 'Auto-block attacks, rotate secrets' },
  { key: 'active' as const, label: '\u2694\uFE0F Active', description: '+ Honeypots, counter-intel, deception' },
] as const;

export const MONITOR_WARNINGS: Record<string, string[]> = {
  defensive: [
    'Block attacking IPs via iptables/fail2ban',
    'Kill suspicious processes',
    'Rotate compromised secrets',
    'Write firewall rules',
  ],
  active: [
    'All defensive actions, plus:',
    'Deploy honeypot services',
    'Attacker profiling & counter-intel',
    'Deception infrastructure',
  ],
};

function extractSummary(text: string): string {
  // Look for "DONE: ..." line
  const doneMatch = text.match(/DONE:\s*(.+)/i);
  if (doneMatch) {
    const s = doneMatch[1].trim();
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  }

  // Fallback: last non-empty line
  const lines = text.trim().split('\n').filter(l => l.trim());
  const last = lines[lines.length - 1]?.trim() || text.slice(0, 100);
  return last.length > 120 ? last.slice(0, 117) + '...' : last;
}
