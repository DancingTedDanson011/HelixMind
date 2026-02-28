import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export interface UndoEntry {
  id: string;
  timestamp: number;
  tool: string;
  path: string;
  originalContent: string | null; // null if file didn't exist
  newContent: string;
}

export class UndoStack {
  private stack: UndoEntry[] = [];
  private maxSize = 50;

  push(entry: UndoEntry): void {
    this.stack.push(entry);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  }

  /**
   * Undo the last n changes. Returns the number of changes undone.
   */
  undo(count: number = 1): { undone: number; entries: UndoEntry[] } {
    const entries: UndoEntry[] = [];
    const toUndo = Math.min(count, this.stack.length);

    for (let i = 0; i < toUndo; i++) {
      const entry = this.stack.pop()!;
      if (entry.originalContent === null) {
        // File was created — we can't delete it (too dangerous), just note it
        entries.push(entry);
      } else {
        writeFileSync(entry.path, entry.originalContent, 'utf-8');
        entries.push(entry);
      }
    }

    return { undone: entries.length, entries };
  }

  /**
   * Get all undo-able entries (most recent first).
   */
  list(): UndoEntry[] {
    return [...this.stack].reverse();
  }

  /**
   * Capture the current state of a file before modification.
   */
  static captureState(path: string): string | null {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8');
  }

  get size(): number {
    return this.stack.length;
  }
}
