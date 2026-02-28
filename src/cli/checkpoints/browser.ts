import chalk from 'chalk';
import type { CheckpointStore, Checkpoint } from './store.js';
import { createKeybindingState, processKeypress, type KeybindingState } from './keybinding.js';
import { revertChatOnly, revertCodeOnly, revertBoth, type RevertResult } from './revert.js';
import type { ToolMessage } from '../providers/types.js';

export type BrowserResult =
  | { action: 'resume' }
  | { action: 'revert'; result: RevertResult };

interface BrowserOptions {
  store: CheckpointStore;
  agentHistory: ToolMessage[];
  simpleMessages: Array<{ role: string; content: string }>;
  isPaused: boolean;
}

/**
 * Run the checkpoint browser. This takes over the terminal until the user
 * either resumes (ESC) or selects a revert action.
 *
 * Returns the action taken.
 */
export function runCheckpointBrowser(options: BrowserOptions): Promise<BrowserResult> {
  const { store, agentHistory, simpleMessages, isPaused } = options;
  const checkpoints = store.getAll();

  if (checkpoints.length === 0) {
    process.stdout.write(chalk.dim('\n  No checkpoints yet.\n\n'));
    return Promise.resolve({ action: 'resume' });
  }

  return new Promise<BrowserResult>((resolve) => {
    let selectedIndex = 0;
    let inOptions = false;
    const keyState = createKeybindingState();
    keyState.inBrowser = true;

    const pageSize = Math.min(checkpoints.length, Math.max(8, (process.stdout.rows || 24) - 8));

    function render(): void {
      // Clear screen area
      const totalLines = pageSize + 6;
      process.stdout.write('\x1b[2J\x1b[H'); // Clear screen, move to top

      // Header
      const pauseLabel = isPaused ? chalk.yellow(' \u23F8\uFE0F AGENT PAUSED ') : '';
      process.stdout.write(
        chalk.dim('\u256D\u2500\u2500\u2500 \u{1F551} HelixMind Checkpoints \u2500\u2500\u2500') +
        pauseLabel +
        chalk.dim('\u2500'.repeat(Math.max(1, 50 - pauseLabel.length))) +
        chalk.dim('\u256E') + '\n',
      );
      process.stdout.write(chalk.dim('\u2502') + '\n');

      // Visible range
      const start = Math.max(0, selectedIndex - Math.floor(pageSize / 2));
      const end = Math.min(checkpoints.length, start + pageSize);

      for (let i = start; i < end; i++) {
        const cp = checkpoints[i];
        const isSelected = i === selectedIndex;
        const pointer = isSelected ? chalk.cyan('\u25BA') : ' ';
        const icon = getCheckpointIcon(cp);
        const time = formatTime(cp.timestamp);
        const typeLabel = cp.type.replace('tool_', '').padEnd(6);

        const line = `  ${pointer} #${String(cp.id).padStart(3)}  ${time}  ${icon} ${chalk.cyan(typeLabel)}  ${truncate(cp.label, 50)}`;

        if (isSelected) {
          process.stdout.write(chalk.dim('\u2502') + chalk.bgGray.white(stripAnsi(line).padEnd(70)) + '\n');
        } else {
          process.stdout.write(chalk.dim('\u2502') + line + '\n');
        }
      }

      // Scroll indicator
      if (checkpoints.length > pageSize) {
        const pos = Math.round((selectedIndex / (checkpoints.length - 1)) * 10);
        const scrollBar = '\u2591'.repeat(pos) + '\u2588' + '\u2591'.repeat(10 - pos);
        process.stdout.write(chalk.dim('\u2502  ') + chalk.dim(scrollBar) + '\n');
      }

      process.stdout.write(chalk.dim('\u2502') + '\n');

      if (inOptions) {
        renderOptions(checkpoints[selectedIndex]);
      } else {
        // Footer
        const footer = isPaused
          ? 'ESC = Resume Agent \u2502 Enter = Options \u2502 \u2191\u2193 Navigate'
          : 'ESC = Close \u2502 Enter = Options \u2502 \u2191\u2193 Navigate';
        process.stdout.write(
          chalk.dim('\u2570\u2500\u2500\u2500 ') +
          chalk.dim(footer) +
          chalk.dim(' \u2500'.repeat(Math.max(1, 50 - footer.length))) +
          chalk.dim('\u256F') + '\n',
        );
      }
    }

    function renderOptions(cp: Checkpoint): void {
      const hasCode = cp.fileSnapshots && cp.fileSnapshots.length > 0;

      process.stdout.write(chalk.dim('\u2502  ') + chalk.yellow('Options for #' + cp.id + ':') + '\n');
      process.stdout.write(chalk.dim('\u2502  ') + chalk.cyan('[1]') + ' Revert Chat Only\n');
      if (hasCode) {
        process.stdout.write(chalk.dim('\u2502  ') + chalk.cyan('[2]') + ' Revert Code Only\n');
        process.stdout.write(chalk.dim('\u2502  ') + chalk.cyan('[3]') + ' Revert Both\n');
      }
      process.stdout.write(chalk.dim('\u2502  ') + chalk.cyan('[4]') + ' View Details\n');
      process.stdout.write(chalk.dim('\u2502  ') + chalk.dim('ESC = Back') + '\n');
      process.stdout.write(
        chalk.dim('\u2570') +
        chalk.dim('\u2500'.repeat(70)) +
        chalk.dim('\u256F') + '\n',
      );
    }

    function handleKey(chunk: Buffer): void {
      const str = chunk.toString();
      const key = parseKey(str);
      const result = processKeypress(key, keyState);

      if (inOptions) {
        if (result.action === 'escape') {
          inOptions = false;
          render();
          return;
        }

        if (result.action === 'digit' && result.digit) {
          const cp = checkpoints[selectedIndex];
          switch (result.digit) {
            case 1: {
              cleanup();
              const r = revertChatOnly(cp.id, store, agentHistory, simpleMessages);
              resolve({ action: 'revert', result: r });
              return;
            }
            case 2: {
              if (cp.fileSnapshots && cp.fileSnapshots.length > 0) {
                cleanup();
                const r = revertCodeOnly(cp.id, store);
                resolve({ action: 'revert', result: r });
                return;
              }
              break;
            }
            case 3: {
              if (cp.fileSnapshots && cp.fileSnapshots.length > 0) {
                cleanup();
                const r = revertBoth(cp.id, store, agentHistory, simpleMessages);
                resolve({ action: 'revert', result: r });
                return;
              }
              break;
            }
            case 4: {
              // View details
              process.stdout.write('\n');
              process.stdout.write(chalk.cyan(`  Checkpoint #${cp.id}\n`));
              process.stdout.write(chalk.dim(`  Time: ${cp.timestamp.toLocaleTimeString()}\n`));
              process.stdout.write(chalk.dim(`  Type: ${cp.type}\n`));
              process.stdout.write(chalk.dim(`  Label: ${cp.label}\n`));
              if (cp.toolName) process.stdout.write(chalk.dim(`  Tool: ${cp.toolName}\n`));
              if (cp.fileSnapshots) {
                process.stdout.write(chalk.dim(`  Files: ${cp.fileSnapshots.map(s => s.path).join(', ')}\n`));
              }
              if (cp.toolResult) {
                process.stdout.write(chalk.dim(`  Result: ${cp.toolResult.slice(0, 200)}\n`));
              }
              process.stdout.write('\n  ' + chalk.dim('Press any key to go back...') + '\n');
              // Wait for any key then re-render
              const onceKey = () => {
                process.stdin.removeListener('data', onceKey);
                render();
              };
              process.stdin.on('data', onceKey);
              return;
            }
          }
        }
        return;
      }

      // Normal browser mode
      switch (result.action) {
        case 'up':
          if (selectedIndex > 0) {
            selectedIndex--;
            render();
          }
          break;
        case 'down':
          if (selectedIndex < checkpoints.length - 1) {
            selectedIndex++;
            render();
          }
          break;
        case 'enter':
          inOptions = true;
          render();
          break;
        case 'escape':
          cleanup();
          resolve({ action: 'resume' });
          break;
      }
    }

    function cleanup(): void {
      process.stdin.removeListener('data', handleKey);
      // Restore original raw mode state
      if (process.stdin.isTTY && !wasRaw) {
        process.stdin.setRawMode(false);
      }
      // Clear the browser display
      process.stdout.write('\x1b[2J\x1b[H');
    }

    // Enable raw mode for keypress handling
    let wasRaw = false;
    if (process.stdin.isTTY) {
      wasRaw = process.stdin.isRaw ?? false;
      process.stdin.setRawMode(true);
    }

    process.stdin.on('data', handleKey);
    render();
  });
}

function getCheckpointIcon(cp: Checkpoint): string {
  const icons: Record<string, string> = {
    session_start: '\u{1F680}',
    chat: '\u{1F4AC}',
    tool_read: '\u{1F4C4}',
    tool_edit: '\u{270F}\u{FE0F}',
    tool_write: '\u{1F4DD}',
    tool_run: '\u26A1',
    tool_commit: '\u{1F4E6}',
    tool_search: '\u{1F50D}',
    feed: '\u{1F300}',
    config: '\u2699\u{FE0F}',
  };
  return icons[cp.type] ?? '\u{1F4CC}';
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function parseKey(str: string): { name?: string; sequence?: string; ctrl?: boolean } {
  if (str === '\x1b' || str === '\x1b\x1b') return { name: 'escape' };
  if (str === '\x1b[A') return { name: 'up' };
  if (str === '\x1b[B') return { name: 'down' };
  if (str === '\r' || str === '\n') return { name: 'return' };
  if (str.length === 1 && str >= '1' && str <= '4') return { sequence: str };
  if (str.charCodeAt(0) === 3) return { name: 'c', ctrl: true };
  return { sequence: str };
}
