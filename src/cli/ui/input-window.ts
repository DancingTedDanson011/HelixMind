/**
 * InputWindow — Dedicated input area like Claude Code
 * 
 * Features:
 * 1. Always visible input window at the bottom
 * 2. Clear separation between output (scrollable) and input (fixed)
 * 3. Cursor stays in input window
 * 4. Visual frame around input area
 */

import chalk from 'chalk';

const INPUT_WINDOW_HEIGHT = 4; // 1 top border, 1 input line, 1 hint line, 1 bottom border
const MIN_TERMINAL_HEIGHT = 12;

export class InputWindow {
  private _active = false;
  private _inlineMode = false;
  private _originalWrite: ((...args: any[]) => boolean) | null = null;
  private _inputContent = '';
  private _hintContent = '';
  private _statusContent = '';
  private _cursorPosition = 0;

  /** Whether the input window is currently active */
  get isActive(): boolean {
    return this._active;
  }

  /** Whether we fell back to inline mode (terminal too small) */
  get isInlineMode(): boolean {
    return this._inlineMode;
  }

  /** Current input content */
  get inputContent(): string {
    return this._inputContent;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Activate the input window: set scroll region, hook stdout, draw initial frame
   */
  activate(): void {
    if (this._active) return;
    if (!process.stdout.isTTY) {
      this._inlineMode = true;
      return;
    }

    const rows = process.stdout.rows || 24;
    if (rows < MIN_TERMINAL_HEIGHT) {
      this._inlineMode = true;
      return;
    }

    this._inlineMode = false;
    this._active = true;
    this._setScrollRegion();
    this._hookStdout();
    this._drawFrame();
  }

  /**
   * Deactivate: reset scroll region, unhook stdout, clear input window
   */
  deactivate(): void {
    if (!this._active) return;
    this._active = false;

    this._clearInputWindow();
    this._resetScrollRegion();
    this._unhookStdout();
    this._inputContent = '';
    this._hintContent = '';
    this._statusContent = '';
  }

  /**
   * Update input content and redraw
   */
  setInput(content: string, cursorPos: number = content.length): void {
    this._inputContent = content;
    this._cursorPosition = cursorPos;
    if (!this._active || this._inlineMode) return;
    this._drawInputLine();
  }

  /**
   * Update hint line (shortcuts, help text)
   */
  setHint(content: string): void {
    this._hintContent = content;
    if (!this._active || this._inlineMode) return;
    this._drawHintLine();
  }

  /**
   * Update status line (tokens, model, etc.)
   */
  setStatus(content: string): void {
    this._statusContent = content;
    if (!this._active || this._inlineMode) return;
    this._drawStatusLine();
  }

  /**
   * Position cursor in the input window for readline
   */
  positionCursorForInput(): void {
    if (!this._active || this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const inputRow = rows - INPUT_WINDOW_HEIGHT + 1; // Row for input text
    const col = 3 + this._cursorPosition; // 2 for border + 1 space
    
    process.stdout.write(`\x1b[${inputRow};${col}H`);
  }

  /**
   * Clear the entire input window
   */
  private _clearInputWindow(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const startRow = rows - INPUT_WINDOW_HEIGHT;
    
    // Save cursor
    process.stdout.write('\x1b7');
    
    // Clear all input window rows
    for (let i = 0; i < INPUT_WINDOW_HEIGHT; i++) {
      process.stdout.write(`\x1b[${startRow + i};0H\x1b[2K`);
    }
    
    // Restore cursor
    process.stdout.write('\x1b8');
  }

  /**
   * Draw the frame around the input window
   */
  private _drawFrame(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const startRow = rows - INPUT_WINDOW_HEIGHT;
    
    // Save cursor
    process.stdout.write('\x1b7');
    
    // Top border
    process.stdout.write(`\x1b[${startRow};0H`);
    process.stdout.write(chalk.hex('#00d4ff').dim('┌' + '─'.repeat(cols - 2) + '┐'));
    
    // Input line (with prompt)
    process.stdout.write(`\x1b[${startRow + 1};0H`);
    process.stdout.write(chalk.hex('#00d4ff').dim('│') + ' ❯ ');
    
    // Hint line
    process.stdout.write(`\x1b[${startRow + 2};0H`);
    process.stdout.write(chalk.hex('#00d4ff').dim('│'));
    
    // Bottom border with status
    process.stdout.write(`\x1b[${startRow + 3};0H`);
    process.stdout.write(chalk.hex('#00d4ff').dim('└' + '─'.repeat(cols - 2) + '┘'));
    
    // Restore cursor
    process.stdout.write('\x1b8');
    
    // Draw initial content
    this._drawInputLine();
    this._drawHintLine();
    this._drawStatusLine();
  }

  /**
   * Draw the input line with current content
   */
  private _drawInputLine(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const inputRow = rows - INPUT_WINDOW_HEIGHT + 1;
    
    // Save cursor
    process.stdout.write('\x1b7');
    
    // Clear and write input line
    process.stdout.write(`\x1b[${inputRow};0H\x1b[2K`);
    process.stdout.write(chalk.hex('#00d4ff').dim('│') + ' ❯ ' + this._inputContent);
    
    // Restore cursor
    process.stdout.write('\x1b8');
  }

  /**
   * Draw the hint line
   */
  private _drawHintLine(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const hintRow = rows - INPUT_WINDOW_HEIGHT + 2;
    
    // Save cursor
    process.stdout.write('\x1b7');
    
    // Clear and write hint line
    process.stdout.write(`\x1b[${hintRow};0H\x1b[2K`);
    process.stdout.write(chalk.hex('#00d4ff').dim('│ ') + this._hintContent);
    
    // Restore cursor
    process.stdout.write('\x1b8');
  }

  /**
   * Draw the status line in the bottom border
   */
  private _drawStatusLine(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const statusRow = rows - INPUT_WINDOW_HEIGHT + 3;
    
    // Save cursor
    process.stdout.write('\x1b7');
    
    // Clear bottom border area
    process.stdout.write(`\x1b[${statusRow};0H\x1b[2K`);
    
    // Draw border with status
    const border = chalk.hex('#00d4ff').dim('└');
    const status = ' ' + this._statusContent;
    const remaining = cols - 2 - visibleLength(status);
    const bottomBorder = border + status + chalk.hex('#00d4ff').dim('─'.repeat(Math.max(0, remaining)) + '┘');
    
    process.stdout.write(bottomBorder);
    
    // Restore cursor
    process.stdout.write('\x1b8');
  }

  /**
   * Set scroll region to exclude the input window
   */
  private _setScrollRegion(): void {
    const rows = process.stdout.rows || 24;
    const scrollEnd = rows - INPUT_WINDOW_HEIGHT - 1;
    
    if (scrollEnd > 0) {
      process.stdout.write(`\x1b[0;${scrollEnd}r`);
    }
  }

  /**
   * Reset scroll region to full terminal
   */
  private _resetScrollRegion(): void {
    process.stdout.write('\x1b[r');
  }

  /**
   * Hook stdout to redraw input window after writes
   */
  private _hookStdout(): void {
    this._originalWrite = process.stdout.write;
    
    process.stdout.write = ((...args: any[]): boolean => {
      const result = this._originalWrite!.apply(process.stdout, args);
      
      // Schedule redraw on next tick to avoid recursion
      if (!this._redrawScheduled) {
        this._redrawScheduled = true;
        setImmediate(() => {
          this._redrawScheduled = false;
          if (this._active && !this._inlineMode) {
            this._drawFrame();
          }
        });
      }
      
      return result;
    }) as any;
  }

  /**
   * Unhook stdout
   */
  private _unhookStdout(): void {
    if (this._originalWrite) {
      process.stdout.write = this._originalWrite;
      this._originalWrite = null;
    }
  }

  private _redrawScheduled = false;
}

/** Strip ANSI escape codes to measure visible string width */
function visibleLength(str: string): number {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\].*?\x07/g, '').length;
}