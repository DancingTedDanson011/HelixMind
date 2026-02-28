import chalk from 'chalk';
import { execSync } from 'node:child_process';

export interface StatusBarData {
  spiral: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    l5: number;
    l6: number;
  };
  sessionTokens: number;
  tokens: {
    thisMessage: number;
    thisSession: number;
  };
  tools: {
    callsThisRound: number;
  };
  model: string;
  git: {
    branch: string;
    uncommitted: number;
  };
  checkpoints?: number;
  permissionMode?: 'safe' | 'skip' | 'yolo';
  autonomous?: boolean;
  paused?: boolean;
}

/**
 * Render the statusbar string (single line, colored).
 * Truncates to maxWidth to prevent line wrapping in the terminal.
 */
export function renderStatusBar(data: StatusBarData, maxWidth?: number): string {
  const termWidth = maxWidth ?? ((process.stdout.columns || 80) - 2);

  // Build parts with priority — high priority parts are kept, low priority dropped first
  const essentialParts: string[] = [];
  const optionalParts: string[] = [];

  // [Essential] Spiral counts — compact format for narrow terminals
  const spiralStr = termWidth < 80
    ? '\u{1F300} ' + chalk.cyan(`${data.spiral.l1}`) + chalk.dim('/') +
      chalk.green(`${data.spiral.l2}`) + chalk.dim('/') +
      chalk.hex('#FFAA00')(`${data.spiral.l3}`)
    : '\u{1F300} ' +
      chalk.cyan(`L1:${data.spiral.l1}`) + ' ' +
      chalk.green(`L2:${data.spiral.l2}`) + ' ' +
      chalk.hex('#FFAA00')(`L3:${data.spiral.l3}`) + ' ' +
      chalk.blue(`L4:${data.spiral.l4}`) + ' ' +
      chalk.magenta(`L5:${data.spiral.l5}`) + ' ' +
      chalk.hex('#00d4ff')(`L6:${data.spiral.l6}`);
  essentialParts.push(spiralStr);

  // [Essential] Token bar — shorter on narrow terminals
  essentialParts.push(renderTokenBar(data.sessionTokens, termWidth < 80));

  // [Essential] Autonomous / Paused indicator
  if (data.autonomous) {
    essentialParts.push(chalk.hex('#ff6600')('\u{1F504} AUTO'));
  } else if (data.paused) {
    essentialParts.push(chalk.yellow('\u23F8 PAUSED'));
  }

  // [Optional] Checkpoint count
  if (data.checkpoints !== undefined && data.checkpoints > 0) {
    optionalParts.push(`\u{1F551} ${data.checkpoints} ckpts`);
  }

  // [Essential] Tokens
  essentialParts.push(`\u26A1 ${formatTokens(data.tokens.thisMessage)} tok`);

  // [Optional] Tools (only show if > 0)
  if (data.tools.callsThisRound > 0) {
    optionalParts.push(`\u{1F527} ${data.tools.callsThisRound} tools`);
  }

  // [Essential] Permission mode
  if (data.permissionMode) {
    switch (data.permissionMode) {
      case 'safe':  essentialParts.push(chalk.green('\u{1F6E1} safe')); break;
      case 'skip':  essentialParts.push(chalk.yellow('\u26A1 skip')); break;
      case 'yolo':  essentialParts.push(chalk.red('\u{1F525} yolo')); break;
    }
  }

  // [Essential] Model (shortened)
  essentialParts.push(chalk.dim(shortenModelName(data.model)));

  // [Optional] Git
  if (data.git.branch) {
    const gitColor = data.git.uncommitted > 0 ? chalk.yellow : chalk.green;
    const gitInfo = data.git.uncommitted > 0
      ? `${data.git.branch} \u2191${data.git.uncommitted}`
      : data.git.branch;
    optionalParts.push(gitColor(gitInfo));
  }

  // [Optional] Time
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  optionalParts.push(chalk.dim(time));

  // Assemble: start with essential parts, add optional until we'd overflow
  const sep = chalk.dim(' \u2502 ');
  let result = essentialParts.join(sep);
  for (const part of optionalParts) {
    const candidate = result + sep + part;
    if (visibleLength(candidate) > termWidth) break;
    result = candidate;
  }

  // Final safety: hard truncate if still too wide (emoji width variance)
  return truncateBar(result, termWidth);
}

/**
 * Write the statusbar to the bottom of the terminal.
 * Layout (from bottom):
 *   row N   = statusbar (spiral counts, tokens, model, git)
 *   row N-1 = hint line (permission mode · shortcuts)
 *   row N-2 = lower input frame line └───┘
 * The upper frame line ┌───┐ + prompt │ ❯ are handled by readline (prompt string).
 */
/**
 * Pin statusbar to the bottom row of the terminal.
 * Uses save/restore cursor so the caller's cursor position is preserved.
 * Only draws 1 row (the status bar) — separator + hint are drawn inline by showPrompt().
 */
export function writeStatusBar(data: StatusBarData): void {
  const termHeight = process.stdout.rows || 24;
  const termWidth = (process.stdout.columns || 80) - 2;
  const bar = renderStatusBar(data, termWidth);

  // Save cursor, draw bottom row, restore cursor
  process.stdout.write(
    `\x1b7` +                         // Save cursor
    `\x1b[${termHeight};0H` +        // Move to row N
    `\x1b[2K` +                       // Clear line
    ` ${bar}` +                        // Status bar
    `\x1b8`,                           // Restore cursor
  );
}

/**
 * Write status info as normal inline text (scrolls with content).
 * Safe to call while readline is active — no cursor jumping.
 * Shows: hint line + status bar as two regular lines.
 */
export function writeStatusInline(data: StatusBarData): void {
  const termWidth = (process.stdout.columns || 80) - 2;
  const bar = renderStatusBar(data, termWidth);

  // Hint line
  const hints: string[] = [];
  if (data.permissionMode === 'yolo') hints.push(chalk.red('\u25B8\u25B8 yolo mode'));
  else if (data.permissionMode === 'skip') hints.push(chalk.yellow('\u25B8\u25B8 skip permissions'));
  else hints.push(chalk.green('\u25B8\u25B8 safe permissions'));
  hints.push(chalk.dim('esc = stop'));
  hints.push(chalk.dim('/help'));
  const hintLine = ' ' + hints.join(chalk.dim(' \u00B7 '));

  process.stdout.write(`${hintLine}\n ${bar}\n`);
}

/**
 * Get current git info (branch + uncommitted count).
 */
export function getGitInfo(projectRoot: string): { branch: string; uncommitted: number } {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const status = execSync('git status --short', {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const uncommitted = status ? status.split('\n').length : 0;
    return { branch, uncommitted };
  } catch {
    return { branch: '', uncommitted: 0 };
  }
}

// Scale tiers — bar fills up, then jumps to next tier
const SCALE_TIERS = [
  100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000,
  10_000_000, 25_000_000, 50_000_000, 100_000_000,
];

function getScale(tokens: number): number {
  for (const tier of SCALE_TIERS) {
    if (tokens < tier) return tier;
  }
  // Beyond 100M — round up to next 100M
  return Math.ceil(tokens / 100_000_000) * 100_000_000;
}

const BAR_WIDTH = 10;
const FILLED = '\u2588'; // █
const EMPTY = '\u2591';  // ░

function renderTokenBar(tokens: number, compact: boolean = false): string {
  const scale = getScale(tokens);
  const ratio = Math.min(tokens / scale, 1);
  const width = compact ? 5 : BAR_WIDTH;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  // Color based on fill ratio
  const barColor = ratio < 0.5 ? chalk.cyan
    : ratio < 0.75 ? chalk.green
    : ratio < 0.9 ? chalk.yellow
    : chalk.hex('#FF6600');

  const bar = barColor(FILLED.repeat(filled)) + chalk.dim(EMPTY.repeat(empty));
  const label = formatTokens(tokens) + '/' + formatTokens(scale) + ' tk';

  return bar + ' ' + barColor(label);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function shortenModelName(model: string): string {
  const map: Record<string, string> = {
    'claude-sonnet-4-6': 'sonnet-4.6',
    'claude-opus-4-6': 'opus-4.6',
    'claude-haiku-4-5-20251001': 'haiku-4.5',
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': '4o-mini',
    'gpt-4-turbo': '4-turbo',
    'deepseek-chat': 'ds-chat',
    'deepseek-reasoner': 'ds-r1',
    'glm-5': 'GLM-5',
    'glm-4.7': 'GLM-4.7',
    'glm-4.6': 'GLM-4.6',
    'glm-4.5': 'GLM-4.5',
  };
  if (map[model]) return map[model];
  // Auto-shorten: strip common prefixes, truncate long names
  let short = model
    .replace('claude-', '')
    .replace('gpt-', '')
    .replace('deepseek-', 'ds-')
    .replace('qwen2.5-coder:', 'qwen2.5:')
    .replace('qwen3-coder:', 'qwen3:')
    .replace('meta-llama/', '')
    .replace('anthropic/', '')
    .replace('openai/', '')
    .replace('google/', '');
  // Hard cap at 16 chars
  if (short.length > 16) short = short.slice(0, 15) + '\u2026';
  return short;
}

/** Strip ANSI escape codes to measure visible string width */
export function visibleLength(str: string): number {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\].*?\x07/g, '').length;
}

/** Truncate a styled string to fit within maxWidth visible characters */
export function truncateBar(bar: string, maxWidth: number): string {
  const visible = visibleLength(bar);
  if (visible <= maxWidth) return bar;
  // Strip from the end, keeping ANSI reset
  let result = '';
  let width = 0;
  let inEscape = false;
  for (let i = 0; i < bar.length; i++) {
    const ch = bar[i];
    if (ch === '\x1b') { inEscape = true; result += ch; continue; }
    if (inEscape) { result += ch; if (ch === 'm') inEscape = false; continue; }
    if (width >= maxWidth - 1) { result += '\u2026'; break; }
    result += ch;
    width++;
  }
  return result + '\x1b[0m'; // reset colors
}
