/**
 * Intelligent command suggestion engine.
 * Shows completions as user types slash commands.
 */
import chalk from 'chalk';

export interface CommandDef {
  cmd: string;
  description: string;
}

const COMMANDS: CommandDef[] = [
  { cmd: '/help', description: 'Show all commands' },
  { cmd: '/clear', description: 'Clear conversation history' },
  { cmd: '/model', description: 'Switch LLM model' },
  { cmd: '/keys', description: 'Manage API keys' },
  { cmd: '/brain', description: 'Brain scope & 3D visualization' },
  { cmd: '/brain local', description: 'Switch to project-local brain' },
  { cmd: '/brain global', description: 'Switch to global brain' },
  { cmd: '/spiral', description: 'Show spiral memory status' },
  { cmd: '/feed', description: 'Feed files into spiral' },
  { cmd: '/context', description: 'Show context & embeddings info' },
  { cmd: '/compact', description: 'Trigger spiral evolution' },
  { cmd: '/tokens', description: 'Show token usage & memory' },
  { cmd: '/helix', description: 'Command Center + Brain (auto-start local)' },
  { cmd: '/helixlocal', description: 'Command Center + Brain (local scope)' },
  { cmd: '/helixglobal', description: 'Command Center + Brain (global scope)' },
  { cmd: '/undo', description: 'Undo file changes' },
  { cmd: '/diff', description: 'Show git diff' },
  { cmd: '/git', description: 'Show git status' },
  { cmd: '/project', description: 'Show project info' },
  { cmd: '/export', description: 'Export spiral as ZIP' },
  { cmd: '/yolo', description: 'Toggle YOLO mode' },
  { cmd: '/skip-permissions', description: 'Toggle skip-permissions' },
  { cmd: '/auto', description: 'Autonomous mode \u2014 find & fix issues' },
  { cmd: '/stop', description: 'Stop autonomous mode' },
  { cmd: '/security', description: 'Run security audit (background)' },
  { cmd: '/monitor', description: 'Continuous security monitoring' },
  { cmd: '/connect', description: 'Reconnect brain server for web dashboard' },
  { cmd: '/jarvis', description: 'Start Jarvis daemon' },
  { cmd: '/jarvis task', description: 'Add task to queue' },
  { cmd: '/jarvis tasks', description: 'List all tasks' },
  { cmd: '/jarvis status', description: 'Show task/daemon status' },
  { cmd: '/jarvis stop', description: 'Stop Jarvis daemon' },
  { cmd: '/jarvis pause', description: 'Pause daemon' },
  { cmd: '/jarvis resume', description: 'Resume daemon' },
  { cmd: '/jarvis clear', description: 'Clear completed tasks' },
  { cmd: '/jarvis proposals', description: 'List pending proposals' },
  { cmd: '/jarvis approve', description: 'Approve a proposal' },
  { cmd: '/jarvis deny', description: 'Deny a proposal with reason' },
  { cmd: '/jarvis identity', description: 'Show Jarvis identity + traits' },
  { cmd: '/jarvis autonomy', description: 'Show/set autonomy level' },
  { cmd: '/jarvis think', description: 'Trigger deep thinking cycle' },
  { cmd: '/jarvis schedule', description: 'Add a scheduled task' },
  { cmd: '/jarvis schedules', description: 'List all schedules' },
  { cmd: '/jarvis trigger', description: 'Add an event trigger' },
  { cmd: '/jarvis triggers', description: 'List all triggers' },
  { cmd: '/jarvis projects', description: 'List registered projects' },
  { cmd: '/jarvis project add', description: 'Register a project' },
  { cmd: '/jarvis workers', description: 'Show parallel workers' },
  { cmd: '/jarvis capabilities', description: 'Show all capabilities' },
  { cmd: '/sessions', description: 'List all sessions & tabs' },
  { cmd: '/session close', description: 'Close a session by ID' },
  { cmd: '/session stop', description: 'Stop a running session' },
  { cmd: '/local', description: 'Local LLM setup (Ollama)' },
  { cmd: '/validation', description: 'Validation Matrix status' },
  { cmd: '/validation on', description: 'Enable output validation' },
  { cmd: '/validation off', description: 'Disable output validation' },
  { cmd: '/validation verbose', description: 'Toggle verbose validation' },
  { cmd: '/validation strict', description: 'Toggle strict mode' },
  { cmd: '/validation stats', description: 'Show validation statistics' },
  { cmd: '/bugs', description: 'List all tracked bugs' },
  { cmd: '/bugs open', description: 'Show only open bugs' },
  { cmd: '/bugfix', description: 'Review & fix all open bugs' },
  { cmd: '/browser', description: 'Open browser (optional URL)' },
  { cmd: '/browser close', description: 'Close the browser' },
  { cmd: '/login', description: 'Log in to HelixMind web platform' },
  { cmd: '/logout', description: 'Log out and revoke API key' },
  { cmd: '/whoami', description: 'Show account & plan info' },
  { cmd: '/exit', description: 'Exit HelixMind' },
  { cmd: '/quit', description: 'Exit HelixMind' },
];

/**
 * Get matching command suggestions for a partial input.
 */
export function getSuggestions(partial: string, max = 5): CommandDef[] {
  if (!partial || !partial.startsWith('/') || partial.length < 2) return [];
  const lower = partial.toLowerCase();

  // Don't suggest if it's an exact match
  const exact = COMMANDS.find(c => c.cmd === lower);
  if (exact) return [];

  // Prefix match first
  const prefixed = COMMANDS.filter(c => c.cmd.startsWith(lower));
  if (prefixed.length > 0) return prefixed.slice(0, max);

  // Fuzzy: contains the typed chars (without /)
  const chars = lower.slice(1);
  const fuzzy = COMMANDS.filter(c => c.cmd.slice(1).includes(chars));
  return fuzzy.slice(0, max);
}

/**
 * Get the best single suggestion for Tab completion.
 */
export function getBestCompletion(partial: string): string | null {
  const suggestions = getSuggestions(partial, 1);
  if (suggestions.length === 0) return null;
  return suggestions[0].cmd;
}

/**
 * Write command suggestions as overlay above the bottom chrome.
 * Uses ANSI cursor positioning to avoid disturbing readline.
 * @param chromeRows Number of reserved rows at the bottom (default: 3 for BottomChrome)
 */
export function writeSuggestions(suggestions: CommandDef[], chromeRows: number = 3): void {
  if (suggestions.length === 0) return;
  if (!process.stdout.isTTY) return;

  const termHeight = process.stdout.rows || 24;
  const count = suggestions.length;
  // Suggestions go above the chrome (which occupies the last chromeRows rows)
  const startRow = termHeight - chromeRows - count;

  process.stdout.write('\x1b7'); // Save cursor
  for (let i = 0; i < count; i++) {
    const row = startRow + i;
    const s = suggestions[i];
    const text = `  ${chalk.cyan(s.cmd)} ${chalk.dim('\u2014')} ${chalk.dim(s.description)}`;
    process.stdout.write(`\x1b[${row};0H\x1b[2K${text}`);
  }
  process.stdout.write('\x1b8'); // Restore cursor
}

/**
 * Clear previously rendered suggestions.
 * @param chromeRows Number of reserved rows at the bottom (default: 3 for BottomChrome)
 */
export function clearSuggestions(count: number, chromeRows: number = 3): void {
  if (count === 0) return;
  if (!process.stdout.isTTY) return;

  const termHeight = process.stdout.rows || 24;
  const startRow = termHeight - chromeRows - count;

  process.stdout.write('\x1b7'); // Save cursor
  for (let i = 0; i < count; i++) {
    process.stdout.write(`\x1b[${startRow + i};0H\x1b[2K`);
  }
  process.stdout.write('\x1b8'); // Restore cursor
}
