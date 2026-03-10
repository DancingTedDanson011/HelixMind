/**
 * InputManager — Isolated input handling with framed display.
 *
 * Wraps Node.js readline to provide:
 * - Input rendered inside the Screen's input frame (│ ❯ _)
 * - readline output goes to /dev/null — we render the line ourselves
 * - Complete control over when/how input appears
 * - ESC to stop agent (single ESC)
 * - Double-ESC for emergency stop
 * - Ctrl+C to clear input / exit
 * - Tab completion + suggestion panel (arrow key navigation)
 * - Bracketed paste detection
 * - Prompt history (up/down arrows)
 * - Mute/unmute during agent streaming
 * - Type-ahead preview during agent work
 *
 * Events emitted:
 * - 'submit' (line: string) — user pressed Enter
 * - 'escape' — single ESC pressed
 * - 'double-escape' — ESC ESC pressed quickly
 * - 'ctrl-c' — Ctrl+C pressed
 * - 'tab' — Tab pressed (for completion)
 * - 'typing' (line: string, cursor: number) — content changed
 * - 'paste' (text: string) — bracketed paste received
 */

import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import type { Screen } from './screen.js';
import type { Terminal } from './terminal.js';
import { ANSI } from './terminal.js';
import type { CommandDef } from '../ui/command-suggest.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const ESC_DOUBLE_THRESHOLD = 300;     // ms between two ESCs for double-ESC
const PASTE_THRESHOLD_MS = 100;       // ms to detect multi-line paste
const MAX_SUGGESTIONS = 6;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InputManagerOptions {
  /** Initial prompt prefix (default: '❯') */
  promptChar?: string;
  /** Completer function for Tab completion */
  completer?: (line: string) => [string[], string];
  /** Function to get command suggestions for the panel */
  getSuggestions?: (partial: string) => CommandDef[];
  /** Get best single completion for Tab */
  getBestCompletion?: (partial: string) => string | null;
}

export interface InputManagerEvents {
  submit: (line: string) => void;
  escape: () => void;
  'double-escape': () => void;
  'ctrl-c': () => void;
  tab: (line: string) => void;
  typing: (line: string, cursor: number) => void;
  paste: (text: string) => void;
  'suggestion-select': (cmd: string) => void;
}

// ─── InputManager ────────────────────────────────────────────────────────────

export class InputManager extends EventEmitter {
  private screen: Screen;
  private terminal: Terminal;
  private rl: readline.Interface;
  private devNull: Writable;

  // State
  private _muted = false;
  private _isPrompting = false;
  private _lastEscTime = 0;
  private _ctrlCCount = 0;
  private _ctrlCTimer: ReturnType<typeof setTimeout> | null = null;

  // Suggestion panel
  private _suggestions: CommandDef[] = [];
  private _suggestionIndex = -1;
  private _suggestionOriginalInput = '';
  private _suggestionOpen = false;

  // Paste detection
  private _bracketedPasteActive = false;
  private _bracketedPasteBuffer = '';
  private _pasteBuffer: string[] = [];
  private _pasteTimer: ReturnType<typeof setTimeout> | null = null;

  // Suppress flag: when true, _ttyWrite skips all input (used during bracketed paste)
  private _suppressInput = false;

  // Paste badges: embedded markers in readline line text.
  // \x01 = badge start, \x02 = badge end. Actual paste text stored in _pasteStore.
  // Multiple badges possible — each paste inserts a marker at cursor position.
  private _pasteStore = new Map<number, string>(); // badgeId → actual paste text
  private _nextPasteId = 1;
  private static readonly PASTE_BLOCK_THRESHOLD = 3; // lines ≥ this → badge mode
  // Legacy compat
  private _pasteBlock: { text: string; lineCount: number } | null = null;

  // Multi-line input state (Shift+Enter inserts newline)
  private _multiLines: string[] = ['']; // lines[0] synced with readline's .line
  private _multiCursorLine = 0;          // which line the cursor is on

  // Drain guard: skip phantom line events after sub-menus
  private _drainUntil = 0;

  // Pending paste text (stored for combining with typed input on Enter)
  private _pendingPasteText: string | null = null;

  // Options
  private _getSuggestions: ((partial: string) => CommandDef[]) | null;
  private _getBestCompletion: ((partial: string) => string | null) | null;

  /**
   * Access the underlying readline interface.
   * Needed for legacy code (PermissionManager.setReadline, rl.question, etc.)
   */
  get readline(): readline.Interface { return this.rl; }

  constructor(screen: Screen, terminal: Terminal, options: InputManagerOptions = {}) {
    super();
    this.screen = screen;
    this.terminal = terminal;
    this._getSuggestions = options.getSuggestions ?? null;
    this._getBestCompletion = options.getBestCompletion ?? null;

    // Create a /dev/null writable — readline writes its output here (we render ourselves)
    this.devNull = new Writable({ write: (_chunk, _encoding, callback) => callback() });

    // Enable keypress events before creating readline
    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
    }

    // Create readline with output to devNull — we render the input ourselves.
    // IMPORTANT: terminal must be true so readline uses _ttyWrite (our intercept point).
    // Without it, readline falls back to non-terminal line buffering and _ttyWrite is never called.
    this.rl = readline.createInterface({
      input: process.stdin,
      output: this.devNull,
      prompt: '',
      terminal: true,
      escapeCodeTimeout: 50,
      completer: options.completer,
    });

    // Intercept readline's internal _ttyWrite for suggestion panel navigation
    this._interceptTtyWrite();

    // Register event handlers
    this._registerKeypress();
    this._registerLineHandler();
    this._registerBracketedPaste();
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Show the prompt and accept input. Draws the frame and positions cursor.
   */
  prompt(): void {
    this._isPrompting = true;
    this.screen.inputActive = true;

    // Activate readline's input processing (output goes to devNull, we render ourselves)
    this.rl.prompt();

    // Draw the input frame
    this.screen.drawFrameTop();
    this._renderCurrentLine();

    // Draw frame bottom when no activity (idle state)
    this.screen.drawFrameBottom();
  }

  /**
   * Mute input echo (during agent streaming).
   * Keystrokes are still captured but shown as dim type-ahead preview.
   */
  mute(): void {
    this._muted = true;
    this.screen.inputActive = false; // allow hook redraws during agent work
  }

  /**
   * Unmute input echo (after agent finishes).
   */
  unmute(): void {
    this._muted = false;
    this.screen.inputActive = true;
    this.rl.prompt(); // Re-activate readline input processing
    this._renderCurrentLine();
  }

  /** Whether input echo is muted */
  get isMuted(): boolean { return this._muted; }

  /** Whether we're currently prompting for input */
  get isPrompting(): boolean { return this._isPrompting; }

  /** Get current input line content */
  get currentLine(): string {
    return (this.rl as any).line as string || '';
  }

  /** Get current cursor position */
  get cursorPos(): number {
    return (this.rl as any).cursor as number || 0;
  }

  /** Programmatically set the input line (resets multi-line to single line) */
  setLine(text: string): void {
    this._resetMultiLine();
    this._multiLines[0] = text;
    (this.rl as any).line = text;
    (this.rl as any).cursor = text.length;
    this._renderCurrentLine();
  }

  /** Clear the current input (resets multi-line) */
  clearLine(): void {
    this._resetMultiLine();
    (this.rl as any).line = '';
    (this.rl as any).cursor = 0;
    this._renderCurrentLine();
  }

  /** Set pending paste text (to be combined with input on Enter) */
  get pendingPaste(): string | null { return this._pendingPasteText; }
  set pendingPaste(text: string | null) { this._pendingPasteText = text; }

  /** Whether a paste block is currently stored */
  get hasPasteBlock(): boolean { return this._pasteBlock !== null; }

  /** Get paste block info */
  get pasteBlock(): { text: string; lineCount: number } | null { return this._pasteBlock; }

  /**
   * Suppress all input processing in _ttyWrite.
   * Used by chat.ts during bracketed paste to prevent readline from
   * accumulating paste characters in its internal buffer.
   */
  set suppressInput(suppress: boolean) { this._suppressInput = suppress; }
  get suppressInput(): boolean { return this._suppressInput; }

  /**
   * Store pasted text. Short pastes → insert inline. Long pastes → badge at cursor.
   * Badge markers (\x01...\x02) are embedded in readline's line buffer so the cursor
   * can move freely through them. Multiple pastes create multiple badges.
   */
  setPasteBlock(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const lines = trimmed.split('\n');
    const maxContent = (this.terminal.cols || 80) - 6;
    const isLong = trimmed.length > maxContent; // long single-line text

    if (lines.length < InputManager.PASTE_BLOCK_THRESHOLD && !isLong) {
      // Short paste → insert directly into readline line
      const current = this.currentLine;
      const cursor = this.cursorPos;
      const singleLine = lines.join(' '); // collapse to single line
      const newLine = current.slice(0, cursor) + singleLine + current.slice(cursor);
      this.setLine(newLine);
      (this.rl as any).cursor = cursor + singleLine.length;
      this._renderCurrentLine();
      return;
    }

    // Long paste → insert badge marker at cursor position
    const id = this._nextPasteId++;
    this._pasteStore.set(id, trimmed);
    const lineCount = lines.length;
    const label = lineCount > 1 ? `${lineCount} lines` : `${trimmed.length} chars`;
    // Badge text: \x01 id:label \x02 — visible part is the label
    const badge = `\x01${id}:📋 ${label}\x02`;

    const current = this.currentLine;
    const cursor = this.cursorPos;
    const newLine = current.slice(0, cursor) + badge + current.slice(cursor);

    // Update readline directly (bypass setLine which resets multi-line)
    (this.rl as any).line = newLine;
    (this.rl as any).cursor = cursor + badge.length;

    // Legacy compat
    this._pasteBlock = { text: trimmed, lineCount };
    this._pendingPasteText = null; // not needed — badges are inline now

    this._renderCurrentLine();
    this.emit('paste-block', trimmed, lineCount);
  }

  /**
   * Clear all paste badges from the line and storage.
   */
  clearPasteBlock(): void {
    if (this._pasteStore.size === 0 && !this._pasteBlock) return;
    this._pasteStore.clear();
    this._pasteBlock = null;
    this._pendingPasteText = null;
    // Remove badge markers from readline line
    const line = this.currentLine;
    // eslint-disable-next-line no-control-regex
    const cleaned = line.replace(/\x01[^\x02]*\x02/g, '');
    if (cleaned !== line) {
      (this.rl as any).line = cleaned;
      (this.rl as any).cursor = Math.min(this.cursorPos, cleaned.length);
    }
    this.screen.setInputFrameLines(1);
    this._renderCurrentLine();
  }

  /**
   * Resolve all badge markers in text, replacing with actual paste content.
   * Used on submit to assemble the final text.
   */
  resolveBadges(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x01(\d+):[^\x02]*\x02/g, (_match, idStr) => {
      const id = parseInt(idStr, 10);
      return this._pasteStore.get(id) || '';
    });
  }

  /** Clear the paste store (call after resolveBadges on submit) */
  clearPasteStore(): void {
    this._pasteStore.clear();
    this._nextPasteId = 1;
  }

  /** Suppress line events for a duration (after sub-menus) */
  drainFor(ms: number): void {
    this._drainUntil = Date.now() + ms;
  }

  /** Load history entries into readline */
  loadHistory(entries: string[]): void {
    (this.rl as any).history = entries.slice(0, 1000);
  }

  /** Add entry to readline history */
  addToHistory(entry: string): void {
    const history = (this.rl as any).history as string[];
    if (history && history[0] !== entry) {
      history.unshift(entry);
      if (history.length > 1000) history.pop();
    }
  }

  /** Pause readline (before sub-menus) */
  pause(): void {
    this.rl.pause();
    this.screen.inputActive = false;
  }

  /** Resume readline (after sub-menus) */
  resume(): void {
    this.rl.resume();
    this.screen.inputActive = true;
    this._renderCurrentLine();
  }

  /** Whether suggestion panel is open */
  get isSuggestionOpen(): boolean { return this._suggestionOpen; }

  /** Get selected suggestion command */
  get selectedSuggestion(): string | null {
    if (!this._suggestionOpen || this._suggestionIndex < 0) return null;
    return this._suggestions[this._suggestionIndex]?.cmd ?? null;
  }

  /** Close and clean up */
  destroy(): void {
    this.closeSuggestions();
    this.rl.close();
    if (this._pasteTimer) clearTimeout(this._pasteTimer);
    if (this._ctrlCTimer) clearTimeout(this._ctrlCTimer);
  }

  // ─── Suggestion Panel ──────────────────────────────────────────────────

  /**
   * Open the suggestion panel with filtered commands.
   */
  openSuggestions(items: CommandDef[], originalInput: string): void {
    if (items.length === 0) {
      this.closeSuggestions();
      return;
    }

    const visible = items.slice(0, MAX_SUGGESTIONS);
    this._suggestions = visible;
    this._suggestionOriginalInput = originalInput;
    this._suggestionIndex = -1;
    this._suggestionOpen = true;

    this.screen.setExtraRows(visible.length);
    this._renderSuggestions();
  }

  /**
   * Update suggestions while user types (live filter).
   */
  updateSuggestions(items: CommandDef[], input: string): void {
    if (items.length === 0) {
      this.closeSuggestions();
      return;
    }

    const visible = items.slice(0, MAX_SUGGESTIONS);
    this._suggestions = visible;
    this._suggestionOriginalInput = input;

    // Keep selection if same command still in list
    if (this._suggestionIndex >= 0) {
      const prevCmd = this._suggestions[this._suggestionIndex]?.cmd;
      const newIdx = visible.findIndex(it => it.cmd === prevCmd);
      this._suggestionIndex = newIdx;
    }

    if (this.screen.extraRows !== visible.length) {
      this.screen.setExtraRows(visible.length);
    }
    this._renderSuggestions();
  }

  /**
   * Close the suggestion panel.
   */
  closeSuggestions(): void {
    if (!this._suggestionOpen) return;
    this._suggestionOpen = false;
    this._suggestions = [];
    this._suggestionIndex = -1;
    this._suggestionOriginalInput = '';
    this.screen.setExtraRows(0);
  }

  /** Move suggestion selection down, returns selected command */
  suggestionDown(): string | null {
    if (!this._suggestionOpen || this._suggestions.length === 0) return null;
    this._suggestionIndex = this._suggestionIndex < this._suggestions.length - 1
      ? this._suggestionIndex + 1 : 0;
    this._renderSuggestions();
    return this._suggestions[this._suggestionIndex].cmd;
  }

  /** Move suggestion selection up, returns selected command */
  suggestionUp(): string | null {
    if (!this._suggestionOpen || this._suggestions.length === 0) return null;
    this._suggestionIndex = this._suggestionIndex > 0
      ? this._suggestionIndex - 1
      : this._suggestions.length - 1;
    this._renderSuggestions();
    return this._suggestions[this._suggestionIndex].cmd;
  }

  /** Confirm current suggestion selection */
  confirmSuggestion(): string | null {
    if (!this._suggestionOpen || this._suggestions.length === 0) return null;
    if (this._suggestionIndex < 0) this._suggestionIndex = 0;
    const cmd = this._suggestions[this._suggestionIndex].cmd;
    this.closeSuggestions();
    return cmd;
  }

  // ─── Private: Render ───────────────────────────────────────────────────

  private _renderCurrentLine(): void {
    if (!this.screen.isActive) return;

    const line = this.currentLine;
    const cursor = this.cursorPos;

    if (this._muted) {
      // Type-ahead preview (dim) with proper cursor positioning
      // eslint-disable-next-line no-control-regex
      const visibleLine = line.replace(/\x01\d+:/g, '[').replace(/\x02/g, ']');
      const visibleCursor = this._rawToVisibleCursor(line, cursor);
      const styledLine = visibleLine ? chalk.dim(visibleLine) : '';
      this.screen.renderInput(styledLine, visibleCursor);
      return;
    }

    // Build display text: strip badge markers for visible width, style badges cyan.
    // Badge markers: \x01 id:label \x02 — embedded in readline's .line.
    // Cursor moves freely through the entire line including badge markers.
    const maxContent = (this.terminal.cols || 80) - 6; // matches screen.ts: 2 border + ❯ + spaces

    // Strip invisible marker chars (\x01, \x02) for display — keep the label text
    // eslint-disable-next-line no-control-regex
    const visibleLine = line.replace(/\x01\d+:/g, '[').replace(/\x02/g, ']');
    // Map cursor from raw line (with markers) to visible line (without \x01id: and \x02)
    const visibleCursor = this._rawToVisibleCursor(line, cursor);

    // Style badge labels cyan: [📋 N lines] → chalk.cyan(...)
    const styledLine = visibleLine.replace(/(\[📋[^\]]*\])/g, (m) => chalk.cyan(m));

    if (maxContent > 0 && visibleLine.length > maxContent) {
      // Auto-wrap: split VISIBLE text into visual lines
      const rawLines: string[] = [];
      for (let i = 0; i < visibleLine.length; i += maxContent) {
        rawLines.push(visibleLine.slice(i, i + maxContent));
      }
      // If cursor at exact boundary, add empty line for cursor
      if (visibleLine.length > 0 && visibleLine.length % maxContent === 0 && visibleCursor === visibleLine.length) {
        rawLines.push('');
      }

      // Style badges in wrapped lines
      const styledLines = rawLines.map(seg => seg.replace(/(\[📋[^\]]*\])/g, (m) => chalk.cyan(m)));

      const cursorVisualLine = Math.min(Math.floor(visibleCursor / maxContent), styledLines.length - 1);
      const cursorVisualCol = visibleCursor % maxContent;

      this.screen.setInputFrameLines(styledLines.length);
      this.screen.renderMultiLineInput(styledLines, cursorVisualLine, cursorVisualCol);
    } else {
      // Single line — shrink frame if it was expanded
      if (this.screen.inputFrameLines > 1) {
        this.screen.setInputFrameLines(1);
      }
      this.screen.renderInput(styledLine, visibleCursor);
    }
  }

  // ─── Private: Badge cursor mapping ──────────────────────────────────

  /**
   * Map cursor position from raw line (with \x01id:...\x02 markers)
   * to visible line (with [...] brackets instead of markers).
   */
  private _rawToVisibleCursor(rawLine: string, rawCursor: number): number {
    let visible = 0;
    let i = 0;
    while (i < rawCursor && i < rawLine.length) {
      if (rawLine[i] === '\x01') {
        // Skip \x01 + digits + colon → replaced with [
        visible++; // the [ bracket
        i++; // skip \x01
        while (i < rawLine.length && rawLine[i] !== ':' && i < rawCursor) i++;
        if (i < rawLine.length && rawLine[i] === ':') i++; // skip :
      } else if (rawLine[i] === '\x02') {
        // \x02 → replaced with ]
        visible++;
        i++;
      } else {
        visible++;
        i++;
      }
    }
    return visible;
  }

  // ─── Private: Multi-line helpers ──────────────────────────────────────

  /** Insert a newline at the cursor position (Shift+Enter) */
  private _insertNewline(): void {
    const line = this.currentLine;
    const cursor = this.cursorPos;

    // Split current line at cursor into two lines
    const before = line.slice(0, cursor);
    const after = line.slice(cursor);

    // Update multi-line array
    this._multiLines[this._multiCursorLine] = before;
    this._multiLines.splice(this._multiCursorLine + 1, 0, after);
    this._multiCursorLine++;

    // Set readline to the new line's content
    (this.rl as any).line = after;
    (this.rl as any).cursor = 0;

    this._renderCurrentLine();
    this.emit('typing', this._getFullText(), 0);
  }

  /** Switch readline to a different line in the multi-line buffer */
  private _switchToLine(lineIdx: number): void {
    // Save current readline state
    this._multiLines[this._multiCursorLine] = this.currentLine;

    // Switch to target line
    this._multiCursorLine = lineIdx;
    const targetLine = this._multiLines[lineIdx];
    (this.rl as any).line = targetLine;
    (this.rl as any).cursor = Math.min(this.cursorPos, targetLine.length);

    this._renderCurrentLine();
  }

  /** Merge current line with the previous one (Backspace at start of line) */
  private _mergeWithPrevLine(): void {
    const prevIdx = this._multiCursorLine - 1;
    const prevLine = this._multiLines[prevIdx];
    const curLine = this.currentLine;
    const newCursor = prevLine.length;

    // Merge: previous line + current line
    this._multiLines[prevIdx] = prevLine + curLine;
    this._multiLines.splice(this._multiCursorLine, 1);
    this._multiCursorLine = prevIdx;

    // Update readline
    (this.rl as any).line = this._multiLines[prevIdx];
    (this.rl as any).cursor = newCursor;

    this._renderCurrentLine();
    this.emit('typing', this._getFullText(), newCursor);
  }

  /** Get the full multi-line text joined with newlines */
  private _getFullText(): string {
    return this._multiLines.join('\n');
  }

  /** Reset multi-line state to single line */
  private _resetMultiLine(): void {
    this._multiLines = [''];
    this._multiCursorLine = 0;
  }

  private _renderSuggestions(): void {
    for (let i = 0; i < this._suggestions.length; i++) {
      const item = this._suggestions[i];
      const isSelected = i === this._suggestionIndex;

      let line: string;
      if (isSelected) {
        line = chalk.cyan.bold(`❯ ${item.cmd}`) + chalk.dim(` — ${item.description}`);
      } else {
        line = chalk.dim(`  ${item.cmd} — ${item.description}`);
      }

      this.screen.setSuggestionRow(i, line);
    }
  }

  // ─── Private: readline intercept ───────────────────────────────────────

  /**
   * Intercept readline's internal _ttyWrite to handle:
   * - Arrow keys when suggestion panel is open
   * - Tab/Enter while panel has selection
   * - ESC to close panel
   */
  private _interceptTtyWrite(): void {
    const origTtyWrite = (this.rl as any)._ttyWrite.bind(this.rl);
    const self = this;

    (this.rl as any)._ttyWrite = function (s: string | null, key: any): void {
      // During bracketed paste, suppress ALL input to prevent readline buffer pollution
      if (self._suppressInput) return;

      // Suggestion panel navigation
      if (self._suggestionOpen) {
        if (key?.name === 'down') {
          const cmd = self.suggestionDown();
          if (cmd) {
            self.setLine(cmd + ' ');
          }
          return;
        }
        if (key?.name === 'up') {
          const cmd = self.suggestionUp();
          if (cmd) {
            self.setLine(cmd + ' ');
          }
          return;
        }
        if (key?.name === 'tab') {
          const cmd = self.confirmSuggestion();
          if (cmd) {
            self.setLine(cmd + ' ');
          }
          return;
        }
        if (key?.name === 'return') {
          if (self._suggestionIndex >= 0) {
            const cmd = self.confirmSuggestion();
            if (cmd) {
              self.setLine(cmd + ' ');
            }
            return; // Don't submit — just confirm selection
          }
          // No selection — fall through to normal Enter handling
        }
        if (key?.name === 'escape') {
          self.closeSuggestions();
          // Restore original input
          self.setLine(self._suggestionOriginalInput);
          return;
        }
      }

      // Shift+Enter → insert newline (multi-line input)
      if (key?.name === 'return' && key?.shift) {
        self._insertNewline();
        return;
      }

      // Multi-line navigation: Up/Down move between lines when multi-line is active
      if (self._multiLines.length > 1) {
        if (key?.name === 'up' && !self._suggestionOpen && self._multiCursorLine > 0) {
          self._switchToLine(self._multiCursorLine - 1);
          return;
        }
        if (key?.name === 'down' && !self._suggestionOpen && self._multiCursorLine < self._multiLines.length - 1) {
          self._switchToLine(self._multiCursorLine + 1);
          return;
        }
      }

      // Backspace at start of line in multi-line → merge with previous line
      if (key?.name === 'backspace' && self._multiLines.length > 1 && self._multiCursorLine > 0) {
        if (self.cursorPos === 0) {
          self._mergeWithPrevLine();
          return;
        }
      }

      // Paste badges are inline in the text — backspace works naturally through readline.
      // No special handling needed — deleting marker chars removes the badge.

      // Shift+Tab → cycle permission mode
      if (key?.name === 'tab' && key?.shift) {
        self.emit('shift-tab');
        return;
      }

      // Tab completion (when panel is not open)
      if (key?.name === 'tab' && !self._suggestionOpen) {
        const line = self.currentLine;
        if (line.startsWith('/') && self._getSuggestions) {
          const items = self._getSuggestions(line);
          if (items.length === 1) {
            // Single match — complete immediately
            self.setLine(items[0].cmd + ' ');
          } else if (items.length > 1) {
            // Multiple matches — open panel
            self.openSuggestions(items, line);
          }
        }
        return;
      }

      // Pass to readline
      origTtyWrite(s, key);

      // Sync readline's line back into the multi-line array
      self._multiLines[self._multiCursorLine] = self.currentLine;

      // After readline processes the key, re-render and update suggestions
      self._renderCurrentLine();

      // Live-update suggestions while typing
      const newLine = self.currentLine;
      if (newLine.startsWith('/') && newLine.length >= 2 && self._getSuggestions) {
        const items = self._getSuggestions(newLine);
        if (items.length > 0) {
          if (self._suggestionOpen) {
            self.updateSuggestions(items, newLine);
          } else {
            self.openSuggestions(items, newLine);
          }
        } else if (self._suggestionOpen) {
          self.closeSuggestions();
        }
      } else if (self._suggestionOpen && !newLine.startsWith('/')) {
        self.closeSuggestions();
      }

      // Emit typing event
      self.emit('typing', newLine, self.cursorPos);
    };
  }

  // ─── Private: Keypress Handling ────────────────────────────────────────

  private _registerKeypress(): void {
    // Raw data handler (runs BEFORE readline) for ESC detection.
    // Bracketed paste detection is handled by chat.ts which has full context
    // (agentRunning state, typeAheadBuffer, etc.) and sets suppressInput
    // to prevent readline from accumulating paste characters.
    process.stdin.prependListener('data', (data: Buffer) => {
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // ── Shift+Enter / Alt+Enter → insert newline (multi-line input) ──
      // With Kitty keyboard protocol: Shift+Enter = \x1b[13;2u, Alt+Enter = \x1b[13;3u
      // With xterm modifyOtherKeys: Shift+Enter = \x1b[27;2;13~
      // Legacy: Alt+Enter = \x1b\r or \x1b\n
      // IMPORTANT: suppress readline for this event — return alone doesn't prevent
      // other data listeners from processing these bytes through _ttyWrite.
      const str = bytes.toString('utf8');
      if (
        str === '\x1b[13;2u' ||                                         // Shift+Enter (kitty)
        str === '\x1b[13;3u' ||                                         // Alt+Enter (kitty)
        str === '\x1b[27;2;13~' ||                                      // Shift+Enter (xterm modifyOtherKeys)
        str === '\x1b[27;3;13~' ||                                      // Alt+Enter (xterm modifyOtherKeys)
        (bytes.length === 2 && bytes[0] === 0x1b && (bytes[1] === 0x0d || bytes[1] === 0x0a)) // Alt+Enter (legacy)
      ) {
        if (this._isPrompting && !this._muted) {
          // Suppress readline from processing these bytes as keypresses
          this._suppressInput = true;
          this._insertNewline();
          setImmediate(() => { this._suppressInput = false; });
        }
        return;
      }

      // ── ESC detection ──
      if (bytes.length === 1 && bytes[0] === 0x1b) {
        // ESC clears multi-line first
        if (this._multiLines.length > 1) {
          this._resetMultiLine();
          (this.rl as any).line = '';
          (this.rl as any).cursor = 0;
          this._renderCurrentLine();
          return;
        }
        // ESC clears paste block (before triggering escape/double-escape)
        if (this._pasteBlock) {
          this.clearPasteBlock();
          return;
        }

        const now = Date.now();
        if (now - this._lastEscTime < ESC_DOUBLE_THRESHOLD) {
          this._lastEscTime = 0;
          this.emit('double-escape');
          return;
        }
        this._lastEscTime = now;
        // Delay to check for double-ESC
        setTimeout(() => {
          if (this._lastEscTime === now) {
            this.emit('escape');
          }
        }, ESC_DOUBLE_THRESHOLD);
        // Don't consume — let readline handle ESC for its own purposes
      }
    });

    // Keypress handler for Ctrl+C, Shift+Tab, session switching
    process.stdin.on('keypress', (_str: string, key: any) => {
      if (!key) return;

      // Ctrl+C handling
      if (key.name === 'c' && key.ctrl) {
        this._handleCtrlC();
        return;
      }
    });
  }

  // ─── Private: Line Handler ─────────────────────────────────────────────

  private _registerLineHandler(): void {
    this.rl.on('line', (rawLine: string) => {
      // Guard: skip phantom events from sub-menus
      if (Date.now() < this._drainUntil) return;

      // Sync current readline line into multi-line array before assembling
      this._multiLines[this._multiCursorLine] = rawLine;

      // Assemble full text from all lines
      const fullText = this._multiLines.length > 1
        ? this._multiLines.join('\n').trim()
        : rawLine.trim();

      // Reset multi-line state
      this._resetMultiLine();

      this._isPrompting = false;
      this.screen.inputActive = false;

      // Close suggestion panel if open
      if (this._suggestionOpen) {
        this.closeSuggestions();
      }

      // Resolve inline paste badges → replace markers with actual paste text.
      // NOTE: Do NOT clear _pasteStore here — chat.ts has its own rl.on('line')
      // handler that also needs to resolve badges. Store is cleared via clearPasteBlock().
      let finalLine = this.resolveBadges(fullText);
      this._pasteBlock = null;
      this._pendingPasteText = null;

      // Shrink frame if it was multi-line
      if (this.screen.inputFrameLines > 1) {
        this.screen.setInputFrameLines(1);
      }

      // Reset Ctrl+C counter
      this._ctrlCCount = 0;

      this.emit('submit', finalLine);
    });
  }

  // ─── Private: Bracketed Paste ──────────────────────────────────────────

  private _registerBracketedPaste(): void {
    // The actual paste detection happens in the raw data handler above.
    // This is just for the non-bracketed fallback (legacy paste detection).
  }

  // ─── Private: Ctrl+C ──────────────────────────────────────────────────

  private _handleCtrlC(): void {
    this._ctrlCCount++;

    // If multi-line, clear all
    if (this._multiLines.length > 1) {
      this.clearLine();
      this._ctrlCCount = 0;
      return;
    }

    // If there's input, clear it
    const line = this.currentLine;
    if (line.length > 0) {
      this.clearLine();
      this._ctrlCCount = 0;
      return;
    }

    // If paste is pending, clear it
    if (this._pendingPasteText) {
      this._pendingPasteText = null;
      this.clearLine();
      this._ctrlCCount = 0;
      return;
    }

    // Empty line — emit ctrl-c for exit handling
    this.emit('ctrl-c');

    if (this._ctrlCTimer) clearTimeout(this._ctrlCTimer);
    this._ctrlCTimer = setTimeout(() => { this._ctrlCCount = 0; }, 2000);
  }
}
