import chalk from 'chalk';
import { theme } from './theme.js';

export interface MenuItem {
  label: string;
  description?: string;
  key?: string;
  marker?: string;
  disabled?: boolean;
  danger?: boolean;
  success?: boolean;
  icon?: string;
}

export interface SelectMenuOptions {
  title?: string;
  cancelLabel?: string;
  pageSize?: number;
  showCount?: boolean;
  autoFocus?: boolean;
}

const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?25h';
const ERASE_BELOW = '\x1b[J';

/**
 * Interactive arrow-key menu. Returns selected index or -1 if cancelled.
 *
 * Rendering: builds frame as line array, joins with \n, writes in single
 * stdout.write(). On redraw: \r + cursor-up by (lineCount-1) to reach
 * first line, then overwrite each line with \r\x1b[2K.
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

  function buildLines(): string[] {
    const lines: string[] = [];

    if (title) {
      lines.push('');
      lines.push(`  ${chalk.hex('#00d4ff').bold('┌─')} ${chalk.white.bold(title)} ${chalk.hex('#00d4ff').bold('─'.repeat(Math.max(0, 30 - title.length)))}`);
    }

    if (cursor < scrollOffset) scrollOffset = cursor;
    if (cursor >= scrollOffset + visibleCount) scrollOffset = cursor - visibleCount + 1;

    for (let vi = 0; vi < visibleCount; vi++) {
      const i = scrollOffset + vi;
      if (i >= items.length) { lines.push(''); continue; }

      const item = items[i];
      const sel = i === cursor;
      let prefix = sel ? chalk.hex('#00d4ff').bold('  ❯ ') : '    ';
      let label: string;
      let desc: string;
      const marker = item.marker ? ` ${item.marker}` : '';
      const keyHint = item.key ? chalk.dim(` [${item.key}]`) : '';

      if (item.disabled) {
        label = chalk.dim.strikethrough(item.label);
        desc = item.description ? chalk.dim(` — ${item.description}`) : '';
      } else if (item.danger) {
        prefix = sel ? chalk.red.bold('  ❯ ') : '    ';
        label = sel ? chalk.red.bold(item.label) : chalk.red(item.label);
        desc = item.description ? (sel ? chalk.red(` — ${item.description}`) : chalk.dim(` — ${item.description}`)) : '';
      } else if (item.success) {
        prefix = sel ? chalk.green.bold('  ❯ ') : '    ';
        label = sel ? chalk.green.bold(item.label) : chalk.green(item.label);
        desc = item.description ? (sel ? chalk.green(` — ${item.description}`) : chalk.dim(` — ${item.description}`)) : '';
      } else if (sel) {
        label = chalk.white.bold(item.label);
        desc = item.description ? chalk.white(` — ${item.description}`) : '';
      } else {
        label = item.label;
        desc = item.description ? chalk.dim(` — ${item.description}`) : '';
      }

      const icon = item.icon ? `${item.icon} ` : '';
      lines.push(`${prefix}${icon}${label}${desc}${marker}${keyHint}`);
    }

    if (items.length > visibleCount) {
      const above = scrollOffset > 0 ? '↑' : ' ';
      const below = scrollOffset + visibleCount < items.length ? '↓' : ' ';
      lines.push(chalk.dim(`    ${above} ${chalk.hex('#00d4ff')(`${scrollOffset + 1}-${Math.min(scrollOffset + visibleCount, items.length)}`)} of ${items.length} ${below}`));
    } else if (showCount && items.length > 1) {
      lines.push(chalk.dim(`    ${items.length} options`));
    } else {
      lines.push('');
    }

    lines.push('');
    lines.push(chalk.dim(`  ↑↓ navigate · Enter select · Esc/q ${cancelLabel}`));

    return lines;
  }

  return new Promise<number>((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let prevLineCount = 0;

    function draw(): void {
      const lines = buildLines();
      let out = HIDE;

      // On redraw: move cursor back to first line of previous frame
      if (prevLineCount > 0) {
        out += `\r\x1b[${prevLineCount - 1}A`;
      }

      // Write each line: go to col 0, erase line, write content
      out += lines.map(l => `\r\x1b[2K${l}`).join('\n');

      // Erase any leftover lines below (in case previous frame was longer)
      out += ERASE_BELOW;
      out += SHOW;

      prevLineCount = lines.length;
      process.stdout.write(out);
    }

    function cleanup(result: number): void {
      // Erase the menu: go to first line, erase everything below
      if (prevLineCount > 0) {
        process.stdout.write(`\r\x1b[${prevLineCount - 1}A${ERASE_BELOW}${SHOW}`);
      }
      stdin.removeListener('data', onData);
      if (stdin.isTTY && wasRaw !== undefined) stdin.setRawMode(wasRaw);
      resolve(result);
    }

    function moveCursor(direction: 1 | -1): void {
      const pos = enabledIndices.indexOf(cursor);
      if (pos === -1) return;
      const next = pos + direction;
      if (next >= 0 && next < enabledIndices.length) cursor = enabledIndices[next];
    }

    function onData(data: Buffer): void {
      const key = data.toString();

      if (key === '\x1b' || key === '\x1b\x1b') { cleanup(-1); return; }
      if (key === '\x03') { cleanup(-1); return; }
      if (key === '\r' || key === '\n') { cleanup(cursor); return; }
      if (key === '\x1b[A') { moveCursor(-1); draw(); return; }
      if (key === '\x1b[B') { moveCursor(1); draw(); return; }
      if (key === '\x1b[H' || key === '\x1b[5~') { cursor = enabledIndices[0]; draw(); return; }
      if (key === '\x1b[F' || key === '\x1b[6~') { cursor = enabledIndices[enabledIndices.length - 1]; draw(); return; }

      const char = key.toLowerCase();
      if (char.length === 1) {
        const idx = items.findIndex(it => !it.disabled && it.key === char);
        if (idx >= 0) { cleanup(idx); return; }
      }
      if (char === 'q') { cleanup(-1); return; }
    }

    stdin.on('data', onData);
    draw();
  });
}

/**
 * Yes/no confirmation prompt with arrow keys.
 */
export function confirmMenu(question: string, defaultYes = false): Promise<boolean> {
  process.stdout.write(`\n  ${chalk.hex('#00d4ff')('❓')} ${chalk.white.bold(question)}\n`);
  return selectMenu(
    [
      { label: 'Yes', icon: '✓', success: true, marker: defaultYes ? '◀ default' : undefined },
      { label: 'No', icon: '✗', danger: true, marker: !defaultYes ? '◀ default' : undefined },
    ],
    { cancelLabel: 'Cancel' },
  ).then((idx) => idx === 0);
}

/**
 * Menu with quick actions. Returns selected item or null.
 */
export async function quickActionMenu<T extends { label: string; action: () => void | Promise<void> }>(
  items: (T & { key?: string; danger?: boolean })[],
  opts?: SelectMenuOptions,
): Promise<T | null> {
  const menuItems: MenuItem[] = items.map(item => ({
    label: item.label,
    key: item.key,
    danger: item.danger,
  }));
  const idx = await selectMenu(menuItems, opts);
  if (idx === -1) return null;
  return items[idx];
}

/**
 * Multi-select menu. Returns array of selected indices.
 */
export async function multiSelectMenu(
  items: MenuItem[],
  opts: SelectMenuOptions = {},
): Promise<number[]> {
  const selected = new Set<number>();
  let cursor = 0;
  const { title, pageSize = 10 } = opts;
  const visibleCount = Math.min(pageSize, items.length);

  function buildLines(): string[] {
    const lines: string[] = [];

    if (title) {
      lines.push('');
      lines.push(`  ${chalk.hex('#00d4ff').bold('┌─')} ${chalk.white.bold(title)} ${chalk.hex('#00d4ff').bold('─'.repeat(Math.max(0, 30 - title.length)))}`);
    }

    for (let i = 0; i < visibleCount && i < items.length; i++) {
      const item = items[i];
      const sel = i === cursor;
      const checked = selected.has(i);
      const prefix = sel ? chalk.hex('#00d4ff').bold('  ❯ ') : '    ';
      const checkbox = checked ? chalk.green('☑') : chalk.dim('☐');
      const label = sel ? chalk.white.bold(item.label) : (item.disabled ? chalk.dim(item.label) : item.label);
      lines.push(`${prefix}${checkbox} ${label}`);
    }

    lines.push('');
    lines.push(chalk.dim(`  ↑↓ navigate · Space toggle · Enter confirm · Esc cancel`));
    lines.push(chalk.dim(`  ${selected.size} selected`));

    return lines;
  }

  return new Promise<number[]>((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();

    let prevLineCount = 0;

    function draw(): void {
      const lines = buildLines();
      let out = HIDE;
      if (prevLineCount > 0) {
        out += `\r\x1b[${prevLineCount - 1}A`;
      }
      out += lines.map(l => `\r\x1b[2K${l}`).join('\n');
      out += ERASE_BELOW + SHOW;
      prevLineCount = lines.length;
      process.stdout.write(out);
    }

    function cleanup(result: number[]): void {
      if (prevLineCount > 0) {
        process.stdout.write(`\r\x1b[${prevLineCount - 1}A${ERASE_BELOW}${SHOW}`);
      }
      stdin.removeListener('data', onData);
      if (stdin.isTTY && wasRaw !== undefined) stdin.setRawMode(wasRaw);
      resolve(result);
    }

    function onData(data: Buffer): void {
      const key = data.toString();

      if (key === '\x1b' || key === '\x1b\x1b' || key === '\x03') { cleanup([]); return; }
      if (key === '\r' || key === '\n') { cleanup(Array.from(selected)); return; }
      if (key === '\x1b[A' && cursor > 0) { cursor--; draw(); return; }
      if (key === '\x1b[B' && cursor < items.length - 1) { cursor++; draw(); return; }

      if (key === ' ') {
        if (selected.has(cursor)) selected.delete(cursor);
        else selected.add(cursor);
        draw();
        return;
      }
    }

    stdin.on('data', onData);
    draw();
  });
}
