/**
 * CLI logout — remove stored auth and optionally revoke the key on the server.
 */
import chalk from 'chalk';
import { createHash } from 'node:crypto';
import type { ConfigStore } from '../config/store.js';

export interface LogoutOptions {
  revokeRemote?: boolean;
}

export async function logoutFlow(
  store: ConfigStore,
  options: LogoutOptions = { revokeRemote: true },
): Promise<void> {
  const auth = store.getAuthInfo();

  if (!auth?.apiKey) {
    process.stdout.write(chalk.dim('  Not logged in.\n\n'));
    return;
  }

  // Revoke on server (best-effort)
  if (options.revokeRemote !== false && auth.url) {
    try {
      const url = auth.url.replace(/\/+$/, '');
      await fetch(`${url}/api/auth/cli/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Silently ignore — key still gets removed locally
    }
  }

  const email = auth.email ?? 'unknown';
  store.clearAuth();

  process.stdout.write(chalk.green(`  \u2713 Logged out (${email})\n`));
  if (options.revokeRemote !== false) {
    process.stdout.write(chalk.dim('  API key revoked on server.\n'));
  }
  process.stdout.write('\n');
}
