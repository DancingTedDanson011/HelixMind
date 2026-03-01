/**
 * Jarvis Onboarding — First-run greeting, name customization, goal setting, scope selection.
 * Subsequent starts show a short returning greeting.
 */
import chalk from 'chalk';
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

function askQuestion(rl: ReadlineInterface, question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
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
  process.stdout.write(d('\u2502  ') + g('\u{1F31F}') + ' ' + j.bold('Hey! Ich bin Jarvis.') + d('                        \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'Ich bin dein autonomer AGI-Assistent in' + d('        \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + 'HelixMind. Ich kann:' + d('                          \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Aufgaben autonom ausfuehren' + d('                 \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Code analysieren & Proposals machen' + d('        \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Aus deinem Feedback lernen' + d('                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + chalk.cyan('\u2022') + ' Proaktiv denken & verbessern' + d('                \u2502') + '\n');
  process.stdout.write(d('\u2502') + d('                                                  \u2502') + '\n');
  process.stdout.write(d('\u2502  ') + d(`Autonomy: L${identity.autonomyLevel} | Tasks: 0 erledigt`) + d('           \u2502') + '\n');
  process.stdout.write(d('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n');
  process.stdout.write('\n');

  // Ask for custom name
  const nameInput = await askQuestion(
    rl,
    j('  Gib mir einen Namen (Enter = Jarvis): '),
  );

  if (nameInput && nameInput.toLowerCase() !== 'jarvis') {
    identityManager.setName(nameInput);
    process.stdout.write(g(`  Alles klar \u2014 ich bin jetzt ${chalk.bold(nameInput)}!`) + '\n');
  } else {
    process.stdout.write(g('  Jarvis bleibt es!') + '\n');
  }

  // Ask for project goals
  process.stdout.write('\n');
  const goalInput = await askQuestion(
    rl,
    j('  Was ist dein Ziel fuer dieses Projekt? (Enter = ueberspringen): '),
  );

  if (goalInput) {
    identityManager.setUserGoals([goalInput]);
    result.goalText = goalInput;
    process.stdout.write(d('  Ziel gespeichert \u2014 ich werde es im Hinterkopf behalten.') + '\n');
  }

  // Ask for scope
  process.stdout.write('\n');
  const scopeLabel = currentScope === 'project'
    ? chalk.green('lokal') + d(' (.helixmind/)')
    : chalk.blue('global') + d(' (~/.spiral-context/)');
  process.stdout.write(d(`  Aktuell: `) + scopeLabel + '\n');
  process.stdout.write('\n');
  const scopeInput = await askQuestion(
    rl,
    j('  Wo soll ich arbeiten? [1] Lokal (nur dieses Projekt) [2] Global (alle Projekte): '),
  );

  if (scopeInput === '2' || scopeInput.toLowerCase().startsWith('g')) {
    result.scope = 'global';
    process.stdout.write(d('  Scope: ') + chalk.blue('Global') + d(' \u2014 alle Projekte') + '\n');
  } else {
    result.scope = 'project';
    process.stdout.write(d('  Scope: ') + chalk.green('Lokal') + d(' \u2014 nur dieses Projekt') + '\n');
  }

  // Mark onboarding as completed
  identityManager.setCustomized();

  const finalName = identityManager.getIdentity().name;
  process.stdout.write('\n');
  process.stdout.write(g(`  ${finalName} ist bereit.`) + '\n');
  process.stdout.write('\n');

  return result;
}

/**
 * Show a short greeting for returning users.
 */
export function showReturningGreeting(
  identity: JarvisIdentity,
  projectName?: string,
): void {
  const name = identity.name;
  const tasks = identity.trust.totalTasksCompleted;
  const level = identity.autonomyLevel;
  const proj = projectName ? ` (${projectName})` : '';

  process.stdout.write('\n');
  process.stdout.write(
    g(`  \u{1F31F} ${name}`) + d(` hier${proj} \u2014 `) +
    d(`${tasks} Tasks erledigt, Autonomy L${level}`) + '\n',
  );
  process.stdout.write('\n');
}
