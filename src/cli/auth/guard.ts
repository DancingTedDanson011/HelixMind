/**
 * Auth guard — presents a choice to the user: login or open source.
 *
 * After first login, credentials are cached locally in ~/.helixmind/config.json.
 * Works offline with cached auth. When online, token validity is checked
 * in the background (non-blocking).
 *
 * If the user chooses "Open Source", they continue with the full CLI agent
 * (22 tools, spiral memory, all providers) but without Jarvis, brain
 * management, validation, or monitor features.
 */
import chalk from 'chalk';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../config/store.js';
import { theme } from '../ui/theme.js';

/**
 * Auth gate that presents two choices:
 *  [1] Login (free account → Jarvis + Brain Management + more)
 *  [2] Open Source (full CLI agent, no account needed)
 *
 * Returns the ConfigStore. If user picks Open Source, store stays at FREE plan.
 * Never exits the process — always lets the user continue.
 *
 * Commands that are exempt from auth: login, logout, whoami, --help, --version
 */
export async function requireAuth(): Promise<ConfigStore> {
  const configDir = join(homedir(), '.helixmind');
  const store = new ConfigStore(configDir);

  if (store.isLoggedIn()) {
    // Already authenticated (cached locally). Verify in background when online.
    import('../auth/feature-gate.js')
      .then(({ refreshPlanInfo }) => refreshPlanInfo(store))
      .catch(() => {});
    return store;
  }

  // Not logged in — show choice
  process.stdout.write('\n');
  process.stdout.write(chalk.dim('  ╭──────────────────────────────────────────────────╮') + '\n');
  process.stdout.write(chalk.dim('  │  ') + theme.primary('🌀 Welcome to HelixMind') + chalk.dim('                         │') + '\n');
  process.stdout.write(chalk.dim('  │                                                  │') + '\n');
  process.stdout.write(chalk.dim('  │  ') + chalk.white.bold('[1] Login') + chalk.dim(' (free)') + chalk.dim('                                │') + '\n');
  process.stdout.write(chalk.dim('  │      ') + chalk.gray('Jarvis AGI · Brain Management · Cloud') + chalk.dim('     │') + '\n');
  process.stdout.write(chalk.dim('  │      ') + chalk.gray('One-time setup — works offline after') + chalk.dim('     │') + '\n');
  process.stdout.write(chalk.dim('  │                                                  │') + '\n');
  process.stdout.write(chalk.dim('  │  ') + chalk.white.bold('[2] Open Source') + chalk.dim('                                   │') + '\n');
  process.stdout.write(chalk.dim('  │      ') + chalk.gray('Full AI agent · 22 Tools · Spiral Memory') + chalk.dim(' │') + '\n');
  process.stdout.write(chalk.dim('  │      ') + chalk.gray('All providers · No account needed') + chalk.dim('        │') + '\n');
  process.stdout.write(chalk.dim('  │                                                  │') + '\n');
  process.stdout.write(chalk.dim('  ╰──────────────────────────────────────────────────╯') + '\n\n');

  const choice = await promptChoice();

  if (choice === '1') {
    const { loginFlow } = await import('../auth/login.js');
    const loggedIn = await loginFlow(store, {});

    if (!loggedIn) {
      // Login failed/cancelled — still let them use open source
      process.stdout.write('\n');
      process.stdout.write(chalk.dim('  Login cancelled — continuing in ') + theme.primary('Open Source') + chalk.dim(' mode.\n'));
      process.stdout.write(chalk.dim('  Run ') + chalk.white('helixmind login') + chalk.dim(' anytime to unlock Jarvis + more.\n\n'));
    }

    return store;
  }

  // Choice 2: Open Source — just continue without login
  process.stdout.write('\n');
  process.stdout.write(chalk.dim('  ') + theme.primary('▸') + chalk.dim(' Open Source mode — full agent, no limits.\n'));
  process.stdout.write(chalk.dim('  Run ') + chalk.white('helixmind login') + chalk.dim(' anytime to unlock Jarvis AGI.\n\n'));

  return store;
}

/**
 * Prompt the user for [1] or [2]. Defaults to 1 on empty Enter.
 */
function promptChoice(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(chalk.dim('  Choose ') + chalk.white('[1/2]') + chalk.dim(': '), (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === '2') {
        resolve('2');
      } else {
        resolve('1'); // Default: login
      }
    });
  });
}
