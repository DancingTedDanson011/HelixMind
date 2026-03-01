import chalk from 'chalk';
import type { BottomChrome } from './bottom-chrome.js';
import { visibleLength } from './statusbar.js';

/**
 * Glowing activity indicator with color-wave animation across "HelixMind" text.
 * Shows elapsed time, step info, and error count during agent work.
 *
 * Renders on BottomChrome row 0 (the separator/activity row, terminal row N-2).
 * Scroll region management and stdout hooking are delegated to BottomChrome.
 */

const GRADIENT = [
  '#00d4ff', '#00c0f0', '#0aace0', '#1498d0', '#2084c0',
  '#2c70b0', '#385ca0', '#4450a0', '#5040b0', '#6030c0',
  '#7028d0', '#8a2be2', '#7028d0', '#6030c0', '#5040b0',
  '#4450a0', '#385ca0', '#2c70b0', '#2084c0', '#1498d0',
  '#0aace0', '#00c0f0',
];

const PULSE_SYMBOLS = ['\u27E1', '\u25C6', '\u27E1', '\u25C7'];

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export class ActivityIndicator {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private stepNum = 0;
  private stepLabel = '';
  private totalSteps = 0;
  private errors = 0;
  private startTime = 0;
  private _blockMode = false;
  private _finalElapsed = 0;
  private _restoreContent = '';
  private _onMute: (() => void) | null = null;
  private _onUnmute: (() => void) | null = null;
  private _displayName = 'HelixMind';

  /** Reference to the shared BottomChrome instance */
  private chrome: BottomChrome | null;

  constructor(chrome?: BottomChrome) {
    this.chrome = chrome ?? null;
  }

  /** Override the display name shown in the animation (default: "HelixMind") */
  setDisplayName(name: string): void {
    this._displayName = name;
  }

  /** Set the hints content to restore on chrome row 2 when activity stops/pauses */
  setRestoreContent(content: string): void {
    this._restoreContent = content;
  }

  /**
   * Set callbacks for muting/unmuting readline echo.
   * Mute fires when animation starts (LLM streaming — echo would conflict).
   * Unmute fires when animation pauses (tool execution — user needs to see input).
   */
  setMuteCallbacks(onMute: () => void, onUnmute: () => void): void {
    this._onMute = onMute;
    this._onUnmute = onUnmute;
  }

  start(): void {
    this.frame = 0;
    this.stepNum = 0;
    this.stepLabel = '';
    this.totalSteps = 0;
    this.errors = 0;
    this.startTime = Date.now();
    this.resumeAnimation();
  }

  /** Resume the animation without resetting the timer */
  resumeAnimation(): void {
    if (this.interval) return; // already running
    this._onMute?.();
    this.interval = setInterval(() => {
      this.frame++;
      this.render();
    }, 80);
    this.render();
  }

  /** Pause the animation but keep the timer running */
  pauseAnimation(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this._onUnmute?.();
    // Restore hints on chrome row 2
    if (this.chrome?.isActive) {
      this.chrome.setRow(2, this._restoreContent);
    }
  }

  /** Toggle block mode — shows | prefix when inside a tool block */
  setBlockMode(on: boolean): void {
    this._blockMode = on;
  }

  setStep(num: number, label: string): void {
    this.stepNum = num;
    this.totalSteps = num;
    this.stepLabel = label;
  }

  setError(): void {
    this.errors++;
  }

  /**
   * Stop the activity indicator and write a final status line.
   * Restores hints on chrome row 2 and writes "Done" as inline scrolling content.
   */
  stop(message: string = 'Done'): void {
    if (this.startTime > 0) {
      this._finalElapsed = Date.now() - this.startTime;
    }
    const wasAnimating = this.interval !== null;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this._onUnmute?.();

    // Restore hints on chrome row 2
    if (this.chrome?.isActive) {
      this.chrome.setRow(2, this._restoreContent);
    }

    if (this.startTime > 0 && wasAnimating) {
      // Write colorful final status inline (part of conversation flow)
      const text = this._displayName;
      let coloredText = '';
      for (let i = 0; i < text.length; i++) {
        coloredText += chalk.hex(GRADIENT[i * 2 % GRADIENT.length]).bold(text[i]);
      }
      const timeStr = chalk.dim(formatElapsed(this._finalElapsed));
      const pfx = this._blockMode ? `  ${chalk.dim('\u2502')} ` : '  ';
      const icon = message === 'Done' ? chalk.green('\u2713') : chalk.red('\u2717');
      const msgColor = message === 'Done' ? chalk.green(message) : chalk.red(message);
      const finalLine = `${pfx}${icon} ${coloredText} ${msgColor} ${timeStr}`;
      process.stdout.write(`${finalLine}\n`);
    }

    this.startTime = 0;
    this._blockMode = false;
  }

  get isRunning(): boolean {
    return this.startTime > 0;
  }

  get isAnimating(): boolean {
    return this.interval !== null;
  }

  /** Get elapsed time in ms since start() (or saved value after stop) */
  get elapsed(): number {
    if (this.startTime > 0) return Date.now() - this.startTime;
    return this._finalElapsed;
  }

  /**
   * Called on terminal resize to update protections while active.
   */
  handleResize(): void {
    // BottomChrome handles scroll region and row repositioning.
    // Just re-render the current frame if animating.
    if (this.isAnimating) {
      this.render();
    }
  }

  // ─── Animation rendering ──────────────────────────────────

  private render(): void {
    if (!this.interval) return;

    // Pulsing symbol
    const symbolIdx = Math.floor(this.frame / 4) % PULSE_SYMBOLS.length;
    const symbolColor = GRADIENT[this.frame % GRADIENT.length];
    const symbol = chalk.hex(symbolColor)(PULSE_SYMBOLS[symbolIdx]);

    // Wave-colored display name text
    const text = this._displayName;
    let coloredText = '';
    for (let i = 0; i < text.length; i++) {
      const gradIdx = (i * 2 + this.frame) % GRADIENT.length;
      coloredText += chalk.hex(GRADIENT[gradIdx]).bold(text[i]);
    }

    // Animated dots
    const dotCount = (Math.floor(this.frame / 5) % 3) + 1;
    const dots = chalk.hex(symbolColor)('.'.repeat(dotCount).padEnd(3));

    // Elapsed time
    const elapsed = Date.now() - this.startTime;
    const timeStr = chalk.dim(formatElapsed(elapsed));

    let line = `${symbol} ${coloredText} working${dots} ${timeStr}`;

    // Step indicator
    if (this.stepNum > 0) {
      const stepColor = this.errors > 0 ? chalk.yellow : chalk.dim;
      line += `  ${stepColor(`[Step ${this.stepNum}]`)}`;
      if (this.stepLabel) {
        line += ` ${chalk.dim(this.stepLabel.slice(0, 40))}`;
      }
    }

    // Write to chrome row 2 (hints row) — top border stays untouched
    if (this.chrome?.isActive) {
      this.chrome.setRow(2, line);
    }
  }
}

/**
 * Render a task summary after agent completes.
 */
export interface TaskStep {
  num: number;
  tool: string;
  label: string;
  status: 'done' | 'error';
  error?: string;
}

export function renderTaskSummary(steps: TaskStep[], durationMs?: number): void {
  if (steps.length === 0) return;

  const done = steps.filter(s => s.status === 'done').length;
  const errors = steps.filter(s => s.status === 'error').length;

  process.stdout.write('\n');
  process.stdout.write(chalk.dim('  \u250C\u2500 Task Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'));

  for (const step of steps) {
    const icon = step.status === 'done'
      ? chalk.green('\u2713')
      : chalk.red('\u2717');
    const label = step.status === 'error'
      ? `${step.label} ${chalk.red(`(${step.error?.slice(0, 40) || 'error'})`)}`
      : step.label;
    process.stdout.write(chalk.dim(`  \u2502 `) + `${icon} ${chalk.dim(`Step ${step.num}:`)} ${label}\n`);
  }

  const summaryText = errors > 0
    ? `${done} done, ${chalk.red(`${errors} error${errors > 1 ? 's' : ''}`)}`
    : `${done} steps completed`;

  const durationText = durationMs != null
    ? chalk.dim(` in ${formatElapsed(durationMs)}`)
    : '';

  process.stdout.write(chalk.dim(`  \u2502\n  \u2502 ${summaryText}${durationText}\n`));
  process.stdout.write(chalk.dim('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'));
}

/**
 * Render a completion indicator after the agent finishes.
 */
export function renderCompletion(durationMs: number, tokenCount?: number): void {
  const timeStr = formatElapsed(durationMs);
  const tokenStr = tokenCount ? ` \u00B7 ${formatTokens(tokenCount)} tokens` : '';
  process.stdout.write(
    `  ${chalk.green('\u2713')} ${chalk.dim(`Done in ${timeStr}${tokenStr}`)}\n`,
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 100_000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n / 1000) + 'k';
}

export { formatElapsed };
