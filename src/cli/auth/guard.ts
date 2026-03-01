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

  // ─── Choice Screen ─────────────────────────────────────────
  w('\n');
  w(d('  ╭────────────────────────────────────────────────────────────╮') + '\n');
  w(d('  │  ') + p('🌀 Welcome to HelixMind') + d('                                   │') + '\n');
  w(d('  │                                                            │') + '\n');

  // Option 1: Login (FREE+) — the recommended choice
  w(d('  │  ') + g('★') + chalk.white.bold(' [1] Login') + d(' — free, unlock everything') + d('                   │') + '\n');
  w(d('  │                                                            │') + '\n');
  w(d('  │      ') + g('✓') + ' Jarvis AGI' + d(' — autonomous coding agent              │') + '\n');
  w(d('  │      ') + g('✓') + ' Validation Matrix' + d(' — auto-checks your code          │') + '\n');
  w(d('  │      ') + g('✓') + ' Security Monitor' + d(' — continuous vulnerability scan   │') + '\n');
  w(d('  │      ') + g('✓') + ' Autonomous Mode' + d(' — finds & fixes issues on its own  │') + '\n');
  w(d('  │      ') + g('✓') + ' 3D Brain Management' + d(' — visualize your knowledge      │') + '\n');
  w(d('  │      ') + g('✓') + ' 3 Brains' + d(' (1 global + 2 local)                      │') + '\n');
  w(d('  │      ') + g('✓') + ' Live Brain WebSocket' + d(' — real-time visualization      │') + '\n');
  w(d('  │                                                            │') + '\n');
  w(d('  │      ') + dim('One-time setup — works offline afterwards.') + d('        │') + '\n');
  w(d('  │      ') + dim('No credit card. No trial. Free forever.') + d('           │') + '\n');
  w(d('  │                                                            │') + '\n');

  // Divider
  w(d('  │  ') + d('──────────────────────────────────────────────────────') + d('  │') + '\n');
  w(d('  │                                                            │') + '\n');

  // Option 2: Open Source — limited but functional
  w(d('  │  ') + chalk.white.bold('  [2] Open Source') + d(' — no account needed') + d('                    │') + '\n');
  w(d('  │                                                            │') + '\n');
  w(d('  │      ') + dim('✓ AI Agent + 22 Tools') + d('                                │') + '\n');
  w(d('  │      ') + dim('✓ Spiral Memory (1 local brain)') + d('                      │') + '\n');
  w(d('  │      ') + dim('✓ All providers (Anthropic/OpenAI/Ollama)') + d('             │') + '\n');
  w(d('  │                                                            │') + '\n');
  w(d('  │      ') + chalk.red('✗') + dim(' No Jarvis · No Validation · No Monitor') + d('          │') + '\n');
  w(d('  │      ') + chalk.red('✗') + dim(' No Brain Management · No Security Audit') + d('         │') + '\n');
  w(d('  │                                                            │') + '\n');
  w(d('  ╰────────────────────────────────────────────────────────────╯') + '\n\n');

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
  w(d('  ') + p('▸') + d(' Open Source mode — full agent, no limits.\n'));
  w(d('  Run ') + chalk.white('helixmind login') + d(' anytime to unlock Jarvis AGI + more.\n\n'));

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

    rl.question(d('  ') + g('→') + ' Choose ' + chalk.white.bold('[1]') + d('/2') + d(': '), (answer) => {
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
