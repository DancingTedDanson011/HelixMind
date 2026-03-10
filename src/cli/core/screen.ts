/**
 * Screen — Central screen zone manager.
 *
 * Replaces BottomChrome with a clean architecture:
 * - Manages scroll region, input frame, suggestions, and chrome rows
 * - Single stdout intercept for backward compatibility
 * - Dirty-check double-buffer prevents redundant redraws
 * - Input frame with visible borders (╭─ │ ╰─) like Claude Code
 *
 * Layout (from bottom of terminal):
 *   Row N:          Chrome row 3 — statusbar line 2
 *   Row N-1:        Chrome row 2 — statusbar line 1
 *   Row N-2:        Chrome row 1 — hints
 *   Row N-3:        Chrome row 0 — activity indicator / separator
 *   Rows N-4...:    Suggestion rows (0-6, dynamic)
 *   Row input:      │ ❯ user input_              (input line, inside frame)
 *   Row frameTop:   ╭────────────────────╮       (frame top border)
 *   Rows 1..scroll: Output scroll region          (scrollable content)
 *
 * The input frame is always visible. Suggestions expand the frame downward.
 * During agent work, chrome row 0 shows the activity indicator.
 * When idle, chrome row 0 shows the frame bottom border ╰────╯.
 *
 * Web App Integration:
 * - Provides onWrite callback for StdoutCapture (brain server streaming)
 * - All output goes through writeOutput() which triggers the callback
 * - Chrome/frame redraws bypass the callback (only user-visible output is streamed)
 */

import chalk from 'chalk';
import { type Terminal, ANSI, visibleLength, moveTo, clearLineAt } from './terminal.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHROME_ROWS = 4;       // activity/separator, hints, statusbar×2
const MIN_TERMINAL_HEIGHT = 12;
const MAX_INPUT_FRAME_LINES = 8; // max visible input lines in frame

// Box-drawing characters for the input frame
const FRAME = {
  TOP_LEFT: '╭',
  TOP_RIGHT: '╮',
  BOTTOM_LEFT: '╰',
  BOTTOM_RIGHT: '╯',
  HORIZONTAL: '─',
  VERTICAL: '│',
  T_RIGHT: '├',
  T_LEFT: '┤',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChromeRowIndex = 0 | 1 | 2 | 3;

export interface ScreenOptions {
  /** Called for every user-visible output write (for web streaming / StdoutCapture) */
  onOutputWrite?: (data: string) => void;
  /** Frame border color (default: #00d4ff) */
  frameColor?: string;
  /** Live cursor position callback — returns current cursor col offset within the input line.
   *  Used by stdout hook and chrome redraws to restore cursor accurately during user typing. */
  getLiveInputCursor?: () => number;
}

// ─── Screen Class ────────────────────────────────────────────────────────────

export class Screen {
  private terminal: Terminal;
  private _active = false;
  private _inlineMode = false;
  private _originalWrite: ((...args: any[]) => boolean) | null = null;
  private _redrawScheduled = false;

  // Content state
  private _chromeContent: [string, string, string, string] = ['', '', '', ''];
  private _prevChromeContent: [string, string, string, string] = ['', '', '', ''];
  private _suggestionContent: string[] = [];
  private _prevSuggestionContent: string[] = [];
  private _extraRows = 0;

  // Input frame state (supports multi-line: paste preview, wrapped text)
  private _inputFrameLines = 1;   // number of content lines in frame (1 = single line)
  private _inputLine = '';
  private _inputBadge = '';       // visual-only badge (e.g., paste block indicator)
  private _inputCursorPos = 0;
  private _prevInputLine = '';
  private _inputLines: string[] = [];      // multi-line content
  private _prevInputLines: string[] = [];  // dirty-check
  private _inputCursorLine = 0;            // which line the cursor is on
  private _frameVisible = true;

  // Guard flag: suppress hook redraws while input is being managed externally
  private _inputActive = false;

  // Suspended mode: screen deactivated but stdout hook still active, buffering writes.
  // Used during sub-menus so background output doesn't corrupt the menu.
  private _suspended = false;
  private _suspendedBuffer: string[] = [];

  // Callbacks
  private _onOutputWrite: ((data: string) => void) | null;
  private _getLiveInputCursor: (() => number) | null;
  private _frameColor: string;

  constructor(terminal: Terminal, options: ScreenOptions = {}) {
    this.terminal = terminal;
    this._onOutputWrite = options.onOutputWrite ?? null;
    this._getLiveInputCursor = options.getLiveInputCursor ?? null;
    this._frameColor = options.frameColor ?? '#00d4ff';
  }

  // ─── Getters (BottomChrome-compatible) ─────────────────────────────────

  get isActive(): boolean { return this._active; }
  get isInlineMode(): boolean { return this._inlineMode; }
  get baseRows(): number { return CHROME_ROWS; }
  get extraRows(): number { return this._extraRows; }
  get inputFrameLines(): number { return this._inputFrameLines; }

  /** Frame rows = 1 (top border) + N input content lines */
  private get _frameRows(): number {
    return 1 + this._inputFrameLines;
  }

  /** Total rows reserved at bottom: frame + suggestions + chrome(4) */
  get totalReservedRows(): number {
    if (this._inlineMode) return 0;
    return this._frameRows + this._extraRows + CHROME_ROWS;
  }

  get reservedRows(): number { return this.totalReservedRows; }

  /** Row where the first input line lives (with ❯ prompt) */
  get inputRow(): number {
    return this.terminal.rows - CHROME_ROWS - this._extraRows - this._inputFrameLines + 1;
  }

  /** Row where the last input line lives */
  get lastInputRow(): number {
    return this.inputRow + this._inputFrameLines - 1;
  }

  /** Row where the frame top border lives */
  get frameTopRow(): number {
    return this.inputRow - 1;
  }

  /** Bottom of the scroll region (last row where output can scroll) */
  get scrollEnd(): number {
    return this.frameTopRow - 1;
  }

  /** BottomChrome-compatible: row where readline prompt would go */
  get promptRow(): number {
    return this.inputRow;
  }

  // ─── Activation ────────────────────────────────────────────────────────

  activate(): void {
    if (this._active) return;
    if (!this.terminal.isTTY) {
      this._inlineMode = true;
      return;
    }

    const rows = this.terminal.rows;
    if (rows < MIN_TERMINAL_HEIGHT) {
      this._inlineMode = true;
      return;
    }

    this._inlineMode = false;
    this._active = true;
    // Leave suspended mode — stdout hook was kept active during deactivation
    const wasSuspended = this._suspended;
    this._suspended = false;
    this._updateScrollRegion();
    if (!wasSuspended) {
      // Fresh activation or returning from fullscreen overlay — (re)install stdout hook
      this._hookStdout();
    }
    // Force full draw
    this._prevChromeContent = ['', '', '', ''];
    this._prevSuggestionContent = [];
    this._prevInputLine = '';
    this.redraw();
    // Flush any output that was buffered during suspended mode
    if (wasSuspended && this._suspendedBuffer.length > 0) {
      const buffered = this._suspendedBuffer.join('');
      this._suspendedBuffer = [];
      this.writeOutput(buffered);
    }
  }

  /**
   * Deactivate the screen.
   * @param options.suspend  Keep stdout hook active and buffer writes (default: true).
   *   Use `suspend: false` for fullscreen overlays (e.g. Rewind browser) that need
   *   direct stdout access — the hook is removed entirely so process.stdout.write works normally.
   */
  deactivate(options?: { suspend?: boolean }): void {
    if (!this._active) return;
    this._active = false;
    const suspend = options?.suspend ?? true;
    // Remember scroll end before clearing (frameTopRow depends on _inputFrameLines/_extraRows)
    const scrollBottom = this.scrollEnd;
    this._clearAllFixed();
    this.terminal.resetScrollRegion();
    // Position cursor at the old scroll region bottom so subsequent writes
    // (e.g. selectMenu) start from a predictable position above the cleared area.
    this._rawWrite(`\x1b[${scrollBottom};1H`);
    if (suspend) {
      // Enter suspended mode: keep stdout hook active but buffer all writes.
      // This prevents background output (session completion, agent results) from
      // corrupting interactive sub-menus that render on the raw terminal.
      this._suspended = true;
      this._suspendedBuffer = [];
    } else {
      // Fullscreen overlay mode: remove stdout hook entirely so the overlay
      // can write directly to the terminal without buffering interference.
      this._suspended = false;
      this._suspendedBuffer = [];
      this._unhookStdout();
    }
    this._chromeContent = ['', '', '', ''];
    this._prevChromeContent = ['', '', '', ''];
    this._extraRows = 0;
    this._inputFrameLines = 1;
    this._suggestionContent = [];
    this._prevSuggestionContent = [];
    this._inputLine = '';
    this._inputBadge = '';
    this._prevInputLine = '';
    this._inputLines = [];
    this._prevInputLines = [];
    this._inputCursorLine = 0;
  }

  // ─── Input Active Guard ────────────────────────────────────────────────

  /**
   * Suppress stdout hook redraws while the InputManager is handling cursor.
   * Prevents interference between readline echo and chrome repaints.
   */
  set inputActive(active: boolean) {
    this._inputActive = active;
  }

  get inputActive(): boolean {
    return this._inputActive;
  }

  /** Get current input cursor position — live from readline if available, else cached. */
  private _liveInputCursorPos(): number {
    return this._getLiveInputCursor?.() ?? this._inputCursorPos;
  }

  // ─── Output Zone (scrollable) ──────────────────────────────────────────

  /**
   * Write content to the output zone (scroll region).
   * This is the primary method for agent output, tool results, etc.
   * Triggers the onOutputWrite callback for web streaming.
   */
  writeOutput(data: string): void {
    if (!this._active) {
      this._rawWrite(data);
      this._onOutputWrite?.(data);
      return;
    }

    // Ensure cursor is in scroll region before writing
    const scrollEnd = this.scrollEnd;
    this._rawWrite(
      ANSI.HIDE_CURSOR +
      moveTo(scrollEnd, 1) +   // position at scroll region bottom
      data,
    );

    // Callback for web streaming (only user-visible output, not chrome redraws)
    this._onOutputWrite?.(data);

    // Schedule chrome redraw in case output scrolled past the region
    if (data.includes('\n')) {
      this._scheduleRedraw();
    }
  }

  // ─── Input Frame ───────────────────────────────────────────────────────

  /**
   * Draw the input frame with the given content and cursor position.
   * Called by InputManager whenever the input changes.
   *
   * @param badge Optional visual-only badge (e.g. paste block indicator).
   *              Rendered after the text but does NOT affect cursor positioning.
   */
  renderInput(line: string, cursorPos: number, badge?: string): void {
    this._inputLine = line;
    this._inputCursorPos = cursorPos;
    this._inputBadge = badge || '';

    if (!this._active || this._inlineMode) return;

    const row = this.inputRow;
    const cols = this.terminal.cols;
    const fc = chalk.hex(this._frameColor).dim;

    // Build input line: │ ❯ content[badge]          │
    const maxContent = cols - 6; // 2 border + space + ❯ + space + right border
    const displayLine = line.length > maxContent ? line.slice(line.length - maxContent) : line;
    const badgeVisLen = this._inputBadge ? visibleLength(this._inputBadge) : 0;
    const padding = Math.max(0, maxContent - visibleLength(displayLine) - badgeVisLen);

    const inputLineStr =
      fc(FRAME.VERTICAL) + ' ' +
      chalk.hex(this._frameColor)('❯') + ' ' +
      displayLine +
      this._inputBadge +
      ' '.repeat(padding) +
      ' ' + fc(FRAME.VERTICAL);

    // Only redraw if changed
    if (inputLineStr !== this._prevInputLine) {
      // Cursor position based on user text only — badge is after cursor
      const cursorCol = 5 + Math.min(cursorPos, maxContent);

      this._rawWrite(
        ANSI.HIDE_CURSOR +
        `\x1b[${row};1H${ANSI.CLEAR_LINE}` +
        inputLineStr +
        `\x1b[${row};${cursorCol}H` +
        ANSI.SHOW_CURSOR,
      );

      this._prevInputLine = inputLineStr;
    } else {
      // Content unchanged — just position cursor
      const cursorCol = 5 + Math.min(cursorPos, maxContent);
      this._rawWrite(`\x1b[${row};${cursorCol}H${ANSI.SHOW_CURSOR}`);
    }
  }

  /**
   * Draw the frame top border.
   */
  drawFrameTop(): void {
    if (!this._active || this._inlineMode) return;

    const row = this.frameTopRow;
    const cols = this.terminal.cols;
    const fc = chalk.hex(this._frameColor).dim;

    const border = fc(FRAME.TOP_LEFT + FRAME.HORIZONTAL.repeat(cols - 2) + FRAME.TOP_RIGHT);

    this._rawWrite(
      ANSI.HIDE_CURSOR +
      `\x1b[${row};1H${ANSI.CLEAR_LINE}` +
      border +
      ANSI.SHOW_CURSOR,
    );
  }

  /**
   * Draw the frame bottom border (embedded in chrome row 0 when idle).
   * When activity content is provided, it's shown inside the border.
   */
  drawFrameBottom(activityContent?: string): void {
    if (!this._active || this._inlineMode) return;

    const cols = this.terminal.cols;
    const fc = chalk.hex(this._frameColor).dim;

    let content: string;
    if (activityContent) {
      // Embed activity in the bottom border: ╰── ◇ HelixMind working... ──╯
      const actLen = visibleLength(activityContent);
      const availBorder = cols - 5 - actLen; // ╰─(2) + space(1) + activity + space(1) + ─╯(1)
      const rightBorder = Math.max(0, availBorder);
      content = fc(FRAME.BOTTOM_LEFT + FRAME.HORIZONTAL) + ' ' +
        activityContent + ' ' +
        fc(FRAME.HORIZONTAL.repeat(rightBorder) + FRAME.BOTTOM_RIGHT);
    } else {
      // Plain bottom border
      content = fc(FRAME.BOTTOM_LEFT + FRAME.HORIZONTAL.repeat(cols - 2) + FRAME.BOTTOM_RIGHT);
    }

    // Set as chrome row 0 content
    this._chromeContent[0] = content;
    if (!this._active || this._inlineMode) return;
    this._drawChromeRow(0);
    this._prevChromeContent[0] = content;
  }

  /**
   * Position cursor at the input line for readline prompt.
   * Called before readline.prompt() to ensure correct cursor placement.
   */
  positionCursorForInput(): void {
    if (this._inlineMode || !this._active) return;
    const row = this.inputRow;
    const cursorCol = 5 + this._inputCursorPos;
    this._rawWrite(moveTo(row, cursorCol));
  }

  /**
   * Write content at the input row (for type-ahead preview during agent work).
   * Replaces the input content without disturbing cursor elsewhere.
   */
  writeAtInputRow(content: string): void {
    if (this._inlineMode || !this._active) return;

    const row = this.inputRow;
    const cols = this.terminal.cols;
    const fc = chalk.hex(this._frameColor).dim;

    // Build framed line
    const maxContent = cols - 6;
    const padding = Math.max(0, maxContent - visibleLength(content));
    const line =
      fc(FRAME.VERTICAL) + ' ' +
      chalk.hex(this._frameColor)('❯') + ' ' +
      content +
      ' '.repeat(padding) +
      ' ' + fc(FRAME.VERTICAL);

    this._rawWrite(
      ANSI.HIDE_CURSOR +
      `\x1b[${row};1H${ANSI.CLEAR_LINE}` +
      line +
      moveTo(row, 1) +
      ANSI.SHOW_CURSOR,
    );
  }

  /**
   * Clear the input frame (frame top + all input lines + any suggestion rows).
   * Called when user submits input, before rendering the formatted user message.
   */
  clearInputFrame(): void {
    if (this._inlineMode || !this._active) return;

    const frameTop = this.frameTopRow;
    const rowsToClear = this._frameRows + this._extraRows; // frame top + input lines + suggestions

    let seq = ANSI.HIDE_CURSOR;
    for (let i = 0; i < rowsToClear; i++) {
      seq += `\x1b[${frameTop + i};1H${ANSI.CLEAR_LINE}`;
    }
    // Position cursor in scroll region so subsequent stdout writes go there
    seq += moveTo(this.scrollEnd, 1) + ANSI.SHOW_CURSOR;
    this._rawWrite(seq);

    this._inputLine = '';
    this._inputBadge = '';
    this._prevInputLine = '';
    this._inputCursorPos = 0;
    this._inputLines = [];
    this._prevInputLines = [];
    this._inputCursorLine = 0;

    // Reset to single line and update scroll region
    if (this._inputFrameLines > 1) {
      this._inputFrameLines = 1;
      this._updateScrollRegion();
    }
  }

  // ─── Multi-Line Input Frame ─────────────────────────────────────────

  /**
   * Set the number of visible input lines in the frame.
   * Frame grows/shrinks to accommodate (e.g., paste preview lines).
   * Triggers scroll region update and full redraw.
   */
  setInputFrameLines(n: number): void {
    const maxLines = Math.max(1, Math.min(n, MAX_INPUT_FRAME_LINES,
      this.terminal.rows - MIN_TERMINAL_HEIGHT - CHROME_ROWS - this._extraRows));
    if (maxLines === this._inputFrameLines) return;

    const old = this._inputFrameLines;
    this._inputFrameLines = maxLines;

    if (!this._active || this._inlineMode) return;

    // Clear old frame area before resizing
    this._clearFrameArea(old);
    this._updateScrollRegion();
    // Force full redraw (positions changed)
    this._prevChromeContent = ['', '', '', ''];
    this._prevInputLine = '';
    this._prevInputLines = [];
    this.redraw();
  }

  /**
   * Render multiple input lines in the frame.
   * First line shows ❯ prompt, subsequent lines show indented content.
   * Used for paste preview and wrapped text.
   *
   * @param lines Array of display lines (already split/wrapped)
   * @param cursorLine Which line the cursor is on (0-based)
   * @param cursorCol Cursor column within that line
   */
  renderMultiLineInput(lines: string[], cursorLine: number, cursorCol: number): void {
    this._inputLines = lines;
    this._inputCursorLine = cursorLine;
    this._inputCursorPos = cursorCol;

    if (!this._active || this._inlineMode) return;

    const cols = this.terminal.cols;
    const fc = chalk.hex(this._frameColor).dim;
    const maxContent = cols - 6;

    let buf = ANSI.HIDE_CURSOR;
    let changed = false;

    for (let i = 0; i < this._inputFrameLines; i++) {
      const row = this.inputRow + i;
      const content = lines[i] || '';
      const displayContent = visibleLength(content) > maxContent
        ? content.slice(0, maxContent) : content;
      const padding = Math.max(0, maxContent - visibleLength(displayContent));

      let lineStr: string;
      if (i === 0) {
        // First line: │ ❯ content │
        lineStr = fc(FRAME.VERTICAL) + ' ' +
          chalk.hex(this._frameColor)('❯') + ' ' +
          displayContent + ' '.repeat(padding) +
          ' ' + fc(FRAME.VERTICAL);
      } else {
        // Subsequent lines: │   content │
        lineStr = fc(FRAME.VERTICAL) + '   ' +
          displayContent + ' '.repeat(padding) +
          ' ' + fc(FRAME.VERTICAL);
      }

      if (!this._prevInputLines[i] || lineStr !== this._prevInputLines[i]) {
        buf += `\x1b[${row};1H${ANSI.CLEAR_LINE}` + lineStr;
        this._prevInputLines[i] = lineStr;
        changed = true;
      }
    }

    if (changed) {
      // Position cursor on the correct line and column
      const cRow = this.inputRow + cursorLine;
      const cCol = 5 + Math.min(cursorCol, maxContent);
      buf += `\x1b[${cRow};${cCol}H` + ANSI.SHOW_CURSOR;
      this._rawWrite(buf);
    } else {
      // Just reposition cursor
      const cRow = this.inputRow + cursorLine;
      const cCol = 5 + Math.min(cursorCol, maxContent);
      this._rawWrite(`\x1b[${cRow};${cCol}H${ANSI.SHOW_CURSOR}`);
    }
  }

  /** Clear the old frame area when resizing */
  private _clearFrameArea(oldInputFrameLines: number): void {
    const rows = this.terminal.rows;
    const oldFrameRows = 1 + oldInputFrameLines;
    const newFrameRows = this._frameRows;
    const oldTotal = oldFrameRows + this._extraRows + CHROME_ROWS;
    const newTotal = newFrameRows + this._extraRows + CHROME_ROWS;

    const oldFrameTop = rows - oldTotal + 1;
    const newFrameTop = rows - newTotal + 1;
    const startRow = Math.min(oldFrameTop, newFrameTop);
    const endRow = rows - CHROME_ROWS;

    let buf = '';
    for (let i = startRow; i <= endRow; i++) {
      buf += clearLineAt(i);
    }
    this._rawWrite(buf);
  }

  // ─── Chrome Rows ───────────────────────────────────────────────────────

  /**
   * Update a chrome row. BottomChrome-compatible API.
   * @param index 0 = activity/frame-bottom, 1 = hints, 2 = statusbar L1, 3 = statusbar L2
   */
  setRow(index: ChromeRowIndex, content: string): void {
    if (this._chromeContent[index] === content) return;
    this._chromeContent[index] = content;
    if (!this._active || this._inlineMode) return;
    this._drawChromeRow(index);
    this._prevChromeContent[index] = content;
  }

  // ─── Suggestion Rows ──────────────────────────────────────────────────

  /**
   * Set the number of suggestion rows. Re-establishes scroll region.
   */
  setExtraRows(n: number): void {
    const maxExtra = Math.max(0, this.terminal.rows - MIN_TERMINAL_HEIGHT - CHROME_ROWS - this._frameRows);
    const clamped = Math.max(0, Math.min(n, maxExtra));
    if (clamped === this._extraRows) return;

    const oldExtra = this._extraRows;
    this._extraRows = clamped;
    this._suggestionContent = new Array(clamped).fill('');
    this._prevSuggestionContent = new Array(clamped).fill('');

    if (!this._active || this._inlineMode) return;

    // Clear old suggestion area + frame before resizing
    this._clearSuggestionArea(oldExtra);
    this._updateScrollRegion();
    // Force full redraw (positions changed)
    this._prevChromeContent = ['', '', '', ''];
    this._prevInputLine = '';
    this.redraw();
  }

  /**
   * Write content to a suggestion row (inside the frame).
   */
  setSuggestionRow(index: number, content: string): void {
    if (index < 0 || index >= this._extraRows) return;
    if (this._suggestionContent[index] === content) return;
    this._suggestionContent[index] = content;
    if (!this._active || this._inlineMode) return;
    this._drawSuggestionRow(index);
    this._prevSuggestionContent[index] = content;
  }

  // ─── Redraw & Resize ──────────────────────────────────────────────────

  /**
   * Full redraw of all fixed zones (frame, suggestions, chrome).
   * Uses dirty-check: only redraws rows that changed.
   */
  redraw(): void {
    if (!this._active || this._inlineMode) return;

    const rows = this.terminal.rows;
    const cols = this.terminal.cols;

    let buf = ANSI.HIDE_CURSOR;

    // Frame top
    const ftRow = this.frameTopRow;
    const fc = chalk.hex(this._frameColor).dim;
    buf += `\x1b[${ftRow};1H${ANSI.CLEAR_LINE}` +
      fc(FRAME.TOP_LEFT + FRAME.HORIZONTAL.repeat(cols - 2) + FRAME.TOP_RIGHT);

    // Input lines (1 or more)
    const iRow = this.inputRow;
    const maxContent = cols - 6;

    if (this._inputFrameLines > 1 && this._inputLines.length > 0) {
      // Multi-line mode
      for (let li = 0; li < this._inputFrameLines; li++) {
        const r = iRow + li;
        const content = this._inputLines[li] || '';
        const dc = visibleLength(content) > maxContent ? content.slice(0, maxContent) : content;
        const pad = Math.max(0, maxContent - visibleLength(dc));
        if (li === 0) {
          buf += `\x1b[${r};1H${ANSI.CLEAR_LINE}` +
            fc(FRAME.VERTICAL) + ' ' + chalk.hex(this._frameColor)('❯') + ' ' +
            dc + ' '.repeat(pad) + ' ' + fc(FRAME.VERTICAL);
        } else {
          buf += `\x1b[${r};1H${ANSI.CLEAR_LINE}` +
            fc(FRAME.VERTICAL) + '   ' +
            dc + ' '.repeat(pad) + ' ' + fc(FRAME.VERTICAL);
        }
        this._prevInputLines[li] = content;
      }
    } else {
      // Single-line mode (original behavior)
      const displayLine = this._inputLine.length > maxContent
        ? this._inputLine.slice(this._inputLine.length - maxContent)
        : this._inputLine;
      const badgeVisLen = this._inputBadge ? visibleLength(this._inputBadge) : 0;
      const padding = Math.max(0, maxContent - visibleLength(displayLine) - badgeVisLen);
      buf += `\x1b[${iRow};1H${ANSI.CLEAR_LINE}` +
        fc(FRAME.VERTICAL) + ' ' +
        chalk.hex(this._frameColor)('❯') + ' ' +
        displayLine +
        this._inputBadge +
        ' '.repeat(padding) +
        ' ' + fc(FRAME.VERTICAL);
    }

    // Suggestion rows (inside frame, after all input lines)
    for (let i = 0; i < this._extraRows; i++) {
      const sRow = iRow + this._inputFrameLines + i;
      const sContent = this._suggestionContent[i] || '';
      const sPadding = Math.max(0, cols - 4 - visibleLength(sContent));
      buf += `\x1b[${sRow};1H${ANSI.CLEAR_LINE}` +
        fc(FRAME.VERTICAL) + ' ' + sContent + ' '.repeat(sPadding) + ' ' + fc(FRAME.VERTICAL);
      this._prevSuggestionContent[i] = this._suggestionContent[i];
    }

    // Chrome rows
    const chromeStart = rows - CHROME_ROWS + 1;
    for (let i = 0; i < CHROME_ROWS; i++) {
      const cRow = chromeStart + i;
      // Row 0 = frame bottom (no indent), rows 1-3 = hints/statusbar (1 space indent)
      const prefix = i === 0 ? '' : ' ';
      buf += `\x1b[${cRow};1H${ANSI.CLEAR_LINE}${prefix}${this._chromeContent[i]}`;
      this._prevChromeContent[i] = this._chromeContent[i];
    }

    // Always park cursor in the input frame — visible for both typing and type-ahead.
    {
      const cRow = iRow + this._inputCursorLine;
      const cursorCol = 5 + Math.min(this._liveInputCursorPos(), maxContent);
      buf += moveTo(cRow, cursorCol) + ANSI.SHOW_CURSOR;
    }

    this._rawWrite(buf);
    this._prevInputLine = ''; // force next renderInput to redraw
  }

  handleResize(): void {
    if (!this._active) return;

    const rows = this.terminal.rows;
    if (rows < MIN_TERMINAL_HEIGHT) {
      this.deactivate();
      this._inlineMode = true;
      return;
    }

    this._updateScrollRegion();
    this._prevChromeContent = ['', '', '', ''];
    this._prevSuggestionContent = new Array(this._extraRows).fill('');
    this._prevInputLine = '';
    this.redraw();
  }

  // ─── BottomChrome Compatibility ────────────────────────────────────────

  /** BottomChrome-compatible: position cursor at prompt row */
  positionCursorForPrompt(): void {
    this.positionCursorForInput();
  }

  /** BottomChrome-compatible: suppress hook redraws during input */
  set promptActive(active: boolean) {
    this._inputActive = active;
  }

  /** BottomChrome-compatible: write at prompt row */
  writeAtPromptRow(content: string): void {
    this.writeAtInputRow(content);
  }

  // ─── Web App Integration ───────────────────────────────────────────────

  /** Update the output write callback (for StdoutCapture / brain streaming) */
  setOutputWriteCallback(cb: ((data: string) => void) | null): void {
    this._onOutputWrite = cb;
  }

  // ─── Private: Scroll Region ────────────────────────────────────────────

  private _updateScrollRegion(): void {
    if (!this.terminal.isTTY) return;
    const se = this.scrollEnd;
    if (se < 1) return;
    this._rawWrite(
      `\x1b[1;${se}r` +     // set scroll region
      moveTo(se, 1),         // move cursor into region
    );
  }

  // ─── Private: Stdout Hook ──────────────────────────────────────────────

  /**
   * Monkey-patch process.stdout.write for backward compatibility.
   * Existing code that still calls process.stdout.write() directly
   * (renderInfo, renderToolCall, etc.) gets routed through here.
   *
   * The hook:
   * 1. Writes the data normally (via original write)
   * 2. Triggers onOutputWrite callback for web streaming
   * 3. Schedules a chrome redraw if the write contained newlines
   *
   * This hook is TEMPORARY — as more code migrates to screen.writeOutput(),
   * fewer writes go through the hook. Eventually it can be removed.
   */
  private _hookStdout(): void {
    if (!this.terminal.isTTY || this._originalWrite) return;

    this._originalWrite = process.stdout.write.bind(process.stdout);
    const self = this;

    (process.stdout as any).write = function (...args: any[]): boolean {
      const data = typeof args[0] === 'string' ? args[0] : '';
      const isFrame = data ? self._isFrameContent(data) : false;

      // Suspended mode: buffer writes while sub-menu is active.
      // Prevents background output from corrupting interactive menus.
      if (self._suspended && data && !isFrame) {
        self._suspendedBuffer.push(data);
        // Still stream to web app
        if (self._onOutputWrite) self._onOutputWrite(data);
        return true;
      }

      // Redirect all non-frame output to the scroll region when screen is active.
      // After writing, park cursor in the input frame (visible for type-ahead).
      if (self._active && data && !isFrame) {
        const scrollEnd = self.scrollEnd;
        const inputRow = self.inputRow;
        const cursorCol = 5 + self._liveInputCursorPos();
        // Move to scroll region → write → restore cursor to input frame
        self._originalWrite!(
          ANSI.HIDE_CURSOR +
          `\x1b[${scrollEnd};1H` +
          data +
          `\x1b[${inputRow};${cursorCol}H` +
          ANSI.SHOW_CURSOR,
        );
        // Stream to web app
        if (self._onOutputWrite) {
          self._onOutputWrite(data);
        }
        // Schedule chrome redraw on newlines
        if (!self._redrawScheduled && data.includes('\n')) {
          self._scheduleRedraw();
        }
        return true;
      }

      const result = self._originalWrite!(...args);

      // Stream to web app
      if (data && self._onOutputWrite && !isFrame) {
        self._onOutputWrite(data);
      }

      return result;
    };
  }

  private _unhookStdout(): void {
    if (this._originalWrite) {
      process.stdout.write = this._originalWrite as typeof process.stdout.write;
      this._originalWrite = null;
    }
    this._redrawScheduled = false;
  }

  /**
   * Detect if a write is our own frame/chrome content (to avoid streaming it to web).
   * Frame content always starts with cursor positioning escape sequences.
   */
  private _isFrameContent(data: string): boolean {
    // Our _rawWrite calls start with hide-cursor or cursor-position sequences
    // This is a heuristic — better than nothing for filtering out chrome redraws
    return data.startsWith(ANSI.HIDE_CURSOR) ||
      (data.startsWith('\x1b[') && data.includes(';') && data.includes('H'));
  }

  private _scheduleRedraw(): void {
    this._redrawScheduled = true;
    setTimeout(() => {
      this._redrawScheduled = false;
      if (this._active) {
        this._prevChromeContent = ['', '', '', ''];
        this._prevInputLine = '';
        this.redraw();
      }
    }, 16);
  }

  // ─── Private: Raw Write ────────────────────────────────────────────────

  /** Write directly to stdout, bypassing the hook */
  private _rawWrite(data: string): void {
    const write = this._originalWrite || process.stdout.write.bind(process.stdout);
    write(data);
  }

  // ─── Private: Drawing ──────────────────────────────────────────────────

  private _drawChromeRow(index: ChromeRowIndex): void {
    const rows = this.terminal.rows;
    const chromeStart = rows - CHROME_ROWS + 1;
    const row = chromeStart + index;
    const content = this._chromeContent[index];
    // Chrome row 0 = frame bottom border (no left padding, must align with frame top)
    // Chrome rows 1-3 = hints/statusbar (1 space indent)
    const prefix = index === 0 ? '' : ' ';

    // Always restore cursor to input frame after chrome update
    const cursorCol = 5 + this._liveInputCursorPos();

    this._rawWrite(
      ANSI.HIDE_CURSOR +
      `\x1b[${row};1H${ANSI.CLEAR_LINE}` +
      prefix + content +
      moveTo(this.inputRow, cursorCol) +
      ANSI.SHOW_CURSOR,
    );
  }

  private _drawSuggestionRow(index: number): void {
    const iRow = this.inputRow;
    const sRow = iRow + this._inputFrameLines + index;
    const cols = this.terminal.cols;
    const fc = chalk.hex(this._frameColor).dim;
    const content = this._suggestionContent[index] || '';
    const padding = Math.max(0, cols - 4 - visibleLength(content));

    // Always restore cursor to input frame
    const cursorCol = 5 + this._liveInputCursorPos();

    this._rawWrite(
      ANSI.HIDE_CURSOR +
      `\x1b[${sRow};1H${ANSI.CLEAR_LINE}` +
      fc(FRAME.VERTICAL) + ' ' + content + ' '.repeat(padding) + ' ' + fc(FRAME.VERTICAL) +
      moveTo(this.inputRow, cursorCol) +
      ANSI.SHOW_CURSOR,
    );
  }

  private _clearAllFixed(): void {
    const rows = this.terminal.rows;
    const total = this._frameRows + this._extraRows + CHROME_ROWS;
    const startRow = rows - total + 1;

    let buf = '';
    for (let i = 0; i < total; i++) {
      buf += clearLineAt(startRow + i);
    }
    this._rawWrite(buf);
  }

  private _clearSuggestionArea(oldExtraCount: number): void {
    const rows = this.terminal.rows;
    const oldTotal = this._frameRows + oldExtraCount + CHROME_ROWS;
    const newTotal = this._frameRows + this._extraRows + CHROME_ROWS;

    // Clear from old frame top down to chrome start
    const oldFrameTop = rows - oldTotal + 1;
    const newFrameTop = rows - newTotal + 1;
    const startRow = Math.min(oldFrameTop, newFrameTop);
    const endRow = rows - CHROME_ROWS;

    let buf = '';
    for (let i = startRow; i <= endRow; i++) {
      buf += clearLineAt(i);
    }
    this._rawWrite(buf);
  }
}
