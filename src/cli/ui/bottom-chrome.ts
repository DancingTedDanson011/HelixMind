/**
 * BottomChrome — Centralized manager for the fixed rows at the bottom of the terminal.
 *
 * Layout (from bottom, with N extra suggestion rows):
 *   Row promptRow:           ❯ input here_              (bottom of scroll region)
 *   Row promptRow+1..+N:     suggestion rows             (extra rows, 0 when no panel)
 *   Row N-3: separator / activity indicator  (chrome index 0)
 *   Row N-2: hints line                      (chrome index 1)
 *   Row N-1: statusbar line 1                (chrome index 2)
 *   Row N:   statusbar line 2                (chrome index 3)
 *
 * Uses DECSTBM scroll region to protect the bottom rows from scrolling.
 * Includes a stdout hook (Layer 2) that redraws the chrome after every write,
 * protecting against terminals that ignore scroll regions.
 *
 * Double-buffer: tracks previous row content and only redraws rows that changed.
 */

const BASE_ROWS = 4;
const MIN_TERMINAL_HEIGHT = 10;

export class BottomChrome {
  private _active = false;
  private _inlineMode = false;
  private _originalWrite: ((...args: any[]) => boolean) | null = null;
  private _redrawScheduled = false;
  private _rowContent: [string, string, string, string] = ['', '', '', ''];
  /** Previous frame — used for dirty-check diffing to avoid redundant redraws */
  private _prevRowContent: [string, string, string, string] = ['', '', '', ''];

  /** Extra rows for suggestion panel (0 when no panel visible) */
  private _extraRows = 0;
  /** Content for each suggestion row */
  private _suggestionContent: string[] = [];
  /** Previous suggestion content — for dirty-check diffing */
  private _prevSuggestionContent: string[] = [];

  /** Number of base chrome rows (always 4) */
  get baseRows(): number {
    return BASE_ROWS;
  }

  /** Number of extra rows (suggestions) */
  get extraRows(): number {
    return this._extraRows;
  }

  /** Total reserved rows: base + suggestions */
  get totalReservedRows(): number {
    return this._inlineMode ? 0 : BASE_ROWS + this._extraRows;
  }

  /** Number of rows reserved at the bottom (total, or 0 in inline mode) */
  get reservedRows(): number {
    return this.totalReservedRows;
  }

  /** Terminal row where the readline prompt should appear (bottom of scroll region) */
  get promptRow(): number {
    const rows = process.stdout.rows || 24;
    return rows - this.totalReservedRows;
  }

  /** Whether the chrome is currently active */
  get isActive(): boolean {
    return this._active;
  }

  /** Whether we fell back to inline mode (terminal too small) */
  get isInlineMode(): boolean {
    return this._inlineMode;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Activate the bottom chrome: set scroll region, hook stdout, draw rows.
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
    // Force full draw on activation by clearing prev content
    this._prevRowContent = ['', '', '', ''];
    this._prevSuggestionContent = [];
    this.redraw();
  }

  /**
   * Deactivate: reset scroll region, unhook stdout, clear fixed rows.
   */
  deactivate(): void {
    if (!this._active) return;
    this._active = false;

    this._clearFixedRows();
    this._resetScrollRegion();
    this._unhookStdout();
    this._rowContent = ['', '', '', ''];
    this._prevRowContent = ['', '', '', ''];
    this._extraRows = 0;
    this._suggestionContent = [];
    this._prevSuggestionContent = [];
  }

  /**
   * Update a specific chrome row and redraw it immediately.
   * @param index 0 = separator (row N-3), 1 = hints (row N-2), 2 = statusbar line 1 (row N-1), 3 = statusbar line 2 (row N)
   * @param content ANSI-styled string to display
   */
  setRow(index: 0 | 1 | 2 | 3, content: string): void {
    if (this._rowContent[index] === content) return; // No change — skip
    this._rowContent[index] = content;
    if (!this._active || this._inlineMode) return;
    this._drawChromeRow(index);
    this._prevRowContent[index] = content;
  }

  /**
   * Set the number of extra rows for the suggestion panel.
   * Re-establishes the scroll region and forces a redraw.
   */
  setExtraRows(n: number): void {
    const rows = process.stdout.rows || 24;
    // Clamp to available space (leave at least 3 rows for content)
    const maxExtra = Math.max(0, rows - MIN_TERMINAL_HEIGHT - BASE_ROWS);
    const clamped = Math.max(0, Math.min(n, maxExtra));

    if (clamped === this._extraRows) return;

    const oldExtra = this._extraRows;
    this._extraRows = clamped;

    // Resize suggestion content arrays
    this._suggestionContent = new Array(clamped).fill('');
    this._prevSuggestionContent = new Array(clamped).fill('');

    if (!this._active || this._inlineMode) return;

    // Clear old suggestion rows if shrinking
    if (clamped < oldExtra) {
      this._clearSuggestionArea(oldExtra);
    }

    // Re-establish scroll region with new total reserved rows
    this._setScrollRegion();
    // Force full redraw (positions changed)
    this._prevRowContent = ['', '', '', ''];
    this.redraw();
  }

  /**
   * Write content to a suggestion row.
   * @param index 0-based index within the suggestion area
   * @param content ANSI-styled string to display
   */
  setSuggestionRow(index: number, content: string): void {
    if (index < 0 || index >= this._extraRows) return;
    if (this._suggestionContent[index] === content) return;
    this._suggestionContent[index] = content;
    if (!this._active || this._inlineMode) return;
    this._drawSuggestionRow(index);
    this._prevSuggestionContent[index] = content;
  }

  /**
   * Redraw only CHANGED rows using absolute cursor positioning (double-buffer diff).
   * Preserves the caller's cursor position.
   */
  redraw(): void {
    if (!this._active || this._inlineMode) return;

    const rows = process.stdout.rows || 24;
    const total = BASE_ROWS + this._extraRows;

    // Check if any chrome row changed
    const dirty0 = this._rowContent[0] !== this._prevRowContent[0];
    const dirty1 = this._rowContent[1] !== this._prevRowContent[1];
    const dirty2 = this._rowContent[2] !== this._prevRowContent[2];
    const dirty3 = this._rowContent[3] !== this._prevRowContent[3];

    // Check suggestion rows
    let anySuggestionDirty = false;
    for (let i = 0; i < this._extraRows; i++) {
      if (this._suggestionContent[i] !== this._prevSuggestionContent[i]) {
        anySuggestionDirty = true;
        break;
      }
    }

    if (!dirty0 && !dirty1 && !dirty2 && !dirty3 && !anySuggestionDirty) return;

    const write = this._rawWrite.bind(this);
    const promptRow = rows - total;

    // Build a single write with only the changed rows.
    // NOTE: We avoid \x1b[s / \x1b[u (DECSC/DECRC) because Windows Terminal
    // / ConPTY handles cursor save/restore unreliably during rapid output,
    // causing status bar fragments to bleed into the main scroll area.
    // Instead we move cursor to chrome rows, draw, then move back to prompt row.
    let output = '\x1b[?25l'; // hide cursor

    // Suggestion rows sit between prompt and chrome base rows
    const suggestionStart = rows - total + 1; // row after prompt
    for (let i = 0; i < this._extraRows; i++) {
      if (this._suggestionContent[i] !== this._prevSuggestionContent[i]) {
        output += `\x1b[${suggestionStart + i};1H\x1b[2K ${this._suggestionContent[i]}`;
        this._prevSuggestionContent[i] = this._suggestionContent[i];
      }
    }

    // Chrome rows: base 4 rows at the very bottom
    // chrome row 0 = rows - 3, chrome row 1 = rows - 2, chrome row 2 = rows - 1, chrome row 3 = rows
    if (dirty0) {
      output += `\x1b[${rows - 3};1H\x1b[2K ${this._rowContent[0]}`;
      this._prevRowContent[0] = this._rowContent[0];
    }
    if (dirty1) {
      output += `\x1b[${rows - 2};1H\x1b[2K ${this._rowContent[1]}`;
      this._prevRowContent[1] = this._rowContent[1];
    }
    if (dirty2) {
      output += `\x1b[${rows - 1};1H\x1b[2K ${this._rowContent[2]}`;
      this._prevRowContent[2] = this._rowContent[2];
    }
    if (dirty3) {
      output += `\x1b[${rows};1H\x1b[2K ${this._rowContent[3]}`;
      this._prevRowContent[3] = this._rowContent[3];
    }

    // Return cursor to prompt row (bottom of scroll region) instead of restore
    output += `\x1b[${promptRow};1H\x1b[?25h`; // move to prompt row + show cursor
    write(output);
  }

  /**
   * Handle terminal resize. Re-establishes scroll region and redraws at new positions.
   */
  handleResize(): void {
    if (!this._active) return;

    const rows = process.stdout.rows || 24;
    if (rows < MIN_TERMINAL_HEIGHT) {
      // Terminal became too small — switch to inline mode
      this.deactivate();
      this._inlineMode = true;
      return;
    }

    // Re-establish scroll region with new dimensions
    this._setScrollRegion();
    // Force full redraw after resize (positions changed)
    this._prevRowContent = ['', '', '', ''];
    this._prevSuggestionContent = new Array(this._extraRows).fill('');
    this.redraw();
  }

  /**
   * Position the cursor at the prompt row (bottom of scroll region).
   * Call this before `rl.prompt()` to ensure the readline prompt appears at the bottom.
   */
  positionCursorForPrompt(): void {
    if (this._inlineMode || !this._active) return;
    this._rawWrite(`\x1b[${this.promptRow};1H`);
  }

  /**
   * Write content at the prompt row (bottom of scroll region) without
   * disturbing the current cursor position. Used for type-ahead previews
   * during agent work when readline echo is muted.
   */
  writeAtPromptRow(content: string): void {
    if (this._inlineMode || !this._active) return;
    const pr = this.promptRow;
    this._rawWrite(
      '\x1b[?25l' +                           // hide cursor
      `\x1b[${pr};1H` +                       // move to prompt row
      '\x1b[2K' +                              // clear entire line
      content +                                // write content
      `\x1b[${pr};1H` +                       // stay at prompt row
      '\x1b[?25h',                             // show cursor
    );
  }

  // ---------------------------------------------------------------------------
  // Private: Scroll region management
  // ---------------------------------------------------------------------------

  private _setScrollRegion(): void {
    if (!process.stdout.isTTY) return;
    const rows = process.stdout.rows || 24;
    if (rows < MIN_TERMINAL_HEIGHT) return;

    const total = BASE_ROWS + this._extraRows;
    const regionEnd = rows - total;
    this._rawWrite(
      `\x1b[1;${regionEnd}r` +        // set scroll region
      `\x1b[${regionEnd};1H`,         // move cursor into region
    );
  }

  private _resetScrollRegion(): void {
    if (!process.stdout.isTTY) return;
    this._rawWrite('\x1b[r');
  }

  // ---------------------------------------------------------------------------
  // Private: Stdout hook (Layer 2 protection)
  // ---------------------------------------------------------------------------

  /**
   * Monkey-patch process.stdout.write so that after every normal write,
   * a nextTick redraws the chrome rows. Prevents content from overwriting
   * the fixed area on terminals that ignore DECSTBM.
   */
  private _hookStdout(): void {
    if (!process.stdout.isTTY || this._originalWrite) return;

    this._originalWrite = process.stdout.write.bind(process.stdout);
    const self = this;

    (process.stdout as any).write = function (...args: any[]): boolean {
      const result = self._originalWrite!(...args);

      // Only schedule a chrome repaint when output contains a newline that
      // could scroll chrome rows off-screen (on terminals ignoring DECSTBM).
      // Previous approach forced ALL rows dirty on every write — the constant
      // cursor-save/restore cycles corrupted output on Windows Terminal.
      if (self._active && !self._redrawScheduled) {
        // Check if the written data contains a newline
        const data = typeof args[0] === 'string' ? args[0] : '';
        const hasNewline = data.includes('\n');
        if (hasNewline) {
          self._redrawScheduled = true;
          // Use setTimeout (not nextTick) to coalesce rapid-fire writes
          setTimeout(() => {
            self._redrawScheduled = false;
            if (self._active) {
              // Force dirty only when newlines were written (scroll may have
              // pushed chrome off-screen). Single repaint per batch.
              self._prevRowContent = ['', '', '', ''];
              for (let i = 0; i < self._prevSuggestionContent.length; i++) {
                self._prevSuggestionContent[i] = '';
              }
              self.redraw();
            }
          }, 16); // ~1 frame at 60fps
        }
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

  // ---------------------------------------------------------------------------
  // Private: Drawing helpers
  // ---------------------------------------------------------------------------

  /** Write directly to the real stdout, bypassing the hook */
  private _rawWrite(data: string): void {
    const write = this._originalWrite || process.stdout.write.bind(process.stdout);
    write(data);
  }

  /** Draw a single chrome base row at its absolute position */
  private _drawChromeRow(index: 0 | 1 | 2 | 3): void {
    const rows = process.stdout.rows || 24;
    const total = BASE_ROWS + this._extraRows;
    const row = rows - 3 + index; // 0 → N-3, 1 → N-2, 2 → N-1, 3 → N
    const promptRow = rows - total;
    const content = this._rowContent[index];

    this._rawWrite(
      '\x1b[?25l' +
      `\x1b[${row};1H` +
      '\x1b[2K' +
      ` ${content}` +
      `\x1b[${promptRow};1H` +
      '\x1b[?25h',
    );
  }

  /** Draw a single suggestion row at its absolute position */
  private _drawSuggestionRow(index: number): void {
    const rows = process.stdout.rows || 24;
    const total = BASE_ROWS + this._extraRows;
    const row = rows - total + 1 + index;
    const promptRow = rows - total;
    const content = this._suggestionContent[index];

    this._rawWrite(
      '\x1b[?25l' +
      `\x1b[${row};1H` +
      '\x1b[2K' +
      ` ${content}` +
      `\x1b[${promptRow};1H` +
      '\x1b[?25h',
    );
  }

  /** Clear all fixed rows (base + suggestion) */
  private _clearFixedRows(): void {
    const rows = process.stdout.rows || 24;
    const total = BASE_ROWS + this._extraRows;
    const promptRow = rows - total;

    let output = '';
    for (let i = 0; i < total; i++) {
      output += `\x1b[${rows - total + 1 + i};1H\x1b[2K`;
    }
    output += `\x1b[${promptRow};1H`;
    this._rawWrite(output);
  }

  /** Clear only the suggestion area (used when shrinking extra rows) */
  private _clearSuggestionArea(oldExtraCount: number): void {
    const rows = process.stdout.rows || 24;
    const oldTotal = BASE_ROWS + oldExtraCount;
    const suggestionStart = rows - oldTotal + 1;
    const newTotal = BASE_ROWS + this._extraRows;
    const promptRow = rows - newTotal;

    let output = '';
    for (let i = 0; i < oldExtraCount; i++) {
      output += `\x1b[${suggestionStart + i};1H\x1b[2K`;
    }
    output += `\x1b[${promptRow};1H`;
    this._rawWrite(output);
  }
}
