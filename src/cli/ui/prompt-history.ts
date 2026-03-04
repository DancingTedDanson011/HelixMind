/**
 * Persistent prompt history — JSONL file at ~/.helixmind/history.jsonl
 *
 * Features:
 * - Append-only JSONL format (one JSON object per line)
 * - No duplicate consecutive entries
 * - Large content (>1024 chars) stored as truncated display text
 * - File locking via lockfile to prevent multi-instance corruption
 * - sessionId + projectPath metadata per entry
 * - Up/Down arrow navigation (loaded into readline.history)
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface HistoryEntry {
  displayText: string;
  timestamp: number;
  projectPath?: string;
  sessionId?: string;
}

const MAX_DISPLAY_LENGTH = 1024;
const MAX_ENTRIES = 1000;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRIES = 3;
const LOCK_RETRY_DELAY = 100;

export class PromptHistory {
  private historyDir: string;
  private historyFile: string;
  private lockFile: string;
  private entries: HistoryEntry[] = [];

  constructor(configDir?: string) {
    this.historyDir = configDir ?? join(homedir(), '.helixmind');
    this.historyFile = join(this.historyDir, 'history.jsonl');
    this.lockFile = join(this.historyDir, 'history.lock');
  }

  /**
   * Load history from disk. Returns entries newest-first for readline.
   */
  async load(): Promise<string[]> {
    try {
      if (!existsSync(this.historyFile)) return [];

      const content = readFileSync(this.historyFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      this.entries = [];
      for (const line of lines) {
        try {
          this.entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }

      // Cap entries if file grew too large
      if (this.entries.length > MAX_ENTRIES) {
        this.entries = this.entries.slice(-MAX_ENTRIES);
        // Rewrite trimmed file
        await this.withLock(() => {
          const trimmed = this.entries.map(e => JSON.stringify(e)).join('\n') + '\n';
          writeFileSync(this.historyFile, trimmed, 'utf-8');
        });
      }

      // Return display texts newest-first (for readline.history)
      return this.entries.map(e => e.displayText).reverse();
    } catch {
      return [];
    }
  }

  /**
   * Add an entry to history. Skips if identical to last entry.
   */
  async add(
    text: string,
    projectPath?: string,
    sessionId?: string,
  ): Promise<void> {
    if (!text.trim()) return;

    // No duplicate consecutive entries
    const last = this.entries[this.entries.length - 1];
    if (last && last.displayText === text) return;

    // Truncate large content for display
    const displayText = text.length > MAX_DISPLAY_LENGTH
      ? text.slice(0, MAX_DISPLAY_LENGTH)
      : text;

    const entry: HistoryEntry = {
      displayText,
      timestamp: Date.now(),
      projectPath,
      sessionId,
    };

    this.entries.push(entry);

    // Persist
    await this.withLock(() => {
      if (!existsSync(this.historyDir)) {
        mkdirSync(this.historyDir, { recursive: true });
      }
      appendFileSync(this.historyFile, JSON.stringify(entry) + '\n', 'utf-8');
    });
  }

  /**
   * Simple file locking — creates lockfile with PID, checks staleness.
   */
  private async withLock(fn: () => void): Promise<void> {
    for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
      try {
        // Check for stale lock
        if (existsSync(this.lockFile)) {
          try {
            const lockContent = readFileSync(this.lockFile, 'utf-8');
            const lockTime = parseInt(lockContent.split(':')[1] || '0', 10);
            if (Date.now() - lockTime > LOCK_STALE_MS) {
              // Stale lock — remove it
              try { writeFileSync(this.lockFile, `${process.pid}:${Date.now()}`, 'utf-8'); } catch { /* ignore */ }
            } else {
              // Active lock — retry
              await new Promise(r => setTimeout(r, LOCK_RETRY_DELAY));
              continue;
            }
          } catch {
            // Can't read lock — try to acquire anyway
          }
        }

        // Acquire lock
        writeFileSync(this.lockFile, `${process.pid}:${Date.now()}`, { flag: 'wx' });
      } catch {
        // Lock file already exists or creation failed — acquire with overwrite
        try {
          writeFileSync(this.lockFile, `${process.pid}:${Date.now()}`, 'utf-8');
        } catch {
          await new Promise(r => setTimeout(r, LOCK_RETRY_DELAY));
          continue;
        }
      }

      try {
        fn();
      } finally {
        // Release lock
        try {
          const lockContent = readFileSync(this.lockFile, 'utf-8');
          if (lockContent.startsWith(`${process.pid}:`)) {
            try { unlinkSync(this.lockFile); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
      return;
    }

    // All retries failed — execute without lock (better than losing the entry)
    fn();
  }
}
