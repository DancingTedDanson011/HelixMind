import * as readline from 'node:readline';
import chalk from 'chalk';
import { theme } from '../ui/theme.js';
import { selectMenu, confirmMenu } from '../ui/select-menu.js';
import { ConfigStore } from '../config/store.js';
import { createProvider, KNOWN_PROVIDERS, isModelFree } from '../providers/registry.js';
import type { LLMProvider } from '../providers/types.js';

const PROVIDER_LABELS: Record<string, string> = {
  zai: 'Z.AI (GLM-5)',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
};

const PROVIDER_LIST = Object.entries(KNOWN_PROVIDERS).map(([name, info]) => ({
  name,
  label: PROVIDER_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1),
  needsKey: name !== 'ollama', // Ollama runs locally, no key needed
}));

/**
 * Ask a single text question. Uses readline.question() which handles stdin
 * correctly across platforms (especially Windows after selectMenu raw-mode cycles).
 * When an existing rl is provided, it is temporarily resumed for the question.
 * When no rl is provided (e.g. first-time setup), a temporary readline is created.
 */
function askText(prompt: string, rl?: readline.Interface): Promise<string> {
  const ownRl = !rl;
  let wasRaw = false;
  let useRl: readline.Interface;

  if (ownRl) {
    // Create a new readline instance with terminal:false to avoid raw mode issues
    useRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // Avoid raw mode issues on Windows
    });
    // Ensure stdin is not in raw mode (Windows)
    wasRaw = process.stdin.isTTY && process.stdin.isRaw;
    if (wasRaw) {
      process.stdin.setRawMode(false);
    }
  } else {
    // Use the provided readline instance, assume caller manages raw mode
    useRl = rl!;
  }

  return new Promise(resolve => {
    let resolved = false;

    function done(answer: string): void {
      if (resolved) return;
      resolved = true;
      useRl.removeListener('SIGINT', onSigint);
      if (ownRl) {
        useRl.close();
        // Restore raw mode if we changed it
        if (wasRaw) {
          process.stdin.setRawMode(true);
        }
      } else {
        useRl.pause();
      }
      resolve(answer);
    }

    function onSigint(): void {
      process.stdout.write('\n');
      done('');
    }

    useRl.once('SIGINT', onSigint);
    if (!ownRl) useRl.resume();

    useRl.question(prompt, (answer) => done(answer));
  });
}

/**
 * First-time setup: prompt for API key when none is configured.
 * Returns true if setup was successful, false if user cancelled.
 */
export async function runFirstTimeSetup(store: ConfigStore): Promise<boolean> {
  process.stdout.write('\n');
  process.stdout.write(chalk.dim('\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + theme.primary('\u{1F300} HelixMind \u2014 First Time Setup') + chalk.dim('             \u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502') + chalk.dim('                                                  \u2502') + '\n');
  process.stdout.write(chalk.dim('\u2502  ') + 'No API key found. Let\'s set one up.' + chalk.dim('           \u2502') + '\n');
  process.stdout.write(chalk.dim('\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F') + '\n\n');

  // Provider selection via arrow keys
  const menuItems = PROVIDER_LIST.map(p => {
    const models = KNOWN_PROVIDERS[p.name].models.slice(0, 2).join(', ');
    return {
      label: p.label,
      description: models,
    };
  });

  process.stdout.write('  Which provider do you want to use?\n');
  process.stdout.write(chalk.dim('  You can add more providers later with /keys') + '\n\n');

  const idx = await selectMenu(menuItems, { title: 'Select Provider', cancelLabel: 'Cancel' });

  if (idx < 0) {
    process.stdout.write(chalk.red('\n  Cancelled.\n'));
    return false;
  }

  const selected = PROVIDER_LIST[idx];

  if (selected.needsKey) {
    process.stdout.write('\n');
    const key = await askText(theme.primary(`  ${selected.label} API Key: `));
    const trimmed = key.trim();
    if (!trimmed) {
      process.stdout.write(chalk.red('  No key provided. Cannot start.\n'));
      return false;
    }
    store.addProvider(selected.name, trimmed);
    process.stdout.write(chalk.green(`  \u2713 ${selected.label} saved (${ConfigStore.maskKey(trimmed)})\n`));
  } else {
    // Ollama — no key needed, just register with dummy key
    store.addProvider(selected.name, 'ollama');
    process.stdout.write(chalk.green(`  \u2713 ${selected.label} configured (local)\n`));
  }

  // Verify key was set
  if (!store.hasApiKey()) {
    process.stdout.write(chalk.red('\n  No API key provided. Cannot start.\n'));
    return false;
  }

  // Show selected config
  const config = store.getAll();
  process.stdout.write('\n');
  process.stdout.write(chalk.green(`  \u2713 Ready! Provider: ${config.provider}, Model: ${config.model}\n`));
  process.stdout.write(chalk.dim(`  Use /model to switch models, /keys to manage API keys\n\n`));

  return true;
}

/** Fetch installed Ollama models from the local Ollama server */
async function fetchOllamaModels(): Promise<{ name: string; size: number }[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json() as { models?: Array<{ name: string; size: number }> };
    return (data.models ?? []).map(m => ({ name: m.name, size: m.size ?? 0 }));
  } catch {
    return [];
  }
}

/** Format bytes to human-readable size */
function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

/**
 * Interactive model switcher. Shows all providers + models, lets user pick.
 * Always auto-detects Ollama if running locally, even without prior registration.
 */
export async function showModelSwitcher(
  store: ConfigStore,
  rl?: readline.Interface,
): Promise<{ provider: string; model: string } | null> {
  const config = store.getAll();
  const providers = store.getProviders();

  const options: Array<{ provider: string; model: string }> = [];
  const menuItems: Array<{ label: string; marker?: string; disabled?: boolean; description?: string }> = [];

  // Always try to detect Ollama — even if not registered
  const ollamaLiveModels = await fetchOllamaModels();
  const ollamaDetected = ollamaLiveModels.length > 0;

  // Show registered cloud providers first (skip ollama — handled separately below)
  for (const p of providers) {
    if (p.name === 'ollama') continue; // Handled in local section
    for (const model of p.entry.models) {
      const isCurrent = p.name === config.provider && model === config.model;
      const freeTag = isModelFree(model) ? chalk.green(' [FREE]') : '';
      options.push({ provider: p.name, model });
      menuItems.push({
        label: `${p.name} / ${model}${freeTag}`,
        marker: isCurrent ? chalk.green('\u25C0 current') : undefined,
      });
    }
  }

  // Show locally installed Ollama models
  if (ollamaDetected) {
    if (menuItems.length > 0) {
      menuItems.push({ label: '', disabled: true });
      options.push({ provider: '', model: '' });
    }
    menuItems.push({ label: chalk.hex('#00ff88').bold(`\u{1F4BB} Local Models (Ollama \u2014 ${ollamaLiveModels.length} installed)`), disabled: true });
    options.push({ provider: '', model: '' });

    for (const m of ollamaLiveModels) {
      const isCurrent = config.provider === 'ollama' && config.model === m.name;
      const size = formatSize(m.size);
      options.push({ provider: 'ollama', model: m.name });
      menuItems.push({
        label: `ollama / ${m.name}`,
        description: size ? chalk.dim(size) : undefined,
        marker: isCurrent ? chalk.green('\u25C0 current') : undefined,
      });
    }
  }

  // Always add "Add new provider" option at the end
  if (menuItems.length > 0) {
    menuItems.push({ label: '', disabled: true });
    options.push({ provider: '', model: '' });
  }
  const addProviderIdx = options.length;
  menuItems.push({ label: chalk.hex('#00d4ff').bold('\u2795 Add new provider / API key'), description: 'Configure a new model provider' });
  options.push({ provider: '__add__', model: '' });

  if (options.length === 1) {
    // Only the "add" option exists — no models configured
    process.stdout.write(chalk.dim('\n  No models available. Add a provider or start Ollama.\n\n'));
  }

  process.stdout.write('\n');
  const idx = await selectMenu(menuItems, { title: 'Switch Model', cancelLabel: 'Cancel' });

  if (idx < 0) {
    process.stdout.write(chalk.dim('\n  Cancelled.\n\n'));
    return null;
  }

  const selected = options[idx];
  if (!selected.model && selected.provider !== '__add__') return null; // Header/separator row

  // "Add new provider" selected — open key management
  if (selected.provider === '__add__') {
    await showKeyManagement(store, rl);
    return null;
  }

  if (selected.provider === 'ollama') {
    // Auto-register Ollama and switch
    store.addProvider('ollama', 'ollama', 'http://localhost:11434/v1');
    store.switchProvider('ollama', selected.model);
  } else {
    store.switchProvider(selected.provider, selected.model);
  }
  process.stdout.write(chalk.green(`\n  \u2713 Switched to ${selected.provider} / ${selected.model}\n\n`));
  return selected;
}

/**
 * Key management UI: add, remove, update API keys.
 */
export async function showKeyManagement(
  store: ConfigStore,
  rl?: readline.Interface,
): Promise<void> {
  const providers = store.getProviders();

  process.stdout.write('\n');
  process.stdout.write(theme.bold('  \u{1F511} API Key Management') + '\n');
  process.stdout.write(theme.separator + '\n\n');

  // Show stored keys
  if (providers.length > 0) {
    process.stdout.write('  Stored providers:\n');
    for (const p of providers) {
      const marker = p.active ? chalk.green(' \u25C0 active') : '';
      const url = p.entry.baseURL ? chalk.dim(` (${p.entry.baseURL})`) : '';
      process.stdout.write(`    ${theme.primary(p.name.padEnd(12))} ${chalk.dim(ConfigStore.maskKey(p.entry.apiKey))}${url}${marker}\n`);
    }
    process.stdout.write('\n');
  } else {
    process.stdout.write(chalk.dim('  No providers configured yet.\n\n'));
  }

  // Build menu items
  const menuItems = PROVIDER_LIST.map(p => {
    const existing = providers.find(ep => ep.name === p.name);
    return {
      label: p.label,
      description: existing ? 'update' : undefined,
    };
  });

  // Add delete + back options
  if (providers.length > 0) {
    menuItems.push({ label: 'Delete a provider', description: undefined });
  }

  const idx = await selectMenu(menuItems, { title: 'Add a Provider', cancelLabel: 'Back' });

  if (idx < 0) return;

  // Delete action
  if (providers.length > 0 && idx === PROVIDER_LIST.length) {
    const deleteItems = providers.map(p => ({
      label: p.name,
      marker: p.active ? chalk.green('\u25C0 active') : undefined,
    }));

    process.stdout.write('\n');
    const delIdx = await selectMenu(deleteItems, { title: 'Remove Provider', cancelLabel: 'Cancel' });

    if (delIdx >= 0) {
      const name = providers[delIdx].name;
      const confirmed = await confirmMenu(chalk.yellow(`Remove ${name}?`));
      if (confirmed) {
        store.removeProvider(name);
        process.stdout.write(chalk.green(`  \u2713 ${name} removed\n`));
      } else {
        process.stdout.write(chalk.dim('  Cancelled.\n'));
      }
    }
    process.stdout.write('\n');
    return;
  }

  // Add provider by index
  if (idx >= 0 && idx < PROVIDER_LIST.length) {
    const selected = PROVIDER_LIST[idx];

    if (selected.needsKey) {
      const key = await askText(theme.primary(`\n  ${selected.label} API Key: `), rl);
      if (key.trim()) {
        store.addProvider(selected.name, key.trim());
        store.switchProvider(selected.name);
        process.stdout.write(chalk.green(`  \u2713 ${selected.label} key saved \u2014 switched to ${selected.name} / ${store.getAll().model}\n`));
      }
    } else {
      store.addProvider(selected.name, 'ollama');
      store.switchProvider(selected.name);
      process.stdout.write(chalk.green(`  \u2713 ${selected.label} configured (local) \u2014 switched to ${selected.name}\n`));
    }
  }

  process.stdout.write('\n');
}
