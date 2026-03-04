/**
 * BottomChrome — Centralized manager for the 4 fixed rows at the bottom of the terminal.
 *
 * Layout (from bottom):
 *   Row N-3: separator / activity indicator  (chrome index 0)
 *   Row N-2: hints line                      (chrome index 1)
 *   Row N-1: statusbar line 1                (chrome index 2)
 *   Row N:   statusbar line 2                (chrome index 3)
 *
 * Uses DECSTBM scroll region to protect the bottom 4 rows from scrolling.
 * Includes a stdout hook (Layer 2) that redraws the chrome after every write,
 * protecting against terminals that ignore scroll regions.
 *
 * Double-buffer: tracks previous row content and only redraws rows that changed.
 *
 * The readline prompt lives at row N-4 (the last row of the scroll region).
 */

const RESERVED_ROWS = 4;
const MIN_TERMINAL_HEIGHT = 10;

export class BottomChrome {
  private _active = false;
  private _inlineMode = false;
  private _originalWrite: ((...args: any[]) => boolean) | null = null;
  private _redrawScheduled = false;
  private _rowContent: [string, string, string, string] = ['', '', '', ''];
  /** Previous frame — used for dirty-check diffing to avoid redundant redraws */
  private _prevRowContent: [string, string, string, string] = ['', '', '', ''];

  /** Number of rows reserved at the bottom (4, or 0 in inline mode) */
  get reservedRows(): number {
    return this._inlineMode ? 0 : RESERVED_ROWS;
  }

  /** Terminal row where the readline prompt should appear (bottom of scroll region) */
  get promptRow(): number {
    const rows = process.stdout.rows || 24;
    return rows - RESERVED_ROWS;
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
    this._drawRow(index);
    this._prevRowContent[index] = content;
  }

  /**
   * Redraw only CHANGED rows using absolute cursor positioning (double-buffer diff).
   * Preserves the caller's cursor position.
   */
  redraw(): void {
    if (!this._active || this._inlineMode) return;

    // Check if any row actually changed
    const dirty0 = this._rowContent[0] !== this._prevRowContent[0];
    const dirty1 = this._rowContent[1] !== this._prevRowContent[1];
    const dirty2 = this._rowContent[2] !== this._prevRowContent[2];
    const dirty3 = this._rowContent[3] !== this._prevRowContent[3];

    if (!dirty0 && !dirty1 && !dirty2 && !dirty3) return; // Nothing changed

    const rows = process.stdout.rows || 24;
    const write = this._rawWrite.bind(this);

    // Build a single write with only the changed rows
    let output = '\x1b[?25l\x1b[s'; // hide cursor + save

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

    output += '\x1b[u\x1b[?25h'; // restore cursor + show
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
    this._rawWrite(
      '\x1b[?25l' +                           // hide cursor
      '\x1b[s' +                                 // save cursor
      `\x1b[${this.promptRow};1H` +            // move to prompt row
      '\x1b[2K' +                              // clear entire line
      content +                                // write content
      '\x1b[u' +                                 // restore cursor
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

    const regionEnd = rows - RESERVED_ROWS;
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

      if (self._active && !self._redrawScheduled) {
        self._redrawScheduled = true;
        process.nextTick(() => {
          self._redrawScheduled = false;
          if (self._active) {
            self.redraw();
          }
        });
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

  /** Draw a single chrome row at its absolute position */
  private _drawRow(index: 0 | 1 | 2 | 3): void {
    const rows = process.stdout.rows || 24;
    const row = rows - 3 + index; // 0 → N-3, 1 → N-2, 2 → N-1, 3 → N
    const content = this._rowContent[index];

    this._rawWrite(
      '\x1b[?25l' +
      '\x1b[s' +
      `\x1b[${row};1H` +
      '\x1b[2K' +
      ` ${content}` +
      '\x1b[u' +
      '\x1b[?25h',
    );
  }

  /** Clear all 4 fixed rows */
  private _clearFixedRows(): void {
    const rows = process.stdout.rows || 24;
    this._rawWrite(
      '\x1b[s' +
      `\x1b[${rows - 3};1H\x1b[2K` +
      `\x1b[${rows - 2};1H\x1b[2K` +
      `\x1b[${rows - 1};1H\x1b[2K` +
      `\x1b[${rows};1H\x1b[2K` +
      '\x1b[u',
    );
  }
}
