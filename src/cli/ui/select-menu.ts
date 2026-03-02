import chalk from 'chalk';
import { theme } from './theme.js';

export interface MenuItem {
  label: string;
  description?: string;
  key?: string;         // shortcut key (e.g., 'd', 'q')
  marker?: string;      // e.g., "◀ current", "✓"
  disabled?: boolean;
  danger?: boolean;     // Enterprise: mark as dangerous (red styling)
  success?: boolean;    // Enterprise: mark as success (green styling)
  icon?: string;        // Enterprise: custom icon
}

export interface SelectMenuOptions {
  title?: string;
  cancelLabel?: string; // label for ESC/q cancel, default "Back"
  pageSize?: number;    // visible items before scrolling, default 10
  showCount?: boolean;  // Enterprise: show item count
  autoFocus?: boolean;  // Enterprise: auto-select after timeout (optional)
}

/**
 * Interactive arrow-key menu. Returns the selected index or -1 if cancelled.
 * Works in raw mode — no readline needed.
 * 
 * Enterprise Features:
 * - Rich visual styling with icons and colors
 * - Danger/success styling for important options
 * - Keyboard shortcuts displayed
 * - Smooth animations
 */
export function selectMenu(
  items: MenuItem[],
  opts: SelectMenuOptions = {},
): Promise<number> {
  const { title, cancelLabel = 'Back', pageSize = 10, showCount = true } = opts;
  const enabledIndices = items.map((item, i) => item.disabled ? -1 : i).filter(i => i >= 0);
  if (enabledIndices.length === 0) return Promise.resolve(-1);

  let cursor = enabledIndices[0];
  let scrollOffset = 0;

  const visibleCount = Math.min(pageSize, items.length);

  function render(clear: boolean): void {
    if (clear) {
      // Move cursor up to overwrite previous render
      const linesToClear = (title ? 2 : 0) + visibleCount + (items.length > visibleCount ? 1 : 0) + 2;
      process.stdout.write(`\x1b[${linesToClear}A\x1b[J`);
    }

    // Enterprise: Title with styling
    if (title) {
      process.stdout.write(`\n  ${chalk.hex('#00d4ff').bold('┌─')} ${chalk.white.bold(title)} ${chalk.hex('#00d4ff').bold('─'.repeat(Math.max(0, 30 - title.length)))}\n`);
    }

    // Adjust scroll window
    if (cursor < scrollOffset) scrollOffset = cursor;
    if (cursor >= scrollOffset + visibleCount) scrollOffset = cursor - visibleCount + 1;

    for (let vi = 0; vi < visibleCount; vi++) {
      const i = scrollOffset + vi;
      if (i >= items.length) break;

      const item = items[i];
      const isSelected = i === cursor;

      // Enterprise: Rich styling based on item type
      let prefix = isSelected ? chalk.hex('#00d4ff').bold('  ❯ ') : '    ';
      let label: string;
      let desc: string;
      let marker = item.marker ? ` ${item.marker}` : '';
      let keyHint = item.key ? chalk.dim(` [${item.key}]`) : '';

      if (item.disabled) {
        label = chalk.dim.strikethrough(item.label);
        desc = item.description ? chalk.dim(` — ${item.description}`) : '';
      } else if (item.danger) {
        // Enterprise: Dangerous option (red)
        prefix = isSelected ? chalk.red.bold('  ❯ ') : '    ';
        label = isSelected ? chalk.red.bold(item.label) : chalk.red(item.label);
        desc = item.description ? (isSelected ? chalk.red(` — ${item.description}`) : chalk.dim(` — ${item.description}`)) : '';
      } else if (item.success) {
        // Enterprise: Success option (green)
        prefix = isSelected ? chalk.green.bold('  ❯ ') : '    ';
        label = isSelected ? chalk.green.bold(item.label) : chalk.green(item.label);
        desc = item.description ? (isSelected ? chalk.green(` — ${item.description}`) : chalk.dim(` — ${item.description}`)) : '';
      } else if (isSelected) {
        label = chalk.white.bold(item.label);
        desc = item.description ? chalk.white(` — ${item.description}`) : '';
      } else {
        label = item.label;
        desc = item.description ? chalk.dim(` — ${item.description}`) : '';
      }

      // Enterprise: Add icon if present
      const icon = item.icon ? `${item.icon} ` : '';

      process.stdout.write(`${prefix}${icon}${label}${desc}${marker}${keyHint}\n`);
    }

    // Enterprise: Scroll indicator with better styling
    if (items.length > visibleCount) {
      const above = scrollOffset > 0 ? '↑' : ' ';
      const below = scrollOffset + visibleCount < items.length ? '↓' : ' ';
      process.stdout.write(chalk.dim(`    ${above} ${chalk.hex('#00d4ff')(`${scrollOffset + 1}-${Math.min(scrollOffset + visibleCount, items.length)}`)} of ${items.length} ${below}\n`));
    } else if (showCount && items.length > 1) {
      process.stdout.write(chalk.dim(`    ${items.length} options\n`));
    }

    // Enterprise: Better footer
    process.stdout.write(chalk.dim(`\n  ↑↓ navigate · Enter select · Esc/q ${cancelLabel}\n`));
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
      // Erase the rendered menu from the terminal
      const linesToClear = (title ? 2 : 0) + visibleCount + (items.length > visibleCount ? 1 : 0) + 2;
      process.stdout.write(`\x1b[${linesToClear}A\x1b[J`);

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
 * Enterprise: Rich styling with icons.
 */
export function confirmMenu(question: string, defaultYes = false): Promise<boolean> {
  process.stdout.write(`\n  ${chalk.hex('#00d4ff')('❓')} ${chalk.white.bold(question)}\n`);
  return selectMenu(
    [
      { label: 'Yes', icon: '✓', success: true, marker: defaultYes ? '◀ default' : undefined },
      { label: 'No', icon: '✗', danger: true, marker: !defaultYes ? '◀ default' : undefined },
    ],
    { cancelLabel: 'Cancel' },
  ).then((idx) => {
    if (idx === -1) return false;
    return idx === 0;
  });
}

/**
 * Enterprise: Show a menu with quick actions
 * Returns the selected item or null if cancelled
 */
export async function quickActionMenu<T extends { label: string; action: () => void | Promise<void> }>(
  items: (T & { key?: string; danger?: boolean })[],
  opts?: SelectMenuOptions,
): Promise<T | null> {
  const menuItems: MenuItem[] = items.map((item, i) => ({
    label: item.label,
    key: item.key,
    danger: item.danger,
  }));

  const idx = await selectMenu(menuItems, opts);
  if (idx === -1) return null;
  return items[idx];
}

/**
 * Enterprise: Show a multi-select menu
 * Returns array of selected indices
 */
export async function multiSelectMenu(
  items: MenuItem[],
  opts: SelectMenuOptions = {},
): Promise<number[]> {
  const selected = new Set<number>();
  let cursor = 0;
  const { title, pageSize = 10 } = opts;
  const visibleCount = Math.min(pageSize, items.length);

  function render(clear: boolean): void {
    if (clear) {
      const linesToClear = (title ? 2 : 0) + visibleCount + 2 + 2;
      process.stdout.write(`\x1b[${linesToClear}A\x1b[J`);
    }

    if (title) {
      process.stdout.write(`\n  ${chalk.hex('#00d4ff').bold('┌─')} ${chalk.white.bold(title)} ${chalk.hex('#00d4ff').bold('─'.repeat(Math.max(0, 30 - title.length)))}\n`);
    }

    for (let i = 0; i < visibleCount && i < items.length; i++) {
      const item = items[i];
      const isSelected = i === cursor;
      const isChecked = selected.has(i);

      const prefix = isSelected ? chalk.hex('#00d4ff').bold('  ❯ ') : '    ';
      const checkbox = isChecked ? chalk.green('☑') : chalk.dim('☐');
      const label = isSelected ? chalk.white.bold(item.label) : (item.disabled ? chalk.dim(item.label) : item.label);

      process.stdout.write(`${prefix}${checkbox} ${label}\n`);
    }

    process.stdout.write(chalk.dim(`\n  ↑↓ navigate · Space toggle · Enter confirm · Esc cancel\n`));
    process.stdout.write(chalk.dim(`  ${selected.size} selected\n`));
  }

  return new Promise<number[]>((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    let firstRender = true;

    function cleanup(result: number[]): void {
      const linesToClear = (title ? 2 : 0) + visibleCount + 2 + 2;
      process.stdout.write(`\x1b[${linesToClear}A\x1b[J`);
      stdin.removeListener('data', onData);
      if (stdin.isTTY && wasRaw !== undefined) {
        stdin.setRawMode(wasRaw);
      }
      resolve(result);
    }

    function onData(data: Buffer): void {
      const key = data.toString();

      if (key === '\x1b' || key === '\x1b\x1b' || key === '\x03') {
        cleanup([]);
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup(Array.from(selected));
        return;
      }

      if (key === '\x1b[A' && cursor > 0) {
        cursor--;
        render(!firstRender);
        firstRender = false;
        return;
      }

      if (key === '\x1b[B' && cursor < items.length - 1) {
        cursor++;
        render(!firstRender);
        firstRender = false;
        return;
      }

      if (key === ' ') {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else {
          selected.add(cursor);
        }
        render(!firstRender);
        firstRender = false;
        return;
      }
    }

    stdin.on('data', onData);
    render(false);
  });
}
