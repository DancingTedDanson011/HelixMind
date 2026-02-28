#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('helixmind')
  .description('HelixMind – AI Coding CLI with Spiral Context Memory')
  .version('0.1.0');

// Default command: interactive chat
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

// Config commands
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

// Spiral commands
const spiralCmd = program
  .command('spiral')
  .description('Manage spiral context memory');

spiralCmd
  .command('status')
  .description('Show spiral metrics')
  .action(async () => {
    const { spiralStatusCommand } = await import('./commands/spiral.js');
    await spiralStatusCommand();
  });

spiralCmd
  .command('search <query>')
  .description('Search spiral context')
  .action(async (query) => {
    const { spiralSearchCommand } = await import('./commands/spiral.js');
    await spiralSearchCommand(query);
  });

spiralCmd
  .command('compact')
  .description('Trigger spiral compaction')
  .action(async () => {
    const { spiralCompactCommand } = await import('./commands/spiral.js');
    await spiralCompactCommand();
  });

// Feed command
program
  .command('feed [paths...]')
  .description('Feed files/directories into the spiral')
  .option('--deep', 'Deep analysis (slower, more thorough)')
  .option('--quick', 'Quick overview only')
  .option('--watch', 'Watch for changes and update live')
  .action(async (paths, options) => {
    const { feedCommand } = await import('./commands/feed.js');
    await feedCommand(paths, options);
  });

// Helix command — alias for interactive chat (the main entry point)
program
  .command('helix')
  .description('Start HelixMind interactive session (alias for chat)')
  .option('--yolo', 'Auto-approve ALL operations (no confirmations)')
  .option('-s, --skip-permissions', 'Skip permission prompts (dangerous still asks)')
  .action(async (options) => {
    const { chatCommand } = await import('./commands/chat.js');
    await chatCommand(options);
  });

// Export/Import commands
program
  .command('export [output-dir]')
  .description('Export spiral data to a .helixmind.zip archive')
  .option('-n, --name <name>', 'Project name', 'HelixMind Project')
  .action(async (outputDir, options) => {
    const { exportCommand } = await import('./commands/archive.js');
    await exportCommand(outputDir, options);
  });

program
  .command('import <zip-file>')
  .description('Import spiral data from a .helixmind.zip archive')
  .option('--replace', 'Replace existing data (default: merge)')
  .action(async (zipFile, options) => {
    const { importCommand } = await import('./commands/archive.js');
    await importCommand(zipFile, options);
  });

// Init command
program
  .command('init')
  .description('Initialize HelixMind in current project')
  .action(async () => {
    const { initCommand } = await import('./commands/init.js');
    initCommand();
  });

// Bench commands — SWE-bench benchmarking
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
  .action(async (options) => {
    const { benchRunCommand } = await import('./commands/bench.js');
    await benchRunCommand(options);
  });

benchCmd
  .command('results')
  .description('Show results from latest or specified run')
  .option('--run <id>', 'Specific run ID')
  .option('--format <type>', 'Output format: table or json', 'table')
  .action(async (options) => {
    const { benchResultsCommand } = await import('./commands/bench.js');
    await benchResultsCommand(options);
  });

benchCmd
  .command('compare')
  .description('Compare metrics across benchmark runs')
  .option('--runs <ids>', 'Comma-separated run IDs')
  .action(async (options) => {
    const { benchCompareCommand } = await import('./commands/bench.js');
    await benchCompareCommand(options);
  });

benchCmd
  .command('list')
  .description('List all past benchmark runs')
  .action(async () => {
    const { benchListCommand } = await import('./commands/bench.js');
    await benchListCommand();
  });

program.parse();
