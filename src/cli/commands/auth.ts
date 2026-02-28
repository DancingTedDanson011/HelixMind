/**
 * CLI auth commands: login, logout, whoami.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import { ConfigStore } from '../config/store.js';
import { theme } from '../ui/theme.js';

export async function loginCommand(options: {
  apiKey?: string;
  url?: string;
  force?: boolean;
}): Promise<void> {
  const store = new ConfigStore(join(homedir(), '.helixmind'));
  const { loginFlow } = await import('../auth/login.js');
  await loginFlow(store, options);
}

export async function logoutCommand(options: {
  noRevoke?: boolean;
}): Promise<void> {
  const store = new ConfigStore(join(homedir(), '.helixmind'));
  const { logoutFlow } = await import('../auth/logout.js');
  await logoutFlow(store, { revokeRemote: !options.noRevoke });
}

export async function whoamiCommand(): Promise<void> {
  const store = new ConfigStore(join(homedir(), '.helixmind'));

  if (!store.isLoggedIn()) {
    process.stdout.write(chalk.dim('  Not logged in.\n'));
    process.stdout.write(chalk.dim('  Run `helixmind login` to authenticate.\n\n'));
    return;
  }

  const { checkAuthStatus } = await import('../auth/login.js');
  const status = await checkAuthStatus(store);

  process.stdout.write('\n');
  if (status.loggedIn) {
    process.stdout.write(theme.primary('  \u{1F300} HelixMind\n'));
    process.stdout.write(`  Account:  ${status.email ?? 'unknown'}\n`);
    process.stdout.write(`  Plan:     ${status.plan ?? 'FREE'}\n`);
    process.stdout.write(`  Server:   ${status.webappUrl ?? 'unknown'}\n`);
    process.stdout.write(`  Status:   ${chalk.green('connected')}\n`);
  } else {
    process.stdout.write(theme.primary('  \u{1F300} HelixMind\n'));
    process.stdout.write(`  Status:   ${chalk.red('disconnected')}\n`);
    process.stdout.write(chalk.dim('  Stored key is invalid or expired.\n'));
    process.stdout.write(chalk.dim('  Run `helixmind login --force` to re-authenticate.\n'));
  }
  process.stdout.write('\n');
}
