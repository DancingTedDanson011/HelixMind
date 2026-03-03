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
  plan?: string;
  jarvisName?: string;
  currentStep?: string;
  currentFile?: string;
  runtime?: number; // seconds
  sectionTimer?: { section: string; seconds: number };
  totalTimer?: number; // seconds
}

// Standard CMD width is 80 chars — use 78 to leave margin
const CMD_STANDARD_WIDTH = 78;

/**
 * Render the statusbar — adaptive: 1 line when content fits terminal width,
 * splits into 2 lines only when it would overflow.
 * Always returns "line1\nline2" — line2 is empty when single-line mode.
 *
 * Content: Brain | Context | Model | Perm | ⚡msg | 🔧tools | 🕐cp | git | runtime | step | ⏱total | clock
 */
export function renderStatusBar(data: StatusBarData, maxWidth?: number): string {
  const width = maxWidth ?? CMD_STANDARD_WIDTH;
  const sep = chalk.dim(' \u2502 ');

  // === Build all parts ===
  const parts: string[] = [];

  // Brain growth
  parts.push(renderBrainGrowthBar(data.spiral, true));

  // Context tokens
  parts.push(renderTokenBar(data.sessionTokens, true));

  // Model
  parts.push(chalk.dim(shortenModelName(data.model)));

  // Permission mode
  if (data.permissionMode) {
    switch (data.permissionMode) {
      case 'safe':  parts.push(chalk.green('\u{1F6E1}')); break;
      case 'skip':  parts.push(chalk.yellow('\u26A1')); break;
      case 'yolo':  parts.push(chalk.red('\u{1F525}')); break;
    }
  }

  // Message tokens
  parts.push(`\u26A1${formatTokens(data.tokens.thisMessage)}`);

  // Tool calls (always show)
  parts.push(`\u{1F527}${data.tools.callsThisRound}`);

  // Checkpoints (always show)
  parts.push(`\u{1F551}${data.checkpoints ?? 0}`);

  // Git
  if (data.git.branch) {
    const gitColor = data.git.uncommitted > 0 ? chalk.yellow : chalk.green;
    const gitInfo = data.git.uncommitted > 0
      ? `${data.git.branch}\u2191${data.git.uncommitted}`
      : data.git.branch;
    parts.push(gitColor(gitInfo));
  }

  // Runtime (during agent work)
  if (data.runtime !== undefined) {
    parts.push(chalk.dim(formatRuntime(data.runtime)));
  }

  // Current step (during agent work)
  if (data.currentStep) {
    let stepInfo = data.currentStep;
    if (data.currentFile) {
      const shortFile = data.currentFile.length > 20
        ? '...' + data.currentFile.slice(-17)
        : data.currentFile;
      stepInfo += ` ${chalk.dim(shortFile)}`;
    }
    parts.push(chalk.cyan(stepInfo));
  }

  // Section timer
  if (data.sectionTimer) {
    parts.push(chalk.hex('#FF6B9D')(data.sectionTimer.section) + chalk.dim(`:${formatRuntime(data.sectionTimer.seconds)}`));
  }

  // Total session timer
  if (data.totalTimer !== undefined) {
    parts.push(chalk.hex('#00D4FF')(`\u23F1${formatRuntime(data.totalTimer)}`));
  }

  // Clock
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  parts.push(chalk.dim(time));

  // === Adaptive layout: try single line first ===
  const singleLine = parts.join(sep);
  if (visibleLength(singleLine) <= width) {
    return truncateBar(singleLine, width) + '\n';
  }

  // === Overflow: split into 2 lines ===
  // Line 1: core metrics (brain, context, model, perm, tokens, tools, checkpoints)
  // Line 2: dynamic info (git, runtime, step, timers, clock)
  const coreParts = parts.slice(0, 7);  // brain..checkpoints
  const dynParts = parts.slice(7);       // git..clock

  const line1 = truncateBar(coreParts.join(sep), width);
  const line2 = truncateBar(dynParts.join(sep), width);

  return line1 + '\n' + line2;
}

/**
 * Write the statusbar (1 or 2 lines) to the bottom of the terminal.
 */
export function writeStatusBar(data: StatusBarData): void {
  const termHeight = process.stdout.rows || 24;
  const termWidth = (process.stdout.columns || 80) - 2;
  const bar = renderStatusBar(data, termWidth);
  const [line1, line2] = bar.split('\n');

  // Save cursor, draw 2 bottom rows, restore cursor
  process.stdout.write(
    `\x1b7` +                         // Save cursor
    `\x1b[${termHeight - 1};0H` +    // Move to row N-1
    `\x1b[2K` +                       // Clear line
    '\x1b[K' +                        // Clear to end (for safety)
    ` ${line1}` +                     // Line 1
    `\x1b[${termHeight};0H` +        // Move to row N
    `\x1b[2K` +                       // Clear line
    '\x1b[K' +
    (line2 ? ` ${line2}` : '') +      // Line 2 (empty when single-line)
    `\x1b8`,                          // Restore cursor
  );
}

/**
 * Write status info as normal inline text (scrolls with content).
 * Shows statusbar (1 or 2 lines) + hint line.
 */
export function writeStatusInline(data: StatusBarData): void {
  const termWidth = (process.stdout.columns || 80) - 2;
  const bar = renderStatusBar(data, termWidth);
  const [line1, line2] = bar.split('\n');

  // Hint line
  const hints: string[] = [];
  if (data.permissionMode === 'yolo') hints.push(chalk.red('\u25B8\u25B8 yolo'));
  else if (data.permissionMode === 'skip') hints.push(chalk.yellow('\u25B8\u25B8 skip'));
  else hints.push(chalk.green('\u25B8\u25B8 safe'));
  hints.push(chalk.dim('esc=stop'));
  hints.push(chalk.dim('/help'));
  const hintLine = ' ' + hints.join(chalk.dim(' \u00B7 '));

  const statusOutput = line2 ? ` ${line1}\n ${line2}` : ` ${line1}`;
  process.stdout.write(`${hintLine}\n${statusOutput}\n`);
}

/**
 * Get current git info (branch + uncommitted count).
 * Cached for 10 seconds to avoid spawning 240+ git processes per minute
 * during agent work when the footer timer calls getStatusBarData() every 500ms.
 */
let gitCache: { branch: string; uncommitted: number } | null = null;
let gitCacheTime = 0;
const GIT_CACHE_TTL = 10_000;

export function getGitInfo(projectRoot: string): { branch: string; uncommitted: number } {
  const now = Date.now();
  if (gitCache && (now - gitCacheTime) < GIT_CACHE_TTL) return gitCache;
  try {
    const branch = execSync('git branch --show-current', {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const status = execSync('git status --short', {
      cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const uncommitted = status ? status.split('\n').length : 0;
    gitCache = { branch, uncommitted };
    gitCacheTime = now;
    return gitCache;
  } catch {
    return { branch: '', uncommitted: 0 };
  }
}

/** Force refresh on next call (e.g., after git operations). */
export function invalidateGitCache(): void {
  gitCache = null;
}

// Brain Growth tiers — bar fills up, then jumps to next tier
const BRAIN_GROWTH_TIERS = [
  10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
];

function getBrainScale(totalNodes: number): number {
  for (const tier of BRAIN_GROWTH_TIERS) {
    if (totalNodes < tier) return tier;
  }
  return Math.ceil(totalNodes / 50000) * 50000;
}

/**
 * Render brain growth bar — compact for 80-char width.
 */
function renderBrainGrowthBar(spiral: { l1: number; l2: number; l3: number; l4: number; l5: number; l6: number }, compact: boolean): string {
  const totalNodes = spiral.l1 + spiral.l2 + spiral.l3 + spiral.l4 + spiral.l5 + spiral.l6;
  const scale = getBrainScale(totalNodes);
  const ratio = Math.min(totalNodes / scale, 1);
  const width = compact ? 4 : 6;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  // Color based on brain maturity
  let barColor: (str: string) => string;
  let brainIcon: string;
  
  if (totalNodes < 10) {
    barColor = chalk.dim;
    brainIcon = '\u{1F9E0}';
  } else if (totalNodes < 100) {
    barColor = chalk.cyan;
    brainIcon = '\u{1F9E0}';
  } else if (totalNodes < 500) {
    barColor = chalk.green;
    brainIcon = '\u{1F4AF}';
  } else if (totalNodes < 1000) {
    barColor = chalk.hex('#FF6600');
    brainIcon = '\u{1F525}';
  } else {
    barColor = chalk.hex('#8a2be2');
    brainIcon = '\u{2728}';
  }

  const bar = barColor(FILLED.repeat(filled)) + chalk.dim(EMPTY.repeat(empty));
  const label = `${totalNodes}`;

  return `${brainIcon}${bar}${barColor(label)}`;
}

// Token scale tiers
const SCALE_TIERS = [
  100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000,
  10_000_000, 25_000_000, 50_000_000, 100_000_000,
];

function getScale(tokens: number): number {
  for (const tier of SCALE_TIERS) {
    if (tokens < tier) return tier;
  }
  return Math.ceil(tokens / 100_000_000) * 100_000_000;
}

const FILLED = '\u2588';
const EMPTY = '\u2591';

function renderTokenBar(tokens: number, compact: boolean = false): string {
  const scale = getScale(tokens);
  const ratio = Math.min(tokens / scale, 1);
  const width = compact ? 4 : 6;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const barColor = ratio < 0.5 ? chalk.cyan
    : ratio < 0.75 ? chalk.green
    : ratio < 0.9 ? chalk.yellow
    : chalk.hex('#FF6600');

  const bar = barColor(FILLED.repeat(filled)) + chalk.dim(EMPTY.repeat(empty));
  const label = formatTokens(tokens);

  return `ctx${bar}${barColor(label)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function formatRuntime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m${secs}s`;
}

function shortenModelName(model: string): string {
  const map: Record<string, string> = {
    'claude-sonnet-4-6': 'sonnet',
    'claude-opus-4-6': 'opus',
    'claude-haiku-4-5-20251001': 'haiku',
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': '4o-mini',
    'gpt-4-turbo': '4-turbo',
    'deepseek-chat': 'ds',
    'deepseek-reasoner': 'ds-r1',
    'glm-5': 'GLM-5',
    'glm-5-code': 'GLM-5C',
    'glm-4.7': 'GLM-4.7',
    'glm-4.7-flashx': 'GLM-FX',
    'glm-4.7-flash': 'GLM-F',
    'glm-4.6': 'GLM-4.6',
    'glm-4.5': 'GLM-4.5',
  };
  if (map[model]) return map[model];
  let short = model
    .replace('claude-', '')
    .replace('gpt-', '')
    .replace('deepseek-', 'ds-')
    .replace('qwen2.5-coder:', 'qwen:')
    .replace('qwen3-coder:', 'qwen3:');
  if (short.length > 12) short = short.slice(0, 11) + '\u2026';
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
  return result + '\x1b[0m';
}
