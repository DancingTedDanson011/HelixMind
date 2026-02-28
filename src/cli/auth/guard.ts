/**
 * Auth guard — ensures user is logged in before using any CLI command.
 *
 * After first login, credentials are cached locally in ~/.helixmind/config.json.
 * Works offline with cached auth. When online, token validity is checked
 * in the background (non-blocking).
 */
import chalk from 'chalk';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../config/store.js';
import { theme } from '../ui/theme.js';

/**
 * Check if user is logged in. If not, run login flow.
 * Returns the ConfigStore (always authenticated after this call).
 * Exits process if login fails/cancelled.
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

  // Not logged in — show gate and start login flow
  process.stdout.write('\n');
  process.stdout.write(chalk.dim('  \u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(chalk.dim('  \u2502  ') + theme.primary('\uD83D\uDD10 Login required') + chalk.dim('                                \u2502') + '\n');
  process.stdout.write(chalk.dim('  \u2502  ') + 'HelixMind requires a free account to use.'.padEnd(46) + chalk.dim('  \u2502') + '\n');
  process.stdout.write(chalk.dim('  \u2502  ') + chalk.dim('One-time setup \u2014 works offline afterwards.'.padEnd(46)) + chalk.dim('  \u2502') + '\n');
  process.stdout.write(chalk.dim('  \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');

  const { loginFlow } = await import('../auth/login.js');
  const loggedIn = await loginFlow(store, {});

  if (!loggedIn) {
    process.stdout.write(chalk.red('\n  Login required to use HelixMind.\n'));
    process.stdout.write(chalk.dim('  Run `helixmind login` to try again.\n\n'));
    process.exit(1);
  }

  return store;
}
