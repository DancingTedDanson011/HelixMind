/**
 * SuggestionPanel — Interactive dropdown for slash command suggestions.
 *
 * Renders below the prompt line using BottomChrome's dynamic extra rows.
 * Supports arrow-key navigation, Tab/Enter confirmation, and live filtering.
 */
import chalk from 'chalk';
import type { BottomChrome } from './bottom-chrome.js';
import type { CommandDef } from './command-suggest.js';

const MAX_VISIBLE = 6;

export class SuggestionPanel {
  private _chrome: BottomChrome;
  private _items: CommandDef[] = [];
  private _selectedIndex = -1;
  private _isOpen = false;
  private _originalInput = '';

  constructor(chrome: BottomChrome) {
    this._chrome = chrome;
  }

  /** Whether the panel is currently visible */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /** Currently selected index (-1 = none) */
  get selectedIndex(): number {
    return this._selectedIndex;
  }

  /** The currently selected command text, or null if nothing selected */
  get selectedCommand(): string | null {
    if (this._selectedIndex < 0 || this._selectedIndex >= this._items.length) return null;
    return this._items[this._selectedIndex].cmd;
  }

  /** The original input that opened the panel (before any arrow-key selection) */
  get originalInput(): string {
    return this._originalInput;
  }

  /**
   * Open the panel with the given suggestions.
   * @param items Suggestions to display
   * @param originalInput The user's current input text
   */
  open(items: CommandDef[], originalInput: string): void {
    if (items.length === 0) {
      this.close();
      return;
    }

    const visible = items.slice(0, MAX_VISIBLE);
    this._items = visible;
    this._originalInput = originalInput;
    this._selectedIndex = -1;
    this._isOpen = true;
    this._chrome.setExtraRows(visible.length);
    this._render();
  }

  /**
   * Close the panel and release the extra rows.
   */
  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._items = [];
    this._selectedIndex = -1;
    this._originalInput = '';
    this._chrome.setExtraRows(0);
  }

  /**
   * Move selection down. Returns the command text of the newly selected item.
   */
  moveDown(): string | null {
    if (!this._isOpen || this._items.length === 0) return null;
    if (this._selectedIndex < this._items.length - 1) {
      this._selectedIndex++;
    } else {
      // Wrap to top
      this._selectedIndex = 0;
    }
    this._render();
    return this._items[this._selectedIndex].cmd;
  }

  /**
   * Move selection up. Returns the command text of the newly selected item.
   */
  moveUp(): string | null {
    if (!this._isOpen || this._items.length === 0) return null;
    if (this._selectedIndex > 0) {
      this._selectedIndex--;
    } else if (this._selectedIndex === 0) {
      // Wrap to bottom
      this._selectedIndex = this._items.length - 1;
    } else {
      // From -1 (nothing selected) go to last
      this._selectedIndex = this._items.length - 1;
    }
    this._render();
    return this._items[this._selectedIndex].cmd;
  }

  /**
   * Confirm the current selection (or select first if nothing selected).
   * Returns the confirmed command text, or null if panel was empty.
   */
  confirm(): string | null {
    if (!this._isOpen || this._items.length === 0) return null;
    // If nothing selected, pick the first item
    if (this._selectedIndex < 0) this._selectedIndex = 0;
    const cmd = this._items[this._selectedIndex].cmd;
    this.close();
    return cmd;
  }

  /**
   * Update the panel with new items while the user types (live filter).
   * @param items New filtered suggestions
   * @param input Current user input
   */
  update(items: CommandDef[], input: string): void {
    if (items.length === 0) {
      this.close();
      return;
    }

    const visible = items.slice(0, MAX_VISIBLE);
    this._items = visible;
    this._originalInput = input;

    // Keep selection on same command if still in list, otherwise reset
    if (this._selectedIndex >= 0) {
      const prevCmd = this.selectedCommand;
      const newIdx = visible.findIndex(it => it.cmd === prevCmd);
      this._selectedIndex = newIdx; // -1 if not found
    }

    // Resize if item count changed
    if (this._chrome.extraRows !== visible.length) {
      this._chrome.setExtraRows(visible.length);
    }
    this._render();
  }

  /**
   * Render all suggestion rows into the chrome.
   */
  private _render(): void {
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const isSelected = i === this._selectedIndex;

      let line: string;
      if (isSelected) {
        line = chalk.cyan.bold(`❯ ${item.cmd}`) + chalk.dim(` — ${item.description}`);
      } else {
        line = chalk.dim(`  ${item.cmd} — ${item.description}`);
      }

      this._chrome.setSuggestionRow(i, line);
    }
  }
}
