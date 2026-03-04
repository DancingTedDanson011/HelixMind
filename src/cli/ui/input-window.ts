/**
 * InputWindow — Dedicated input area like Claude Code
 * 
 * Enterprise Features:
 * 1. Always visible input window at the bottom
 * 2. Clear separation between output (scrollable) and input (fixed)
 * 3. Cursor stays in input window
 * 4. Visual frame around input area
 * 5. Typing detection — pauses agent while user is typing
 * 6. Input buffering — prevents premature message sending
 * 7. Debounce — waits for user to finish typing before allowing send
 */

import chalk from 'chalk';
import { EventEmitter } from 'node:events';

const INPUT_WINDOW_HEIGHT = 5; // 1 top border, 2 input lines, 1 hint line, 1 bottom border
const MIN_TERMINAL_HEIGHT = 14;

/** Enterprise: Typing detection thresholds */
const TYPING_IDLE_MS = 500;        // Consider typing stopped after 500ms idle
const TYPING_DEBOUNCE_MS = 300;    // Debounce period for input changes
const MAX_INPUT_BUFFER = 10000;    // Maximum input buffer size

export interface InputState {
  isTyping: boolean;
  lastKeyTime: number;
  inputLength: number;
  cursorPosition: number;
}

export interface InputWindowEvents {
  'typing-start': (state: InputState) => void;
  'typing-stop': (state: InputState) => void;
  'input-ready': (content: string) => void;
  'buffer-change': (content: string) => void;
}

export class InputWindow extends EventEmitter {
  private _active = false;
  private _inlineMode = false;
  private _originalWrite: ((...args: any[]) => boolean) | null = null;
  private _inputContent = '';
  private _hintContent = '';
  private _statusContent = '';
  private _cursorPosition = 0;

  // Enterprise: Typing detection
  private _isTyping = false;
  private _lastKeyTime = 0;
  private _typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _inputBuffer = '';
  private _bufferLocked = false;

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

  /** Enterprise: Whether user is currently typing */
  get isTyping(): boolean {
    return this._isTyping;
  }

  /** Enterprise: Current input state */
  get inputState(): InputState {
    return {
      isTyping: this._isTyping,
      lastKeyTime: this._lastKeyTime,
      inputLength: this._inputContent.length,
      cursorPosition: this._cursorPosition,
    };
  }

  /** Enterprise: Whether input buffer is locked (prevents sending) */
  get isBufferLocked(): boolean {
    return this._bufferLocked;
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

    this._clearTypingTimeout();
    this._clearInputWindow();
    this._resetScrollRegion();
    this._unhookStdout();
    this._inputContent = '';
    this._hintContent = '';
    this._statusContent = '';
    this._inputBuffer = '';
    this._isTyping = false;
  }

  /**
   * Update input content and redraw
   * Enterprise: Triggers typing detection
   */
  setInput(content: string, cursorPos: number = content.length): void {
    const previousContent = this._inputContent;
    this._inputContent = content;
    this._cursorPosition = cursorPos;

    // Enterprise: Typing detection
    if (content !== previousContent) {
      this._handleTypingChange(content);
    }

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
   * Enterprise: Lock/unlock input buffer
   * When locked, input cannot be sent
   */
  setBufferLocked(locked: boolean): void {
    this._bufferLocked = locked;
    this._drawStatusLine();
  }

  /**
   * Enterprise: Get buffered input
   * Returns the current input buffer and clears it
   */
  flushBuffer(): string {
    const content = this._inputBuffer;
    this._inputBuffer = '';
    return content;
  }

  /**
   * Enterprise: Check if input is ready to be sent
   * Returns true if user has stopped typing and buffer is not locked
   */
  isInputReady(): boolean {
    return !this._isTyping && !this._bufferLocked;
  }

  /**
   * Position cursor in the input window for readline
   */
  positionCursorForInput(): void {
    if (!this._active || this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const inputRow = rows - INPUT_WINDOW_HEIGHT + 1; // Row for input text (first line)
    const col = 3 + this._cursorPosition; // 2 for border + 1 space
    
    process.stdout.write(`\x1b[${inputRow};${col}H`);
  }

  // ---------------------------------------------------------------------------
  // Enterprise: Typing Detection
  // ---------------------------------------------------------------------------

  /**
   * Handle typing change events
   */
  private _handleTypingChange(content: string): void {
    const now = Date.now();
    this._lastKeyTime = now;

    // Update buffer
    this._inputBuffer = content.slice(0, MAX_INPUT_BUFFER);
    this.emit('buffer-change', content);

    // Start typing if not already
    if (!this._isTyping) {
      this._isTyping = true;
      this.emit('typing-start', this.inputState);
      this._updateTypingHint();
    }

    // Clear existing timeout
    this._clearTypingTimeout();

    // Set new timeout for typing stop
    this._typingTimeout = setTimeout(() => {
      if (this._isTyping) {
        this._isTyping = false;
        this.emit('typing-stop', this.inputState);
        this._updateIdleHint();
      }
    }, TYPING_IDLE_MS);
  }

  /**
   * Clear typing timeout
   */
  private _clearTypingTimeout(): void {
    if (this._typingTimeout) {
      clearTimeout(this._typingTimeout);
      this._typingTimeout = null;
    }
  }

  /**
   * Update hint to show typing status
   */
  private _updateTypingHint(): void {
    if (!this._active || this._inlineMode) return;
    
    const dots = this._isTyping ? '...' : '';
    this._hintContent = chalk.dim('⌨️ Typing') + dots;
    this._drawHintLine();
  }

  /**
   * Update hint to show idle status
   */
  private _updateIdleHint(): void {
    if (!this._active || this._inlineMode) return;
    
    this._hintContent = chalk.dim('Press Enter to send • Esc to cancel');
    this._drawHintLine();
  }

  // ---------------------------------------------------------------------------
  // Private Drawing Methods
  // ---------------------------------------------------------------------------

  /**
   * Clear the entire input window
   */
  private _clearInputWindow(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const startRow = rows - INPUT_WINDOW_HEIGHT;
    
    // Save cursor
    process.stdout.write('\x1b[s');
    
    // Clear all input window rows
    for (let i = 0; i < INPUT_WINDOW_HEIGHT; i++) {
      process.stdout.write(`\x1b[${startRow + i};0H\x1b[2K`);
    }
    
    // Restore cursor
    process.stdout.write('\x1b[u');
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
    process.stdout.write('\x1b[s');
    
    // Top border with enterprise styling
    process.stdout.write(`\x1b[${startRow};0H`);
    const borderColor = this._bufferLocked ? chalk.red : chalk.hex('#00d4ff');
    process.stdout.write(borderColor.dim('┌' + '─'.repeat(cols - 2) + '┐'));
    
    // Input line 1 (with prompt)
    process.stdout.write(`\x1b[${startRow + 1};0H`);
    process.stdout.write(borderColor.dim('│') + ' ❯ ');
    
    // Input line 2 (extra space for long messages)
    process.stdout.write(`\x1b[${startRow + 2};0H`);
    process.stdout.write(borderColor.dim('│') + '   ');
    
    // Hint line
    process.stdout.write(`\x1b[${startRow + 3};0H`);
    process.stdout.write(borderColor.dim('│'));
    
    // Bottom border with status
    process.stdout.write(`\x1b[${startRow + 4};0H`);
    process.stdout.write(borderColor.dim('└' + '─'.repeat(cols - 2) + '┘'));
    
    // Restore cursor
    process.stdout.write('\x1b[u');
    
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
    const inputRow2 = rows - INPUT_WINDOW_HEIGHT + 2;
    
    // Save cursor
    process.stdout.write('\x1b[s');
    
    // Clear and write input line
    process.stdout.write(`\x1b[${inputRow};0H\x1b[2K`);
    
    // Enterprise: Show typing indicator
    const borderColor = this._bufferLocked ? chalk.red : chalk.hex('#00d4ff');
    const typingIndicator = this._isTyping ? chalk.dim('⌨ ') : '';
    
    // Wrap long input across two lines
    const maxLine1 = cols - 6; // Account for border and prompt
    const line1 = this._inputContent.slice(0, maxLine1);
    const line2 = this._inputContent.slice(maxLine1, maxLine1 * 2);
    
    process.stdout.write(borderColor.dim('│') + ' ❯ ' + typingIndicator + line1);
    
    // Second line if content is long
    if (line2) {
      process.stdout.write(`\x1b[${inputRow2};0H\x1b[2K`);
      process.stdout.write(borderColor.dim('│') + '   ' + line2);
    } else {
      // Clear second line
      process.stdout.write(`\x1b[${inputRow2};0H\x1b[2K`);
      process.stdout.write(borderColor.dim('│') + '   ');
    }
    
    // Restore cursor
    process.stdout.write('\x1b[u');
  }

  /**
   * Draw the hint line
   */
  private _drawHintLine(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const hintRow = rows - INPUT_WINDOW_HEIGHT + 3;
    
    // Save cursor
    process.stdout.write('\x1b[s');
    
    // Clear and write hint line
    process.stdout.write(`\x1b[${hintRow};0H\x1b[2K`);
    
    const borderColor = this._bufferLocked ? chalk.red : chalk.hex('#00d4ff');
    process.stdout.write(borderColor.dim('│ ') + this._hintContent);
    
    // Restore cursor
    process.stdout.write('\x1b[u');
  }

  /**
   * Draw the status line in the bottom border
   */
  private _drawStatusLine(): void {
    if (this._inlineMode) return;
    
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    const statusRow = rows - INPUT_WINDOW_HEIGHT + 4;
    
    // Save cursor
    process.stdout.write('\x1b[s');
    
    // Clear bottom border area
    process.stdout.write(`\x1b[${statusRow};0H\x1b[2K`);
    
    // Draw border with status
    const borderColor = this._bufferLocked ? chalk.red : chalk.hex('#00d4ff');
    const border = borderColor.dim('└');
    
    // Enterprise: Show buffer lock status
    const lockStatus = this._bufferLocked ? chalk.red(' 🔒 LOCKED') : '';
    const status = lockStatus + ' ' + this._statusContent;
    const remaining = cols - 2 - visibleLength(status);
    const bottomBorder = border + status + borderColor.dim('─'.repeat(Math.max(0, remaining)) + '┘');
    
    process.stdout.write(bottomBorder);
    
    // Restore cursor
    process.stdout.write('\x1b[u');
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
