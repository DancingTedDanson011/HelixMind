/**
 * Jarvis Onboarding — First-run greeting, name customization, goal setting, scope selection.
 * Subsequent starts show a short returning greeting.
 */
import chalk from 'chalk';
import * as readline from 'node:readline';
import type { Interface as ReadlineInterface } from 'node:readline';
import type { JarvisIdentityManager } from './identity.js';
import type { JarvisIdentity } from './types.js';

const d = chalk.dim;
const j = chalk.hex('#ff00ff');
const g = chalk.hex('#FFB800');

export interface OnboardingResult {
  scope?: 'project' | 'global';
  goalText?: string;
}

/**
 * Ask a text question using raw-mode input with ESC support.
 * ESC / double-ESC cancels (returns ''). Enter submits.
 * 80ms settling phase to discard stale stdin data from type-ahead.
 */
function askQuestion(_rl: ReadlineInterface, question: string): Promise<string> {
  return new Promise(resolve => {
    const stdin = process.stdin;
    const wasRaw = stdin.isTTY ? stdin.isRaw : undefined;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let settling = true;
    setTimeout(() => { settling = false; }, 80);

    let buffer = '';

    process.stdout.write(question);

    function cleanup(result: string): void {
      stdin.removeListener('data', onData);
      if (stdin.isTTY && wasRaw !== undefined) stdin.setRawMode(wasRaw);
      process.stdout.write('\n');
      resolve(result.trim());
    }

    function onData(data: Buffer): void {
      if (settling) return;

      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const key = data.toString();

      // ESC or double-ESC → cancel
      if (bytes[0] === 0x1b) { cleanup(''); return; }

      // Ctrl+C → cancel
      if (key === '\x03') { cleanup(''); return; }

      // Enter → submit
      if (key === '\r' || key === '\n') { cleanup(buffer); return; }

      // Backspace
      if (key === '\x7f' || key === '\x08') {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      // Printable characters
      for (const ch of key) {
        if (ch.charCodeAt(0) >= 32) {
          buffer += ch;
          process.stdout.write(ch);
        }
      }
    }

    stdin.on('data', onData);
  });
}

/**
 * Run the first-time onboarding flow.
 * Introduces Jarvis, asks for a custom name, project goals, and scope.
 * Returns scope selection + goal so the caller can switch and auto-create a task.
 */
export async function runOnboarding(
  identityManager: JarvisIdentityManager,
  rl: ReadlineInterface,
  currentScope: 'project' | 'global',
  projectName?: string,
): Promise<OnboardingResult> {
  const identity = identityManager.getIdentity();
  const result: OnboardingResult = {};

  process.stdout.write('\n');
  process.stdout.write(d('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(d('\u2502  ') + g('\u{1F31F}') + ' ' + j.bold("Hey! I'm Jarvis.") + d('                            \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + "I'm your autonomous AGI assistant in" + d('           \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'HelixMind. I can:' + d('                             \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Execute tasks autonomously' + d('                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Analyze code & create proposals' + d('             \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Learn from your feedback' + d('                    \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Think proactively & improve' + d('                 \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + d(`Autonomy: L${identity.autonomyLevel} | Tasks: 0 completed`) + d('          \u2502') + '\n');
  process.stdout.write(d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n');
  process.stdout.write('\n');

  // Ask for custom name
  const nameInput = await askQuestion(
    rl,
    j('  Give me a name (Enter = Jarvis): '),
  );

  if (nameInput && nameInput.toLowerCase() !== 'jarvis') {
    identityManager.setName(nameInput);
    process.stdout.write(g(`  Got it \u2014 I'm ${chalk.bold(nameInput)} now!`) + '\n');
  } else {
    process.stdout.write(g('  Jarvis it is!') + '\n');
  }

  // Ask for project goals
  process.stdout.write('\n');
  const goalInput = await askQuestion(
    rl,
    j('  What is your goal for this project? (Enter = skip): '),
  );

  if (goalInput) {
    identityManager.setUserGoals([goalInput]);
    result.goalText = goalInput;
    process.stdout.write(d("  Goal saved \u2014 I'll keep it in mind.") + '\n');
  }

  // Ask for scope
  process.stdout.write('\n');
  const scopeLabel = currentScope === 'project'
    ? chalk.green('local') + d(' (.helixmind/)')
    : chalk.blue('global') + d(' (~/.spiral-context/)');
  process.stdout.write(d(`  Current: `) + scopeLabel + '\n');
  process.stdout.write('\n');
  const scopeInput = await askQuestion(
    rl,
    j('  Where should I work? [1] Local (this project only) [2] Global (all projects): '),
  );

  if (scopeInput === '2' || scopeInput.toLowerCase().startsWith('g')) {
    result.scope = 'global';
    process.stdout.write(d('  Scope: ') + chalk.blue('Global') + d(' \u2014 all projects') + '\n');
  } else {
    result.scope = 'project';
    process.stdout.write(d('  Scope: ') + chalk.green('Local') + d(' \u2014 this project only') + '\n');
  }

  // Mark onboarding as completed
  identityManager.setCustomized();

  const finalName = identityManager.getIdentity().name;
  process.stdout.write('\n');
  process.stdout.write(g(`  ${finalName} is ready.`) + '\n');
  process.stdout.write('\n');

  return result;
}

/**
 * Build a short greeting string for returning users.
 * Returns the greeting text (caller writes it via screen.writeOutput).
 */
export function showReturningGreeting(
  identity: JarvisIdentity,
  projectName?: string,
): string {
  const name = identity.name;
  const tasks = identity.trust.totalTasksCompleted;
  const level = identity.autonomyLevel;
  const proj = projectName ? ` (${projectName})` : '';

  return d(`  ${name} here${proj} \u2014 ${tasks} Tasks, L${level}`) + '\n';
}
