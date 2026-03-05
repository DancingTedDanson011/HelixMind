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

const DEFAULT_WEBAPP_URL = 'https://helix-mind.ai';

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
      const w = 50;
      const ln = '\u2500'.repeat(w);
      process.stdout.write(chalk.dim(`\u256D${ln}\u256E`) + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + theme.primary('\u{1F517} Already connected') + ' '.repeat(w - 24) + chalk.dim('\u2502') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + `Account: ${status.email ?? 'unknown'}`.padEnd(w - 4) + chalk.dim('\u2502') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + `Plan:    ${status.plan ?? 'FREE'}`.padEnd(w - 4) + chalk.dim('\u2502') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + chalk.gray('\u{1F310} Remote access active \u2014 open dashboard on any device').slice(0, w - 2).padEnd(w - 4) + chalk.dim('\u2502') + '\n');
      process.stdout.write(chalk.dim(`\u2570${ln}\u256F`) + '\n');
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
    // Logged-in users are at least FREE_PLUS even if server returns FREE
    const plan = (data.plan && data.plan !== 'FREE') ? data.plan : 'FREE_PLUS';
    store.set('relay.plan', plan);
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
  const deviceName = hostname();
  const deviceOs = `${platform()} ${release()}`;

  process.stdout.write('\n');
  process.stdout.write(theme.primary('  \u{1F300} HelixMind Login\n\n'));

  // --- 1. Request device code (non-blocking, tolerates failure) ---
  interface DeviceCodeResponse { code: string; pollSecret: string; expiresAt: string; pollInterval: number }
  let deviceCode: DeviceCodeResponse | null = null;
  try {
    const dcRes = await fetch(`${webappUrl}/api/auth/device/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName, deviceOs }),
      signal: AbortSignal.timeout(8_000),
    });
    if (dcRes.ok) {
      deviceCode = (await dcRes.json()) as DeviceCodeResponse;
    }
  } catch {
    // Device-code endpoint unavailable — continue with browser-only flow
  }

  // --- 2. Start local callback server (browser flow) ---
  let server: Awaited<ReturnType<typeof startCallbackServer>> | null = null;
  try {
    server = await startCallbackServer();
  } catch {
    // Localhost server failed (e.g. headless env) — device-code only
  }

  if (!server && !deviceCode) {
    process.stdout.write(chalk.red('  Login failed: no callback server and device code unavailable.\n'));
    process.stdout.write(chalk.dim('  Try: helixmind login --api-key <key>\n\n'));
    return false;
  }

  // --- 3. Show device code (always, when available) ---
  if (deviceCode) {
    process.stdout.write(chalk.dim('  ╭──────────────────────────────────────────────────╮') + '\n');
    process.stdout.write(chalk.dim('  │  ') + 'Open this URL on any device:' + '                    '.slice(0, 20) + chalk.dim('│') + '\n');
    process.stdout.write(chalk.dim('  │  ') + theme.primary(`${webappUrl}/auth/device`) + chalk.dim('│'.padStart(Math.max(1, 49 - `${webappUrl}/auth/device`.length - 2))) + '\n');
    process.stdout.write(chalk.dim('  │') + ' '.repeat(49) + chalk.dim('│') + '\n');
    process.stdout.write(chalk.dim('  │  ') + 'Enter code: ' + chalk.bold.white(deviceCode.code) + ' '.repeat(Math.max(1, 49 - 12 - deviceCode.code.length - 2)) + chalk.dim('│') + '\n');
    process.stdout.write(chalk.dim('  ╰──────────────────────────────────────────────────╯') + '\n\n');
  }

  // --- 4. Try opening browser (when server is available) ---
  if (server) {
    const authUrl =
      `${webappUrl}/auth/cli` +
      `?callback_port=${server.port}` +
      `&state=${server.state}` +
      `&device_name=${encodeURIComponent(deviceName)}` +
      `&device_os=${encodeURIComponent(deviceOs)}`;

    const opened = await openBrowser(authUrl);

    if (!opened && !deviceCode) {
      process.stdout.write(chalk.yellow('  Could not open browser automatically.\n'));
      process.stdout.write(chalk.dim('  Open this URL manually:\n\n'));
      process.stdout.write(`  ${theme.primary(authUrl)}\n\n`);
    }
  }

  process.stdout.write(chalk.dim('  Waiting for authorization... (expires in 15m)\n'));
  process.stdout.write(chalk.dim('  Press Ctrl+C to cancel.\n\n'));

  // --- 5. Race: browser callback vs device-code polling ---
  const abortController = new AbortController();

  const browserPromise: Promise<{ apiKey: string; email?: string; plan?: string; userId?: string }> =
    server
      ? server.waitForCallback().then((r) => ({ apiKey: r.apiKey, email: r.email, plan: r.plan, userId: r.userId }))
      : new Promise(() => {}); // never resolves if no server

  const devicePollPromise: Promise<{ apiKey: string; email?: string; plan?: string; userId?: string }> =
    deviceCode
      ? pollDeviceCode(webappUrl, deviceCode.code, deviceCode.pollSecret, deviceCode.pollInterval, abortController.signal)
      : new Promise(() => {}); // never resolves if no device code

  try {
    const result = await Promise.race([browserPromise, devicePollPromise]);

    // Cancel the other flow
    abortController.abort();
    if (server) server.close();

    // Store auth data
    store.set('relay.apiKey', result.apiKey);
    store.set('relay.url', webappUrl);
    if (result.email) store.set('relay.userEmail', result.email);
    const effectivePlan = (result.plan && result.plan !== 'FREE') ? result.plan : 'FREE_PLUS';
    store.set('relay.plan', effectivePlan);
    if (result.userId) store.set('relay.userId', result.userId);
    store.set('relay.loginAt', new Date().toISOString());
    store.set('relay.autoConnect', true);

    showSuccessBox(result.email, result.plan, result.apiKey);
    return true;
  } catch (err) {
    abortController.abort();
    if (server) server.close();
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('cancelled')) {
      process.stdout.write(chalk.yellow('  Authorization cancelled.\n\n'));
    } else if (msg.includes('timed out') || msg.includes('expired')) {
      process.stdout.write(chalk.yellow('  Authorization timed out.\n'));
      process.stdout.write(chalk.dim('  Try: helixmind login --api-key <key>\n\n'));
    } else {
      process.stdout.write(chalk.red(`  Login failed: ${msg}\n\n`));
    }
    return false;
  }
}

/**
 * Poll the device-code endpoint until authorized or expired.
 */
async function pollDeviceCode(
  webappUrl: string,
  code: string,
  pollSecret: string,
  intervalSec: number,
  signal: AbortSignal,
): Promise<{ apiKey: string; email?: string; plan?: string; userId?: string }> {
  const pollUrl = `${webappUrl}/api/auth/device/poll?code=${encodeURIComponent(code)}&secret=${encodeURIComponent(pollSecret)}`;

  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
    if (signal.aborted) break;

    try {
      const res = await fetch(pollUrl, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) {
        // 410 = expired
        if (res.status === 410) throw new Error('Device code expired');
        continue;
      }

      const data = (await res.json()) as {
        status: 'pending' | 'authorized' | 'expired';
        apiKey?: string;
        email?: string;
        plan?: string;
        userId?: string;
      };

      if (data.status === 'authorized' && data.apiKey) {
        return { apiKey: data.apiKey, email: data.email, plan: data.plan, userId: data.userId };
      }
      if (data.status === 'expired') {
        throw new Error('Device code expired');
      }
      // status === 'pending' → continue polling
    } catch (err) {
      if (signal.aborted) break;
      if (err instanceof Error && err.message.includes('expired')) throw err;
      // Network hiccup — retry
    }
  }

  throw new Error('Device code polling cancelled');
}

function showSuccessBox(email?: string, plan?: string, apiKey?: string): void {
  const masked = apiKey ? ConfigStore.maskKey(apiKey) : '***';
  const w = 50;
  const line = '\u2500'.repeat(w);

  process.stdout.write('\n');
  process.stdout.write(chalk.dim(`\u256D${line}\u256E`) + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + chalk.green('\u2713 HelixMind \u2014 Connected') + ' '.repeat(w - 26) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + `Account: ${email ?? 'connected'}`.padEnd(w - 4) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + `Plan:    ${plan ?? 'FREE'}`.padEnd(w - 4) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + `API Key: ${masked}`.padEnd(w - 4) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim(`\u251C${line}\u2524`) + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + theme.primary('\u{1F310} Remote Access active') + ' '.repeat(w - 26) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + chalk.gray('Open the dashboard on any device to control').padEnd(w - 4) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + chalk.gray('this CLI \u2014 phone, tablet, another PC.').padEnd(w - 4) + chalk.dim('\u2502') + '\n');
  process.stdout.write(chalk.dim(`\u2570${line}\u256F`) + '\n\n');
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
    if (data.plan) {
      const verifiedPlan = data.plan === 'FREE' ? 'FREE_PLUS' : data.plan;
      store.set('relay.plan', verifiedPlan);
    }

    const effectivePlan = (data.plan && data.plan !== 'FREE') ? data.plan : 'FREE_PLUS';
    return {
      loggedIn: true,
      email: data.email ?? auth.email,
      plan: effectivePlan,
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
