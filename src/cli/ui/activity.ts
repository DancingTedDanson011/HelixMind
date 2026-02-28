import chalk from 'chalk';

/**
 * Glowing activity indicator with color-wave animation across "HelixMind" text.
 * Shows elapsed time, step info, and error count during agent work.
 */

const GRADIENT = [
  '#00d4ff', '#00c0f0', '#0aace0', '#1498d0', '#2084c0',
  '#2c70b0', '#385ca0', '#4450a0', '#5040b0', '#6030c0',
  '#7028d0', '#8a2be2', '#7028d0', '#6030c0', '#5040b0',
  '#4450a0', '#385ca0', '#2c70b0', '#2084c0', '#1498d0',
  '#0aace0', '#00c0f0',
];

const PULSE_SYMBOLS = ['⟡', '◆', '⟡', '◇'];

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
  private _prompt = '';
  private _getInput: (() => string) | null = null;
  private _twoLineMode = false;

  /** Set the readline prompt + input getter so activity can preserve user input */
  setReadline(prompt: string, getInput: () => string): void {
    this._prompt = prompt;
    this._getInput = getInput;
  }

  start(): void {
    this.frame = 0;
    this.stepNum = 0;
    this.stepLabel = '';
    this.totalSteps = 0;
    this.errors = 0;
    this.startTime = Date.now();
    this._twoLineMode = !!this._getInput;
    if (this._twoLineMode) {
      // Create space: activity line above, prompt line below
      process.stdout.write('\n');
    }
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

  /** Pause the animation but keep the timer running */
  pauseAnimation(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this._twoLineMode) {
      // Clear activity line above, keep prompt below
      process.stdout.write('\x1b[1A\r\x1b[K\x1b[1B');
    } else {
      process.stdout.write('\r\x1b[K');
    }
  }

  /** Toggle block mode — shows │ prefix when inside a tool block */
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

  private _finalElapsed = 0;

  /**
   * Stop the activity indicator and write a final status line.
   * The colorful "HelixMind working..." transforms into "HelixMind Done" (or "Stopped").
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
    if (this.startTime > 0 && wasAnimating) {
      // Replace animated line with colorful final status
      const text = 'HelixMind';
      let coloredText = '';
      for (let i = 0; i < text.length; i++) {
        coloredText += chalk.hex(GRADIENT[i * 2 % GRADIENT.length]).bold(text[i]);
      }
      const timeStr = chalk.dim(formatElapsed(this._finalElapsed));
      const pfx = this._blockMode ? `  ${chalk.dim('\u2502')} ` : '  ';
      const icon = message === 'Done' ? chalk.green('\u2713') : chalk.red('\u2717');
      const msgColor = message === 'Done' ? chalk.green(message) : chalk.red(message);

      if (this._twoLineMode) {
        // Write Done on the activity line (above prompt), keep prompt below
        process.stdout.write('\x1b[1A\r\x1b[K');
        process.stdout.write(`${pfx}${icon} ${coloredText} ${msgColor} ${timeStr}`);
        process.stdout.write('\x1b[1B\r');
      } else {
        process.stdout.write(`\r\x1b[K${pfx}${icon} ${coloredText} ${msgColor} ${timeStr}\n`);
      }
    } else if (wasAnimating) {
      if (this._twoLineMode) {
        process.stdout.write('\x1b[1A\r\x1b[K\x1b[1B');
      } else {
        process.stdout.write('\r\x1b[K');
      }
    }
    this.startTime = 0;
    this._blockMode = false;
    this._twoLineMode = false;
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

    if (this._twoLineMode) {
      // Two-line render: activity above, prompt + input below
      const input = this._getInput?.() || '';
      process.stdout.write('\x1b[1A\r\x1b[K');   // Move up, clear activity line
      process.stdout.write(line);                  // Write activity
      process.stdout.write('\n\r\x1b[K');          // Move down, clear prompt line
      process.stdout.write(this._prompt + input);  // Write prompt + user input
    } else {
      process.stdout.write(`\r\x1b[K${line}`);
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
  process.stdout.write(chalk.dim('  ┌─ Task Summary ─────────────────────\n'));

  for (const step of steps) {
    const icon = step.status === 'done'
      ? chalk.green('✓')
      : chalk.red('✗');
    const label = step.status === 'error'
      ? `${step.label} ${chalk.red(`(${step.error?.slice(0, 40) || 'error'})`)}`
      : step.label;
    process.stdout.write(chalk.dim(`  │ `) + `${icon} ${chalk.dim(`Step ${step.num}:`)} ${label}\n`);
  }

  const summaryText = errors > 0
    ? `${done} done, ${chalk.red(`${errors} error${errors > 1 ? 's' : ''}`)}`
    : `${done} steps completed`;

  const durationText = durationMs != null
    ? chalk.dim(` in ${formatElapsed(durationMs)}`)
    : '';

  process.stdout.write(chalk.dim(`  │\n  │ ${summaryText}${durationText}\n`));
  process.stdout.write(chalk.dim('  └─────────────────────────────────────\n'));
}

/**
 * Render a completion indicator after the agent finishes.
 */
export function renderCompletion(durationMs: number, tokenCount?: number): void {
  const timeStr = formatElapsed(durationMs);
  const tokenStr = tokenCount ? ` · ${formatTokens(tokenCount)} tokens` : '';
  process.stdout.write(
    `  ${chalk.green('✓')} ${chalk.dim(`Done in ${timeStr}${tokenStr}`)}\n`,
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 100_000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n / 1000) + 'k';
}

export { formatElapsed };
