import chalk from 'chalk';
import { theme } from './theme.js';

export interface MenuItem {
  label: string;
  description?: string;
  key?: string;         // shortcut key (e.g., 'd', 'q')
  marker?: string;      // e.g., "◀ current", "✓"
  disabled?: boolean;
}

export interface SelectMenuOptions {
  title?: string;
  cancelLabel?: string; // label for ESC/q cancel, default "Back"
  pageSize?: number;    // visible items before scrolling, default 10
}

/**
 * Interactive arrow-key menu. Returns the selected index or -1 if cancelled.
 * Works in raw mode — no readline needed.
 */
export function selectMenu(
  items: MenuItem[],
  opts: SelectMenuOptions = {},
): Promise<number> {
  const { title, cancelLabel = 'Back', pageSize = 10 } = opts;
  const enabledIndices = items.map((item, i) => item.disabled ? -1 : i).filter(i => i >= 0);
  if (enabledIndices.length === 0) return Promise.resolve(-1);

  let cursor = enabledIndices[0];
  let scrollOffset = 0;

  const visibleCount = Math.min(pageSize, items.length);

  function render(clear: boolean): void {
    if (clear) {
      // Move cursor up to overwrite previous render
      const linesToClear = (title ? 1 : 0) + visibleCount + (items.length > visibleCount ? 1 : 0) + 2;
      process.stdout.write(`\x1b[${linesToClear}A\x1b[J`);
    }

    if (title) {
      process.stdout.write(`  ${theme.bold(title)}\n`);
    }

    // Adjust scroll window
    if (cursor < scrollOffset) scrollOffset = cursor;
    if (cursor >= scrollOffset + visibleCount) scrollOffset = cursor - visibleCount + 1;

    for (let vi = 0; vi < visibleCount; vi++) {
      const i = scrollOffset + vi;
      if (i >= items.length) break;

      const item = items[i];
      const isSelected = i === cursor;
      const prefix = isSelected ? theme.primary('  ❯ ') : '    ';
      const label = isSelected ? chalk.white.bold(item.label) : (item.disabled ? chalk.dim(item.label) : item.label);
      const desc = item.description ? (isSelected ? chalk.white(` — ${item.description}`) : chalk.dim(` — ${item.description}`)) : '';
      const marker = item.marker ? ` ${item.marker}` : '';
      const keyHint = item.key ? chalk.dim(` [${item.key}]`) : '';

      process.stdout.write(`${prefix}${label}${desc}${marker}${keyHint}\n`);
    }

    // Scroll indicator
    if (items.length > visibleCount) {
      const above = scrollOffset > 0 ? '↑' : ' ';
      const below = scrollOffset + visibleCount < items.length ? '↓' : ' ';
      process.stdout.write(chalk.dim(`    ${above} ${scrollOffset + 1}-${Math.min(scrollOffset + visibleCount, items.length)} of ${items.length} ${below}\n`));
    }

    process.stdout.write(chalk.dim(`\n  ↑↓ navigate · Enter select · Esc ${cancelLabel}\n`));
  }

  return new Promise<number>((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    let firstRender = true;

    function draw(): void {
      render(!firstRender);
      firstRender = false;
    }

    function cleanup(result: number): void {
      stdin.removeListener('data', onData);
      if (stdin.isTTY && wasRaw !== undefined) {
        stdin.setRawMode(wasRaw);
      }
      resolve(result);
    }

    function moveCursor(direction: 1 | -1): void {
      const currentPos = enabledIndices.indexOf(cursor);
      if (currentPos === -1) return;
      const nextPos = currentPos + direction;
      if (nextPos >= 0 && nextPos < enabledIndices.length) {
        cursor = enabledIndices[nextPos];
      }
    }

    function onData(data: Buffer): void {
      const key = data.toString();

      // ESC (alone)
      if (key === '\x1b' || key === '\x1b\x1b') {
        cleanup(-1);
        return;
      }

      // Ctrl+C
      if (key === '\x03') {
        cleanup(-1);
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        cleanup(cursor);
        return;
      }

      // Arrow up
      if (key === '\x1b[A') {
        moveCursor(-1);
        draw();
        return;
      }

      // Arrow down
      if (key === '\x1b[B') {
        moveCursor(1);
        draw();
        return;
      }

      // Home / Page Up
      if (key === '\x1b[H' || key === '\x1b[5~') {
        cursor = enabledIndices[0];
        draw();
        return;
      }

      // End / Page Down
      if (key === '\x1b[F' || key === '\x1b[6~') {
        cursor = enabledIndices[enabledIndices.length - 1];
        draw();
        return;
      }

      // Shortcut key match
      const char = key.toLowerCase();
      if (char.length === 1) {
        const matchIdx = items.findIndex(
          (item) => !item.disabled && item.key === char,
        );
        if (matchIdx >= 0) {
          cleanup(matchIdx);
          return;
        }
      }

      // 'q' as cancel shortcut
      if (char === 'q') {
        cleanup(-1);
        return;
      }
    }

    stdin.on('data', onData);
    draw();
  });
}

/**
 * Convenience: show a yes/no confirmation prompt with arrow keys.
 */
export function confirmMenu(question: string, defaultYes = false): Promise<boolean> {
  process.stdout.write(`\n  ${question}\n`);
  return selectMenu(
    [
      { label: 'Yes' },
      { label: 'No' },
    ],
    { cancelLabel: 'Cancel' },
  ).then((idx) => {
    if (idx === -1) return false;
    return idx === 0;
  });
}
