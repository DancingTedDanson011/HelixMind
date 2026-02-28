#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('helixmind')
  .description('HelixMind \u2013 AI Coding CLI with Spiral Context Memory')
  .version('0.1.0');

// ─── Helper: auth guard wrapper ────────────────────────────────
// Wraps a command action so it requires login first.
// login/logout/whoami/config are exempt.
function guarded<T extends (...args: any[]) => Promise<void>>(fn: T): T {
  return (async (...args: any[]) => {
    const { requireAuth } = await import('./auth/guard.js');
    await requireAuth();
    return fn(...args);
  }) as unknown as T;
}

// Default command: interactive chat
// (has its own auth gate inside chatCommand for the logo-first flow)
program
  .command('chat', { isDefault: true })
  .description('Interactive AI coding agent with spiral context')
  .option('-m, --message <text>', 'Send a single message')
  .option('--yolo', 'Auto-approve ALL operations (no confirmations)')
  .option('-s, --skip-permissions', 'Skip permission prompts (dangerous still asks)')
  .option('--no-validation', 'Disable output validation matrix')
  .option('--validation-verbose', 'Show detailed validation for every check')
  .option('--validation-strict', 'Treat warnings as errors in validation')
  .action(async (options) => {
    const { chatCommand } = await import('./commands/chat.js');
    await chatCommand(options);
  });

// Config commands — exempt from auth (needed to configure before login)
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key, value) => {
    const { configSetCommand } = await import('./commands/config.js');
    configSetCommand(key, value);
  });

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key) => {
    const { configGetCommand } = await import('./commands/config.js');
    configGetCommand(key);
  });

configCmd
  .command('list')
  .description('Show all configuration')
  .action(async () => {
    const { configListCommand } = await import('./commands/config.js');
    configListCommand();
  });

// Spiral commands — require auth
const spiralCmd = program
  .command('spiral')
  .description('Manage spiral context memory');

spiralCmd
  .command('status')
  .description('Show spiral metrics')
  .action(guarded(async () => {
    const { spiralStatusCommand } = await import('./commands/spiral.js');
    await spiralStatusCommand();
  }));

spiralCmd
  .command('search <query>')
  .description('Search spiral context')
  .action(guarded(async (query) => {
    const { spiralSearchCommand } = await import('./commands/spiral.js');
    await spiralSearchCommand(query);
  }));

spiralCmd
  .command('compact')
  .description('Trigger spiral compaction')
  .action(guarded(async () => {
    const { spiralCompactCommand } = await import('./commands/spiral.js');
    await spiralCompactCommand();
  }));

// Feed command — require auth
program
  .command('feed [paths...]')
  .description('Feed files/directories into the spiral')
  .option('--deep', 'Deep analysis (slower, more thorough)')
  .option('--quick', 'Quick overview only')
  .option('--watch', 'Watch for changes and update live')
  .action(guarded(async (paths, options) => {
    const { feedCommand } = await import('./commands/feed.js');
    await feedCommand(paths, options);
  }));

// Helix command — alias for interactive chat (auth gate inside chatCommand)
program
  .command('helix')
  .description('Start HelixMind interactive session (alias for chat)')
  .option('--yolo', 'Auto-approve ALL operations (no confirmations)')
  .option('-s, --skip-permissions', 'Skip permission prompts (dangerous still asks)')
  .action(async (options) => {
    const { chatCommand } = await import('./commands/chat.js');
    await chatCommand(options);
  });

// Export/Import commands — require auth
program
  .command('export [output-dir]')
  .description('Export spiral data to a .helixmind.zip archive')
  .option('-n, --name <name>', 'Project name', 'HelixMind Project')
  .action(guarded(async (outputDir, options) => {
    const { exportCommand } = await import('./commands/archive.js');
    await exportCommand(outputDir, options);
  }));

program
  .command('import <zip-file>')
  .description('Import spiral data from a .helixmind.zip archive')
  .option('--replace', 'Replace existing data (default: merge)')
  .action(guarded(async (zipFile, options) => {
    const { importCommand } = await import('./commands/archive.js');
    await importCommand(zipFile, options);
  }));

// Auth commands — exempt from auth (obviously)
program
  .command('login')
  .description('Authenticate with HelixMind web platform')
  .option('--api-key <key>', 'Use API key directly (skip browser flow)')
  .option('--url <url>', 'Web platform URL')
  .option('--force', 'Re-authenticate even if already logged in')
  .action(async (options) => {
    const { loginCommand } = await import('./commands/auth.js');
    await loginCommand(options);
  });

program
  .command('logout')
  .description('Remove stored authentication')
  .option('--no-revoke', 'Do not revoke the API key on the server')
  .action(async (options) => {
    const { logoutCommand } = await import('./commands/auth.js');
    await logoutCommand(options);
  });

program
  .command('whoami')
  .description('Show current authentication status')
  .action(async () => {
    const { whoamiCommand } = await import('./commands/auth.js');
    await whoamiCommand();
  });

// Init command — require auth
program
  .command('init')
  .description('Initialize HelixMind in current project')
  .action(guarded(async () => {
    const { initCommand } = await import('./commands/init.js');
    initCommand();
  }));

// Bench commands — require auth
const benchCmd = program
  .command('bench')
  .description('SWE-bench benchmark suite');

benchCmd
  .command('run')
  .description('Run SWE-bench benchmark')
  .option('-d, --dataset <variant>', 'Dataset: lite or verified', 'lite')
  .option('-t, --tasks <n>', 'Number of tasks to run', parseInt)
  .option('-m, --model <model>', 'Model to use (overrides config)')
  .option('-p, --provider <name>', 'Provider to use (overrides config)')
  .option('--parallel <n>', 'Concurrent tasks', parseInt)
  .option('--max-iterations <n>', 'Max agent iterations per task', parseInt)
  .option('--timeout <seconds>', 'Per-task timeout in seconds', parseInt)
  .option('--filter <regex>', 'Filter tasks by instance_id regex')
  .option('-o, --output <dir>', 'Output directory')
  .option('--no-cache', 'Redownload dataset')
  .option('--with-spiral', 'Enable Spiral Memory for context-enhanced solving')
  .option('--spiral-mode <mode>', 'Spiral mode: fresh (default) or learning', 'fresh')
  .option('--resume <run-id>', 'Resume a previous run (skip completed tasks)')
  .action(guarded(async (options) => {
    const { benchRunCommand } = await import('./commands/bench.js');
    await benchRunCommand(options);
  }));

benchCmd
  .command('results')
  .description('Show results from latest or specified run')
  .option('--run <id>', 'Specific run ID')
  .option('--format <type>', 'Output format: table or json', 'table')
  .action(guarded(async (options) => {
    const { benchResultsCommand } = await import('./commands/bench.js');
    await benchResultsCommand(options);
  }));

benchCmd
  .command('compare')
  .description('Compare metrics across benchmark runs')
  .option('--runs <ids>', 'Comma-separated run IDs')
  .action(guarded(async (options) => {
    const { benchCompareCommand } = await import('./commands/bench.js');
    await benchCompareCommand(options);
  }));

benchCmd
  .command('list')
  .description('List all past benchmark runs')
  .action(guarded(async () => {
    const { benchListCommand } = await import('./commands/bench.js');
    await benchListCommand();
  }));

program.parse();
