import chalk from 'chalk';
import type { CheckpointStore, Checkpoint } from './store.js';
import { createKeybindingState, processKeypress, type KeybindingState } from './keybinding.js';
import { revertChatOnly, revertBoth, type RevertResult } from './revert.js';
import type { ToolMessage } from '../providers/types.js';

export type BrowserResult =
  | { action: 'resume' }
  | { action: 'revert'; result: RevertResult; messageText: string };

interface BrowserOptions {
  store: CheckpointStore;
  agentHistory: ToolMessage[];
  simpleMessages: Array<{ role: string; content: string }>;
  isPaused: boolean;
}

interface RewindEntry {
  chatCheckpoint: Checkpoint;
  messageText: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  hasCodeChanges: boolean;
}

/**
 * Build RewindEntry list: group tool checkpoints under their preceding chat checkpoint.
 * Calculates file change stats from fileSnapshots of tool checkpoints between chat CPs.
 */
function buildRewindEntries(store: CheckpointStore): RewindEntry[] {
  // getAll() returns newest-first, we need chronological
  const all = [...store.getAll()].reverse();

  const chatIndices: number[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].type === 'chat') chatIndices.push(i);
  }

  const entries: RewindEntry[] = [];

  for (let ci = 0; ci < chatIndices.length; ci++) {
    const chatIdx = chatIndices[ci];
    const nextChatIdx = ci + 1 < chatIndices.length ? chatIndices[ci + 1] : all.length;
    const chatCp = all[chatIdx];

    // Collect tool checkpoints between this chat and the next
    const toolCps = all.slice(chatIdx + 1, nextChatIdx);

    // Compute file change stats
    const fileChanges = new Map<string, { added: number; removed: number }>();

    for (const tcp of toolCps) {
      if (!tcp.fileSnapshots) continue;
      for (const snap of tcp.fileSnapshots) {
        const beforeLines = snap.contentBefore ? snap.contentBefore.split('\n').length : 0;
        const afterLines = snap.contentAfter.split('\n').length;
        const diff = afterLines - beforeLines;

        const existing = fileChanges.get(snap.path);
        if (existing) {
          if (diff > 0) existing.added += diff;
          else existing.removed += Math.abs(diff);
        } else {
          fileChanges.set(snap.path, {
            added: diff > 0 ? diff : 0,
            removed: diff < 0 ? Math.abs(diff) : 0,
          });
        }
      }
    }

    let totalAdded = 0;
    let totalRemoved = 0;
    for (const { added, removed } of fileChanges.values()) {
      totalAdded += added;
      totalRemoved += removed;
    }

    entries.push({
      chatCheckpoint: chatCp,
      messageText: chatCp.label,
      filesChanged: fileChanges.size,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      hasCodeChanges: fileChanges.size > 0,
    });
  }

  return entries;
}

/**
 * Format elapsed time as human-readable string.
 */
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (sec === 0) return `${min}m`;
  return `${min}m ${sec}s`;
}

/**
 * Run the Rewind checkpoint browser. Shows only user messages with code change summaries.
 * Claude Code-style clean UI.
 */
export function runCheckpointBrowser(options: BrowserOptions): Promise<BrowserResult> {
  const { store, agentHistory, simpleMessages } = options;
  const entries = buildRewindEntries(store);

  if (entries.length === 0) {
    process.stdout.write(chalk.dim('\n  No checkpoints yet.\n\n'));
    return Promise.resolve({ action: 'resume' });
  }

  return new Promise<BrowserResult>((resolve) => {
    // selectedIndex points into entries; entries.length = "(current)"
    let selectedIndex = entries.length; // start at "(current)"
    let inOptions = false;
    const keyState = createKeybindingState();
    keyState.inBrowser = true;

    // Total items: entries + 1 for "(current)"
    const totalItems = entries.length + 1;
    const maxVisible = Math.min(totalItems, Math.max(6, (process.stdout.rows || 24) - 10));

    function render(): void {
      process.stdout.write('\x1b[2J\x1b[H');

      // Elapsed time header
      const allCps = [...store.getAll()].reverse();
      let elapsed = 0;
      if (allCps.length >= 2) {
        elapsed = allCps[allCps.length - 1].timestamp.getTime() - allCps[0].timestamp.getTime();
      }
      process.stdout.write(chalk.magenta(`  \u2726 Baked for ${formatElapsed(elapsed)}`) + '\n\n');

      // Title
      process.stdout.write(chalk.bold('  Rewind') + '\n');
      process.stdout.write(chalk.dim('  Restore the code and/or conversation to the point before...') + '\n\n');

      // Visible range for scrolling
      const start = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
      const end = Math.min(totalItems, start + maxVisible);

      for (let i = start; i < end; i++) {
        const isSelected = i === selectedIndex;

        if (i < entries.length) {
          // Entry row
          const entry = entries[i];
          const pointer = isSelected ? chalk.cyan('\u25B8 ') : '  ';
          const maxTextLen = Math.min(80, (process.stdout.columns || 80) - 10);
          const msgText = entry.messageText.length > maxTextLen
            ? entry.messageText.slice(0, maxTextLen - 3) + '...'
            : entry.messageText;

          // Change summary
          let changeSummary: string;
          if (entry.hasCodeChanges) {
            const parts = [`${entry.filesChanged} file${entry.filesChanged !== 1 ? 's' : ''} changed`];
            if (entry.linesAdded > 0) parts.push(chalk.green(`+${entry.linesAdded}`));
            if (entry.linesRemoved > 0) parts.push(chalk.red(`-${entry.linesRemoved}`));
            changeSummary = parts.join(' ');
          } else {
            changeSummary = chalk.dim('No code changes');
          }

          if (isSelected) {
            process.stdout.write(`  ${pointer}${chalk.white(msgText)}\n`);
            process.stdout.write(`      ${changeSummary}\n\n`);
          } else {
            process.stdout.write(`  ${pointer}${chalk.dim(msgText)}\n`);
            process.stdout.write(`      ${changeSummary}\n\n`);
          }
        } else {
          // "(current)" row
          const pointer = isSelected ? chalk.cyan('\u25B8 ') : '  ';
          if (isSelected) {
            process.stdout.write(`  ${pointer}${chalk.white('(current)')}\n\n`);
          } else {
            process.stdout.write(`  ${pointer}${chalk.dim('(current)')}\n\n`);
          }
        }
      }

      if (inOptions && selectedIndex < entries.length) {
        renderOptions(entries[selectedIndex]);
      } else {
        // Footer
        process.stdout.write(chalk.dim('  Enter to continue \u00B7 Esc to exit') + '\n');
      }
    }

    function renderOptions(entry: RewindEntry): void {
      process.stdout.write(chalk.cyan('  [1]') + ' Conversation only\n');
      if (entry.hasCodeChanges) {
        process.stdout.write(chalk.cyan('  [2]') + ' Conversation + file changes\n');
      }
      process.stdout.write(chalk.dim('  ESC = Back') + '\n');
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

        if (result.action === 'digit' && result.digit && selectedIndex < entries.length) {
          const entry = entries[selectedIndex];
          const cpId = entry.chatCheckpoint.id;

          switch (result.digit) {
            case 1: {
              cleanup();
              const r = revertChatOnly(cpId, store, agentHistory, simpleMessages);
              resolve({ action: 'revert', result: r, messageText: entry.messageText });
              return;
            }
            case 2: {
              if (entry.hasCodeChanges) {
                cleanup();
                const r = revertBoth(cpId, store, agentHistory, simpleMessages);
                resolve({ action: 'revert', result: r, messageText: entry.messageText });
                return;
              }
              break;
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
          if (selectedIndex < totalItems - 1) {
            selectedIndex++;
            render();
          }
          break;
        case 'enter':
          if (selectedIndex < entries.length) {
            inOptions = true;
            render();
          } else {
            // "(current)" selected — just close
            cleanup();
            resolve({ action: 'resume' });
          }
          break;
        case 'escape':
          cleanup();
          resolve({ action: 'resume' });
          break;
      }
    }

    function cleanup(): void {
      process.stdin.removeListener('data', handleKey);
      if (process.stdin.isTTY && !wasRaw) {
        process.stdin.setRawMode(false);
      }
      process.stdout.write('\x1b[2J\x1b[H');
    }

    let wasRaw = false;
    if (process.stdin.isTTY) {
      wasRaw = process.stdin.isRaw ?? false;
      process.stdin.setRawMode(true);
    }

    process.stdin.on('data', handleKey);
    render();
  });
}

function parseKey(str: string): { name?: string; sequence?: string; ctrl?: boolean } {
  if (str === '\x1b' || str === '\x1b\x1b') return { name: 'escape' };
  if (str === '\x1b[A') return { name: 'up' };
  if (str === '\x1b[B') return { name: 'down' };
  if (str === '\r' || str === '\n') return { name: 'return' };
  if (str.length === 1 && str >= '1' && str <= '2') return { sequence: str };
  if (str.charCodeAt(0) === 3) return { name: 'c', ctrl: true };
  return { sequence: str };
}
