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
 * Ask a text question using a temporary readline.
 * The main readline has output:devNull, so rl.question() prompts would be invisible.
 * Instead we create a short-lived readline with output:stdout + terminal:false.
 */
function askQuestion(_rl: ReadlineInterface, question: string): Promise<string> {
  // Ensure stdin is not in raw mode so the temp readline can read line-buffered input
  const wasRaw = process.stdin.isTTY && process.stdin.isRaw;
  if (wasRaw) process.stdin.setRawMode(false);

  const tempRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  return new Promise(resolve => {
    let resolved = false;
    function done(answer: string): void {
      if (resolved) return;
      resolved = true;
      tempRl.close();
      if (wasRaw) process.stdin.setRawMode(true);
      resolve(answer.trim());
    }
    tempRl.once('SIGINT', () => done(''));
    tempRl.question(question, (answer) => done(answer));
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
 * Show a short greeting for returning users.
 * Minimal one-line — daemon box shows the full AGI banner with icon.
 */
export function showReturningGreeting(
  identity: JarvisIdentity,
  projectName?: string,
): void {
  const name = identity.name;
  const tasks = identity.trust.totalTasksCompleted;
  const level = identity.autonomyLevel;
  const proj = projectName ? ` (${projectName})` : '';

  // Minimal one-line greeting — daemon box will show the full AGI banner
  process.stdout.write(
    d(`  ${name} here${proj} \u2014 ${tasks} Tasks, L${level}`) + '\n',
  );
}
