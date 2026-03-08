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
  permissionMode?: 'safe' | 'skip' | 'yolo' | 'plan';
  autonomous?: boolean;
  paused?: boolean;
  plan?: string;
  planMode?: boolean;
  jarvisName?: string;
  currentStep?: string;
  currentFile?: string;
  runtime?: number; // seconds
  sectionTimer?: { section: string; seconds: number };
  totalTimer?: number; // seconds
  orchestration?: { active: number; total: number };
  /** Active mode: cli (default), monitor (/auto /security), jarvis (/jarvis) */
  activeMode?: 'cli' | 'monitor' | 'jarvis';
}

// Standard CMD width is 80 chars — use 78 to leave margin
const CMD_STANDARD_WIDTH = 78;

/**
 * Render the statusbar — enterprise-clear with word labels.
 * Adaptive: 1 line when content fits terminal width, splits to 2 on overflow.
 * Always returns "line1\nline2" — line2 is empty when single-line mode.
 *
 * Every metric has a clear label — no cryptic icons without context.
 */
export function renderStatusBar(data: StatusBarData, maxWidth?: number): string {
  const width = maxWidth ?? CMD_STANDARD_WIDTH;
  const sep = chalk.dim(' \u2502 ');

  // === Brain: icon + bar + total + labeled levels ===
  const brainSection = renderBrainSection(data.spiral);

  // === Tokens: bar + session total + (in/out breakdown) ===
  const tokenBar = renderTokenBar(data.sessionTokens);
  const inTok = formatTokens(data.tokens.thisSession - data.tokens.thisMessage);
  const outTok = formatTokens(data.tokens.thisMessage);
  const tokenSection = `${tokenBar} ${chalk.dim('(')}${chalk.dim('in:')}${inTok} ${chalk.dim('out:')}${chalk.bold(outTok)}${chalk.dim(')')}`;

  // === Model + Permission ===
  let permText = '';
  if (data.permissionMode) {
    switch (data.permissionMode) {
      case 'safe':  permText = chalk.green('Safe'); break;
      case 'skip':  permText = chalk.yellow('Skip'); break;
      case 'yolo':  permText = chalk.red('YOLO'); break;
      case 'plan':  permText = chalk.cyan('Plan'); break;
    }
  }
  // Active mode badge: CLI (default), MONITOR, JARVIS — eye-catching with mode colors
  let modeText = '';
  switch (data.activeMode) {
    case 'monitor': modeText = chalk.hex('#FF6B9D').bold(' MONITOR'); break;
    case 'jarvis':  modeText = chalk.hex('#8a2be2').bold(' JARVIS'); break;
    default:        modeText = chalk.hex('#00d4ff').bold(' CLI'); break;
  }

  const modelSection = `${chalk.dim(shortenModelName(data.model))} ${permText}${modeText}`;

  // === Metrics: Tools + Checkpoints (always with labels) ===
  const metricsSection = `${chalk.dim('Tools:')}${data.tools.callsThisRound} ${chalk.dim('CP:')}${data.checkpoints ?? 0}`;

  // === Git ===
  let gitSection = '';
  if (data.git.branch) {
    const gitColor = data.git.uncommitted > 0 ? chalk.yellow : chalk.green;
    gitSection = data.git.uncommitted > 0
      ? gitColor(`${data.git.branch} \u2191${data.git.uncommitted}`)
      : gitColor(data.git.branch);
  }

  // === Live: state + runtime + step + timers + clock ===
  const liveItems: string[] = [];

  if (data.planMode) {
    liveItems.push(chalk.cyan('\u25B8 PLAN'));
  }

  if (data.plan) {
    liveItems.push(chalk.cyan(data.plan.slice(0, 30)));
  }

  if (data.paused) {
    liveItems.push(chalk.yellow('Paused'));
  } else if (data.autonomous) {
    liveItems.push(chalk.hex('#FF6B9D')('Auto'));
  }

  if (data.runtime !== undefined) {
    liveItems.push(chalk.bold(formatRuntime(data.runtime)));
  }

  if (data.currentStep) {
    let stepInfo = data.currentStep;
    if (data.currentFile) {
      const shortFile = data.currentFile.length > 25
        ? '...' + data.currentFile.slice(-22)
        : data.currentFile;
      stepInfo += ` ${chalk.dim(shortFile)}`;
    }
    liveItems.push(chalk.cyan(stepInfo));
  }

  if (data.orchestration && data.orchestration.total > 0) {
    liveItems.push(chalk.hex('#00D4FF')(`Agents: ${data.orchestration.active}/${data.orchestration.total}`));
  }

  if (data.jarvisName) {
    liveItems.push(chalk.hex('#8a2be2')(data.jarvisName));
  }

  if (data.sectionTimer) {
    liveItems.push(chalk.hex('#FF6B9D')(data.sectionTimer.section) + chalk.dim(`:${formatRuntime(data.sectionTimer.seconds)}`));
  }

  if (data.totalTimer !== undefined) {
    liveItems.push(chalk.dim('Session:') + chalk.hex('#00D4FF')(formatRuntime(data.totalTimer)));
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  liveItems.push(chalk.dim(time));

  const liveSection = liveItems.join(' ');

  // === Build sections (skip empty) ===
  const sections: string[] = [brainSection, tokenSection, modelSection, metricsSection];
  if (gitSection) sections.push(gitSection);
  sections.push(liveSection);

  // === Adaptive: single line if fits, else split ===
  const singleLine = sections.join(sep);
  if (visibleLength(singleLine) <= width) {
    return truncateBar(singleLine, width) + '\n';
  }

  // Line 1: brain + tokens + model
  // Line 2: metrics + git + live
  const topSections = [brainSection, tokenSection, modelSection];
  const bottomSections: string[] = [metricsSection];
  if (gitSection) bottomSections.push(gitSection);
  bottomSections.push(liveSection);

  const line1 = truncateBar(topSections.join(sep), width);
  const line2 = truncateBar(bottomSections.join(sep), width);

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

  // Draw 2 bottom rows, then return cursor to prompt area.
  // NOTE: We avoid \x1b[s / \x1b[u (DECSC/DECRC) because Windows Terminal
  // / ConPTY handles cursor save/restore unreliably during rapid output,
  // causing status bar fragments to bleed into the main scroll area.
  const promptRow = termHeight - 2; // above the 2 status rows
  process.stdout.write(
    '\x1b[?25l' +                      // Hide cursor
    `\x1b[${termHeight - 1};1H` +     // Move to row N-1
    '\x1b[2K' +                        // Clear line
    ` ${line1}` +                      // Line 1
    `\x1b[${termHeight};1H` +         // Move to row N
    '\x1b[2K' +                        // Clear line
    (line2 ? ` ${line2}` : '') +       // Line 2 (empty when single-line)
    `\x1b[${promptRow};1H` +          // Return cursor to prompt area
    '\x1b[?25h',                       // Show cursor
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
 * Render full brain section with labeled level breakdown.
 * Example: ✨████1521 L1:42 L2:28 L3:15 L4:8 L5:3 W:5
 */
function renderBrainSection(spiral: { l1: number; l2: number; l3: number; l4: number; l5: number; l6: number }): string {
  const totalNodes = spiral.l1 + spiral.l2 + spiral.l3 + spiral.l4 + spiral.l5 + spiral.l6;
  const scale = getBrainScale(totalNodes);
  const ratio = Math.min(totalNodes / scale, 1);
  const barWidth = 4;
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

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

  // Level breakdown — labeled + color-coded, only non-zero levels
  const levelDefs: Array<{ label: string; value: number; color: (s: string) => string }> = [
    { label: 'L1', value: spiral.l1, color: chalk.cyan },
    { label: 'L2', value: spiral.l2, color: chalk.green },
    { label: 'L3', value: spiral.l3, color: chalk.yellow },
    { label: 'L4', value: spiral.l4, color: chalk.hex('#FF6600') },
    { label: 'L5', value: spiral.l5, color: chalk.hex('#8a2be2') },
    { label: 'W',  value: spiral.l6, color: chalk.hex('#FF6B9D') },
  ];
  const levelParts: string[] = [];
  for (const lev of levelDefs) {
    if (lev.value > 0) {
      levelParts.push(chalk.dim(`${lev.label}:`) + lev.color(`${lev.value}`));
    }
  }

  return `${brainIcon}${bar}${barColor(`${totalNodes}`)} ${levelParts.join(' ')}`;
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

function renderTokenBar(tokens: number): string {
  const scale = getScale(tokens);
  const ratio = Math.min(tokens / scale, 1);
  const barWidth = 4;
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

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
