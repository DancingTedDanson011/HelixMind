import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFiles } from '../../../src/cli/feed/reader.js';
import type { ScannedFile } from '../../../src/cli/feed/scanner.js';

function makeScanned(testDir: string, relPath: string, content: string): ScannedFile {
  const fullPath = join(testDir, relPath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf('/') === -1 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  const ext = relPath.substring(relPath.lastIndexOf('.'));
  return {
    path: fullPath,
    relativePath: relPath,
    size: Buffer.byteLength(content, 'utf-8'),
    ext,
    priority: 10,
    lastModified: Date.now(),
  };
}

describe('readFiles', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-reader-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should read TypeScript files and detect language', () => {
    const scanned = [makeScanned(testDir, 'src/app.ts', 'const x = 1;')];
    const result = readFiles(scanned);
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('typescript');
    expect(result[0].content).toBe('const x = 1;');
    expect(result[0].truncated).toBe(false);
  });

  it('should detect various languages', () => {
    const files = [
      makeScanned(testDir, 'main.py', 'print("hello")'),
      makeScanned(testDir, 'lib.rs', 'fn main() {}'),
      makeScanned(testDir, 'app.go', 'package main'),
      makeScanned(testDir, 'config.json', '{}'),
    ];
    const result = readFiles(files);
    expect(result[0].language).toBe('python');
    expect(result[1].language).toBe('rust');
    expect(result[2].language).toBe('go');
    expect(result[3].language).toBe('json');
  });

  it('should skip empty files', () => {
    const scanned = [makeScanned(testDir, 'empty.ts', '   ')];
    const result = readFiles(scanned);
    expect(result).toHaveLength(0);
  });

  it('should skip files over MAX_FILE_SIZE in normal mode', () => {
    const bigContent = 'x'.repeat(60_000);
    const scanned: ScannedFile[] = [{
      path: join(testDir, 'big.ts'),
      relativePath: 'big.ts',
      size: 60_000,
      ext: '.ts',
      priority: 10,
      lastModified: Date.now(),
    }];
    writeFileSync(join(testDir, 'big.ts'), bigContent);
    const result = readFiles(scanned);
    expect(result).toHaveLength(0);
  });

  it('should read large files in deep mode', () => {
    const bigContent = 'x'.repeat(60_000);
    const scanned: ScannedFile[] = [{
      path: join(testDir, 'big.ts'),
      relativePath: 'big.ts',
      size: 60_000,
      ext: '.ts',
      priority: 10,
      lastModified: Date.now(),
    }];
    writeFileSync(join(testDir, 'big.ts'), bigContent);
    const result = readFiles(scanned, true);
    expect(result).toHaveLength(1);
  });

  it('should truncate files with more than 200 lines', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `line ${i + 1}`);
    const scanned = [makeScanned(testDir, 'long.ts', lines.join('\n'))];
    const result = readFiles(scanned);
    expect(result).toHaveLength(1);
    expect(result[0].truncated).toBe(true);
    expect(result[0].content).toContain('// ... truncated');
    expect(result[0].content.split('\n').length).toBeLessThanOrEqual(201);
  });

  it('should not truncate in deep mode', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `line ${i + 1}`);
    const scanned: ScannedFile[] = [{
      path: join(testDir, 'long.ts'),
      relativePath: 'long.ts',
      size: Buffer.byteLength(lines.join('\n')),
      ext: '.ts',
      priority: 10,
      lastModified: Date.now(),
    }];
    writeFileSync(join(testDir, 'long.ts'), lines.join('\n'));
    const result = readFiles(scanned, true);
    expect(result).toHaveLength(1);
    expect(result[0].truncated).toBe(false);
  });

  it('should skip unreadable files gracefully', () => {
    const scanned: ScannedFile[] = [{
      path: join(testDir, 'nonexistent.ts'),
      relativePath: 'nonexistent.ts',
      size: 100,
      ext: '.ts',
      priority: 10,
      lastModified: Date.now(),
    }];
    const result = readFiles(scanned);
    expect(result).toHaveLength(0);
  });
});
