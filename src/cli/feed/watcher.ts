import { watch, type FSWatcher } from 'node:fs';
import { join, extname } from 'node:path';
import { scanDirectory } from './scanner.js';
import { readFiles } from './reader.js';
import { parseFiles } from './parser.js';
import type { SpiralEngine } from '../../spiral/engine.js';

const DEBOUNCE_MS = 1000;

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2',
  '.ttf', '.db', '.db-wal', '.db-shm', '.lock', '.map',
]);

export class FeedWatcher {
  private watchers: FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPaths = new Set<string>();
  private engine: SpiralEngine;
  private rootDir: string;

  constructor(engine: SpiralEngine, rootDir: string) {
    this.engine = engine;
    this.rootDir = rootDir;
  }

  start(): void {
    const watcher = watch(this.rootDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      const ext = extname(filename);
      if (BINARY_EXTENSIONS.has(ext)) return;
      if (filename.includes('node_modules') || filename.includes('.git') || filename.includes('dist')) return;

      this.pendingPaths.add(filename);
      this.scheduleProcess();
    });

    this.watchers.push(watcher);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleProcess(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processChanges(), DEBOUNCE_MS);
  }

  private async processChanges(): Promise<void> {
    const paths = Array.from(this.pendingPaths);
    this.pendingPaths.clear();

    for (const filePath of paths) {
      try {
        const scanned = await scanDirectory(this.rootDir, filePath);
        if (scanned.length === 0) continue;

        const read = readFiles(scanned);
        if (read.length === 0) continue;

        const parsed = parseFiles(read);

        for (const file of parsed) {
          await this.engine.store(file.summary, 'code', {
            file: file.relativePath,
            language: file.language,
            tags: ['watch', 'auto-update'],
          });
        }
      } catch {
        // Skip file processing errors
      }
    }
  }
}
