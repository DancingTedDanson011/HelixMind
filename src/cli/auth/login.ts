/**
 * CLI login orchestrator — browser-based callback flow.
 * Opens the webapp in the browser, waits for the user to authorize,
 * then stores the API key in the local config.
 */
import { platform, hostname, release } from 'node:os';
import { exec } from 'node:child_process';
import chalk from 'chalk';
import { theme } from '../ui/theme.js';
import { ConfigStore } from '../config/store.js';
import { startCallbackServer } from './callback-server.js';

const DEFAULT_WEBAPP_URL = 'https://app.helixmind.dev';

export interface LoginOptions {
  apiKey?: string;
  url?: string;
  force?: boolean;
}

export interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  plan?: string;
  userId?: string;
  webappUrl?: string;
}

/**
 * Full login flow: check existing auth, then either manual key or browser flow.
 */
export async function loginFlow(store: ConfigStore, options: LoginOptions): Promise<boolean> {
  const webappUrl = (options.url ?? store.get('relay.url') as string ?? DEFAULT_WEBAPP_URL).replace(/\/+$/, '');

  // Check if already logged in (unless --force)
  if (!options.force && store.isLoggedIn()) {
    const status = await checkAuthStatus(store);
    if (status.loggedIn) {
      process.stdout.write('\n');
      process.stdout.write(chalk.dim('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + theme.primary('\u{1F517} Already logged in') + chalk.dim('                        \u2502') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + `Account: ${status.email ?? 'unknown'}`.padEnd(46) + chalk.dim('\u2502') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + `Plan: ${status.plan ?? 'FREE'}`.padEnd(46) + chalk.dim('\u2502') + '\n');
      process.stdout.write(chalk.dim('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n');
      process.stdout.write(chalk.dim('  Use --force to re-authenticate.\n\n'));
      return true;
    }
  }

  // Manual key entry (--api-key flag)
  if (options.apiKey) {
    return manualKeyLogin(store, options.apiKey, webappUrl);
  }

  // Browser callback flow
  return browserLogin(store, webappUrl);
}

async function manualKeyLogin(store: ConfigStore, apiKey: string, webappUrl: string): Promise<boolean> {
  if (!apiKey.startsWith('hm_')) {
    process.stdout.write(chalk.red('  Invalid API key format. Keys start with "hm_".\n'));
    return false;
  }

  process.stdout.write(chalk.dim('  Validating API key...\n'));

  try {
    const res = await fetch(`${webappUrl}/api/auth/cli/verify`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      process.stdout.write(chalk.red('  Invalid or expired API key.\n'));
      return false;
    }

    const data = (await res.json()) as { valid?: boolean; email?: string; plan?: string; userId?: string };

    store.set('relay.apiKey', apiKey);
    store.set('relay.url', webappUrl);
    if (data.email) store.set('relay.userEmail', data.email);
    if (data.plan) store.set('relay.plan', data.plan);
    if (data.userId) store.set('relay.userId', data.userId);
    store.set('relay.loginAt', new Date().toISOString());
    store.set('relay.autoConnect', true);

    showSuccessBox(data.email, data.plan, apiKey);
    return true;
  } catch (err) {
    process.stdout.write(chalk.red(`  Could not reach ${webappUrl}. Check your connection.\n`));
    return false;
  }
}

async function browserLogin(store: ConfigStore, webappUrl: string): Promise<boolean> {
  process.stdout.write('\n');
  process.stdout.write(theme.primary('  \u{1F300} HelixMind Login\n'));
  process.stdout.write(chalk.dim('  Opening browser for authorization...\n\n'));

  let server;
  try {
    server = await startCallbackServer();
  } catch (err) {
    process.stdout.write(chalk.red('  Failed to start local callback server.\n'));
    return false;
  }

  const deviceName = hostname();
  const deviceOs = `${platform()} ${release()}`;
  const authUrl =
    `${webappUrl}/auth/cli` +
    `?callback_port=${server.port}` +
    `&state=${server.state}` +
    `&device_name=${encodeURIComponent(deviceName)}` +
    `&device_os=${encodeURIComponent(deviceOs)}`;

  // Open browser
  const opened = await openBrowser(authUrl);

  if (!opened) {
    process.stdout.write(chalk.yellow('  Could not open browser automatically.\n'));
    process.stdout.write(chalk.dim('  Open this URL manually:\n\n'));
    process.stdout.write(`  ${theme.primary(authUrl)}\n\n`);
  }

  process.stdout.write(chalk.dim('  Waiting for authorization in browser... (timeout: 120s)\n'));
  process.stdout.write(chalk.dim('  Press Ctrl+C to cancel.\n\n'));

  try {
    const result = await server.waitForCallback();

    // Store auth data
    store.set('relay.apiKey', result.apiKey);
    store.set('relay.url', webappUrl);
    if (result.email) store.set('relay.userEmail', result.email);
    if (result.plan) store.set('relay.plan', result.plan);
    if (result.userId) store.set('relay.userId', result.userId);
    store.set('relay.loginAt', new Date().toISOString());
    store.set('relay.autoConnect', true);

    showSuccessBox(result.email, result.plan, result.apiKey);
    return true;
  } catch (err) {
    server.close();
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('cancelled')) {
      process.stdout.write(chalk.yellow('  Authorization cancelled.\n\n'));
    } else if (msg.includes('timed out')) {
      process.stdout.write(chalk.yellow('  Authorization timed out.\n'));
      process.stdout.write(chalk.dim('  Try: helixmind login --api-key <key>\n\n'));
    } else {
      process.stdout.write(chalk.red(`  Login failed: ${msg}\n\n`));
    }
    return false;
  }
}

function showSuccessBox(email?: string, plan?: string, apiKey?: string): void {
  const masked = apiKey ? ConfigStore.maskKey(apiKey) : '***';

  process.stdout.write('\n');
  process.stdout.write(chalk.dim('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + chalk.green('\u2713 HelixMind \u2014 Logged In') + chalk.dim('                       \u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + `Account: ${email ?? 'connected'}`.padEnd(46) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + `Plan:    ${plan ?? 'FREE'}`.padEnd(46) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + `API Key: ${masked}`.padEnd(46) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');
}

function openBrowser(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const plat = platform();
    const cmd =
      plat === 'win32' ? `start "" "${url}"`
      : plat === 'darwin' ? `open "${url}"`
      : `xdg-open "${url}"`;

    exec(cmd, (err) => resolve(!err));
  });
}

/**
 * Check if the stored API key is still valid. Returns auth status.
 */
export async function checkAuthStatus(store: ConfigStore): Promise<AuthStatus> {
  const auth = store.getAuthInfo();
  if (!auth?.apiKey || !auth.url) {
    return { loggedIn: false };
  }

  try {
    const url = auth.url.replace(/\/+$/, '');
    const res = await fetch(`${url}/api/auth/cli/verify`, {
      headers: { Authorization: `Bearer ${auth.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { loggedIn: false, webappUrl: auth.url };
    }

    const data = (await res.json()) as { valid?: boolean; email?: string; plan?: string; userId?: string };

    // Update cached values
    if (data.email) store.set('relay.userEmail', data.email);
    if (data.plan) store.set('relay.plan', data.plan);

    return {
      loggedIn: true,
      email: data.email ?? auth.email,
      plan: data.plan ?? auth.plan,
      userId: data.userId ?? auth.userId,
      webappUrl: auth.url,
    };
  } catch {
    // Network error — use cached data
    return {
      loggedIn: true,
      email: auth.email,
      plan: auth.plan,
      userId: auth.userId,
      webappUrl: auth.url,
    };
  }
}
