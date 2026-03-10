/**
 * Terminal — Low-level terminal abstraction.
 *
 * Single source of truth for terminal dimensions, cursor control,
 * scroll regions, and raw mode. ALL terminal writes go through here.
 *
 * This replaces the scattered process.stdout.write() calls and provides
 * a clean foundation for the Screen and InputManager layers above.
 */

// ─── ANSI Escape Sequences ──────────────────────────────────────────────────

export const ANSI = {
  // Cursor visibility
  HIDE_CURSOR: '\x1b[?25l',
  SHOW_CURSOR: '\x1b[?25h',

  // Line operations
  CLEAR_LINE: '\x1b[2K',
  CLEAR_TO_EOL: '\x1b[K',
  CLEAR_BELOW: '\x1b[J',

  // Scroll region
  RESET_SCROLL: '\x1b[r',

  // Bracketed paste
  PASTE_ON: '\x1b[?2004h',
  PASTE_OFF: '\x1b[?2004l',
  PASTE_START: '\x1b[200~',
  PASTE_END: '\x1b[201~',

  // Mouse tracking (disable all modes)
  MOUSE_OFF: '\x1b[?1000l\x1b[?1003l\x1b[?1006l',

  // Style reset
  RESET: '\x1b[0m',
} as const;

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Move cursor to row, col (1-based) */
export function moveTo(row: number, col: number = 1): string {
  return `\x1b[${row};${col}H`;
}

/** Move cursor to column (1-based) */
export function moveToCol(col: number): string {
  return `\x1b[${col}G`;
}

/** Set scroll region (1-based, inclusive) */
export function setScrollRegion(top: number, bottom: number): string {
  return `\x1b[${top};${bottom}r`;
}

/** Clear line at given row */
export function clearLineAt(row: number): string {
  return `\x1b[${row};1H${ANSI.CLEAR_LINE}`;
}

/** Clear multiple lines starting at row */
export function clearLines(startRow: number, count: number): string {
  let buf = '';
  for (let i = 0; i < count; i++) {
    buf += `\x1b[${startRow + i};1H${ANSI.CLEAR_LINE}`;
  }
  return buf;
}

/**
 * Strip ANSI escape codes to measure visible string width.
 * Handles SGR (\x1b[...m), OSC (\x1b]...\x07), and readline markers (\x01, \x02).
 */
export function visibleLength(str: string): number {
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\x1b\].*?\x07/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x01\x02]/g, '')
    .length;
}

/**
 * Truncate a styled string to fit within maxWidth visible characters.
 * Preserves ANSI codes, appends … if truncated.
 */
export function truncateStyled(str: string, maxWidth: number): string {
  const visible = visibleLength(str);
  if (visible <= maxWidth) return str;

  let result = '';
  let width = 0;
  let inEscape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\x1b') { inEscape = true; result += ch; continue; }
    if (inEscape) { result += ch; if (ch === 'm') inEscape = false; continue; }
    if (width >= maxWidth - 1) { result += '\u2026'; break; }
    result += ch;
    width++;
  }

  return result + ANSI.RESET;
}

// ─── Terminal Class ──────────────────────────────────────────────────────────

export type ResizeCallback = (cols: number, rows: number) => void;

export class Terminal {
  private _resizeCallbacks: ResizeCallback[] = [];

  constructor() {
    if (process.stdout.isTTY) {
      process.stdout.on('resize', () => {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;
        for (const cb of this._resizeCallbacks) {
          cb(cols, rows);
        }
      });
    }
  }

  // ─── Dimensions ──────────────────────────────────────────────────────────

  get cols(): number { return process.stdout.columns || 80; }
  get rows(): number { return process.stdout.rows || 24; }
  get isTTY(): boolean { return !!process.stdout.isTTY; }

  /** Register a resize callback */
  onResize(cb: ResizeCallback): void {
    this._resizeCallbacks.push(cb);
  }

  /** Remove a resize callback */
  offResize(cb: ResizeCallback): void {
    const idx = this._resizeCallbacks.indexOf(cb);
    if (idx >= 0) this._resizeCallbacks.splice(idx, 1);
  }

  // ─── Writing ─────────────────────────────────────────────────────────────

  /**
   * Write directly to process.stdout.
   * This is THE canonical write path. All output goes through here.
   */
  write(data: string): void {
    process.stdout.write(data);
  }

  // ─── Cursor Control ──────────────────────────────────────────────────────

  /** Move cursor to absolute position (1-based) */
  moveTo(row: number, col: number = 1): void {
    this.write(moveTo(row, col));
  }

  /** Clear entire line at row */
  clearLine(row: number): void {
    this.write(clearLineAt(row));
  }

  /** Clear multiple lines starting at row */
  clearLines(startRow: number, count: number): void {
    this.write(clearLines(startRow, count));
  }

  hideCursor(): void { this.write(ANSI.HIDE_CURSOR); }
  showCursor(): void { this.write(ANSI.SHOW_CURSOR); }

  // ─── Scroll Region ──────────────────────────────────────────────────────

  /** Set scroll region (1-based, inclusive top and bottom) */
  setScrollRegion(top: number, bottom: number): void {
    this.write(setScrollRegion(top, bottom));
  }

  /** Reset scroll region to full terminal */
  resetScrollRegion(): void {
    this.write(ANSI.RESET_SCROLL);
  }

  // ─── Raw Mode ────────────────────────────────────────────────────────────

  enableRawMode(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }
  }

  disableRawMode(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  enableBracketedPaste(): void { this.write(ANSI.PASTE_ON); }
  disableBracketedPaste(): void { this.write(ANSI.PASTE_OFF); }

  /**
   * Enable enhanced keyboard protocols for modifier key detection.
   * - Kitty keyboard protocol (level 1): Shift+Enter → \x1b[13;2u
   * - xterm modifyOtherKeys (level 1): Shift+Enter → \x1b[27;2;13~
   * Both are tried for maximum terminal compatibility.
   * Regular unmodified keys continue to work as before.
   */
  enableKittyKeyboard(): void {
    this.write('\x1b[>1u');     // Kitty keyboard protocol push
    this.write('\x1b[>4;1m');   // xterm modifyOtherKeys level 1
  }
  disableKittyKeyboard(): void {
    this.write('\x1b[<u');      // Kitty keyboard protocol pop
    this.write('\x1b[>4;0m');   // xterm modifyOtherKeys off
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  /** Restore terminal to normal state */
  cleanup(): void {
    this.resetScrollRegion();
    this.showCursor();
    this.disableBracketedPaste();
    this.disableKittyKeyboard();
    this.disableRawMode();
  }
}
