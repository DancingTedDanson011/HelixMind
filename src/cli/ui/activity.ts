import chalk from 'chalk';

/**
 * Glowing activity indicator with color-wave animation across "HelixMind" text.
 * Shows elapsed time, step info, and error count during agent work.
 *
 * TWO-LAYER protection keeps the bottom row reserved at all costs:
 *
 * Layer 1 — SCROLL REGION (best-effort, terminal-dependent)
 *   Sets DECSTBM so rows 1..(N-1) scroll normally, row N is untouchable.
 *   Works on Windows Terminal, iTerm, GNOME Terminal, xterm, etc.
 *   May not work fully on legacy cmd.exe / conhost.
 *
 * Layer 2 — STDOUT HOOK (bulletproof, works everywhere)
 *   Monkey-patches process.stdout.write. After every normal write,
 *   a process.nextTick redraws the bar on the bottom row. This catches
 *   any content that leaks past the scroll region (or when scroll regions
 *   aren't supported). The nextTick batching avoids interrupting
 *   multi-part ANSI sequences.
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

  // ─── stdout hook state ────────────────────────────────────
  private _originalWrite: ((...args: any[]) => boolean) | null = null;
  private _lastBarContent = '';
  private _redrawScheduled = false;

  start(): void {
    this.frame = 0;
    this.stepNum = 0;
    this.stepLabel = '';
    this.totalSteps = 0;
    this.errors = 0;
    this.startTime = Date.now();
    this._hookStdout();
    this._setScrollRegion();
    this.resumeAnimation();
  }

  /** Resume the animation without resetting the timer */
  resumeAnimation(): void {
    if (this.interval) return; // already running
    this.interval = setInterval(() => {
      this.frame++;
      this.render();
    }, 80);
    this.render();
  }

  /** Pause the animation but keep the timer running (hook stays active) */
  pauseAnimation(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this._lastBarContent = '';
    this._writeToBottomRow('');
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
   * Resets scroll region, unhooks stdout, clears bottom row, writes "Done" inline.
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

    // Clear the bar, remove all protections
    this._lastBarContent = '';
    this._writeToBottomRow('');
    this._resetScrollRegion();
    this._unhookStdout();

    if (this.startTime > 0 && wasAnimating) {
      // Write colorful final status inline (part of conversation flow)
      const text = 'HelixMind';
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
    if (this.isRunning) {
      this._setScrollRegion();
      if (this._lastBarContent) {
        this._writeToBottomRow(this._lastBarContent);
      }
    }
  }

  // ─── Layer 2: stdout write hook ───────────────────────────

  /**
   * Monkey-patch process.stdout.write so that after every normal write,
   * a nextTick redraws the bar. This guarantees the bottom row is never
   * left showing stale content — even if the terminal ignores scroll regions.
   *
   * nextTick batching prevents interrupting multi-part ANSI sequences
   * (e.g. a write of "\x1b[" followed by "31m" won't have a bar redraw
   * injected between them).
   */
  private _hookStdout(): void {
    if (!process.stdout.isTTY || this._originalWrite) return;
    this._originalWrite = process.stdout.write.bind(process.stdout);
    const self = this;
    (process.stdout as any).write = function (...args: any[]): boolean {
      const result = self._originalWrite!(...args);
      // Schedule a single bar redraw after current synchronous writes finish
      if (self._lastBarContent && !self._redrawScheduled) {
        self._redrawScheduled = true;
        process.nextTick(() => {
          self._redrawScheduled = false;
          if (self._lastBarContent) {
            self._writeToBottomRow(self._lastBarContent);
          }
        });
      }
      return result;
    };
  }

  /** Restore the original stdout.write */
  private _unhookStdout(): void {
    if (this._originalWrite) {
      process.stdout.write = this._originalWrite as typeof process.stdout.write;
      this._originalWrite = null;
    }
    this._redrawScheduled = false;
  }

  // ─── Low-level rendering ──────────────────────────────────

  /** Write directly to the real stdout, bypassing the hook */
  private _rawWrite(data: string): void {
    const write = this._originalWrite || process.stdout.write.bind(process.stdout);
    write(data);
  }

  /**
   * Write content to the bottom terminal row.
   * Uses cursor save/restore so the caller's position is preserved.
   * Empty string = clear the row.
   */
  private _writeToBottomRow(content: string): void {
    const row = process.stdout.rows || 24;
    this._rawWrite(
      '\x1b[?25l' +          // Hide cursor (prevents flash)
      '\x1b7' +              // Save cursor position
      `\x1b[${row};1H` +    // Move to bottom row, col 1
      '\x1b[2K' +            // Clear entire line
      content +              // Write content (or nothing to just clear)
      '\x1b8' +              // Restore cursor position
      '\x1b[?25h',           // Show cursor
    );
  }

  // ─── Layer 1: scroll region (best-effort) ─────────────────

  /**
   * Set scroll region to rows 1..(N-1), reserving row N for the bar.
   * Move cursor into the region so readline/prompt don't land on row N.
   */
  private _setScrollRegion(): void {
    if (!process.stdout.isTTY) return;
    const rows = process.stdout.rows || 24;
    if (rows < 4) return;
    const regionEnd = rows - 1;
    this._rawWrite(
      `\x1b[1;${regionEnd}r` +     // Set scroll region
      `\x1b[${regionEnd};1H`,      // Move cursor into region
    );
  }

  /** Reset scroll region to full screen */
  private _resetScrollRegion(): void {
    if (!process.stdout.isTTY) return;
    this._rawWrite('\x1b[r');
  }

  // ─── Animation rendering ──────────────────────────────────

  private render(): void {
    if (!this.interval) return;

    // Pulsing symbol
    const symbolIdx = Math.floor(this.frame / 4) % PULSE_SYMBOLS.length;
    const symbolColor = GRADIENT[this.frame % GRADIENT.length];
    const symbol = chalk.hex(symbolColor)(PULSE_SYMBOLS[symbolIdx]);

    // Wave-colored "HelixMind" text
    const text = 'HelixMind';
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

    const pfx = this._blockMode ? `  ${chalk.dim('\u2502')} ` : '  ';
    let line = `${pfx}${symbol} ${coloredText} working${dots} ${timeStr}`;

    // Step indicator
    if (this.stepNum > 0) {
      const stepColor = this.errors > 0 ? chalk.yellow : chalk.dim;
      line += `  ${stepColor(`[Step ${this.stepNum}]`)}`;
      if (this.stepLabel) {
        line += ` ${chalk.dim(this.stepLabel.slice(0, 40))}`;
      }
    }

    this._lastBarContent = ` ${line}`;
    this._writeToBottomRow(this._lastBarContent);
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
