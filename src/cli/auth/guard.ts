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

const w = (s: string) => process.stdout.write(s);
const d = chalk.dim;
const g = chalk.green;
const p = theme.primary;
const dim = chalk.gray;

/**
 * Auth gate that presents two choices:
 *  [1] Login (free account → Jarvis + Brain Management + more)
 *  [2] Open Source (full CLI agent, no account needed)
 *
 * Returns the ConfigStore. If user picks Open Source, store stays at FREE plan.
 * Never exits the process — always lets the user continue.
 */
export async function requireAuth(): Promise<ConfigStore> {
  const configDir = join(homedir(), '.helixmind');
  const store = new ConfigStore(configDir);

  if (store.isLoggedIn()) {
    import('../auth/feature-gate.js')
      .then(({ refreshPlanInfo }) => refreshPlanInfo(store))
      .catch(() => {});
    return store;
  }

  // ─── Choice Screen (compact side-by-side) ──────────────────
  w('\n');
  w(d('  ╭' + '─'.repeat(76) + '╮') + '\n');
  w(d('  │  ') + p('\u{1F300} Welcome to HelixMind') + d(' '.repeat(51) + '│') + '\n');
  w(d('  │' + ' '.repeat(76) + '│') + '\n');
  w(d('  │  ') + 'Login — free, unlock everything' + '     ' + 'Open Source — no account needed' + d(' '.repeat(8) + '│') + '\n');
  w(d('  │' + ' '.repeat(76) + '│') + '\n');
  w(d('  │    ') + g('\u2713') + ' Jarvis Assistant' + ' '.repeat(20) + dim('\u2713 AI Agent + 22 Tools') + d(' '.repeat(13) + '│') + '\n');
  w(d('  │    ') + g('\u2713') + ' Validation Matrix' + ' '.repeat(19) + dim('\u2713 Spiral Memory') + d(' '.repeat(19) + '│') + '\n');
  w(d('  │    ') + g('\u2713') + ' Security Monitor' + ' '.repeat(20) + dim('\u2713 Anthropic/OpenAI/Ollama') + d(' '.repeat(9) + '│') + '\n');
  w(d('  │    ') + g('\u2713') + ' Autonomous Mode' + ' '.repeat(21) + chalk.red('\u2717') + dim(' No Jarvis \u00B7 No Validation') + d(' '.repeat(7) + '│') + '\n');
  w(d('  │    ') + g('\u2713') + ' 3D Brain Management' + ' '.repeat(17) + chalk.red('\u2717') + dim(' No Monitor \u00B7 No Security Audit') + d(' '.repeat(2) + '│') + '\n');
  w(d('  │    ') + g('\u2713') + ' 3 Brains \u00B7 Live Brain WebSocket' + ' '.repeat(5) + chalk.red('\u2717') + dim(' No Brain Management') + d(' '.repeat(13) + '│') + '\n');
  w(d('  │' + ' '.repeat(76) + '│') + '\n');
  w(d('  │    ') + dim('No credit card \u00B7 Free forever \u00B7 works offline') + d(' '.repeat(27) + '│') + '\n');
  w(d('  ╰' + '─'.repeat(76) + '╯') + '\n\n');

  const choice = await promptChoice();

  if (choice === '1') {
    const { loginFlow } = await import('../auth/login.js');
    const loggedIn = await loginFlow(store, {});

    if (!loggedIn) {
      w('\n');
      w(d('  Login cancelled — continuing in ') + p('Open Source') + d(' mode.\n'));
      w(d('  Run ') + chalk.white('helixmind login') + d(' anytime to unlock Jarvis + more.\n\n'));
    }

    return store;
  }

  // Choice 2: Open Source
  w('\n');
  w(d('  ') + p('\u25B8') + d(' Open Source mode — full agent, no limits.\n'));
  w(d('  Run ') + chalk.white('helixmind login') + d(' anytime to unlock Jarvis Assistant + more.\n\n'));

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

    rl.question(d('  ') + g('\u2192') + ' ' + chalk.white.bold('[1]') + ' Login / ' + chalk.white.bold('[2]') + ' Open Source: ', (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === '2') {
        resolve('2');
      } else {
        resolve('1');
      }
    });
  });
}
