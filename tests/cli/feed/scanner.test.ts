import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { scanDirectory } from '../../../src/cli/feed/scanner.js';

describe('scanDirectory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-scanner-test-${randomUUID()}`);
    mkdirSync(join(testDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should scan files and return sorted results', async () => {
    writeFileSync(join(testDir, 'package.json'), '{}');
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export default 42;');
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export const app = true;');

    const results = await scanDirectory(testDir);
    expect(results.length).toBeGreaterThanOrEqual(3);
    // package.json should be first (priority 1)
    expect(results[0].relativePath).toBe('package.json');
  });

  it('should skip node_modules', async () => {
    mkdirSync(join(testDir, 'node_modules', 'foo'), { recursive: true });
    writeFileSync(join(testDir, 'node_modules', 'foo', 'index.js'), '');
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export const app = true;');

    const results = await scanDirectory(testDir);
    expect(results.some(f => f.relativePath.includes('node_modules'))).toBe(false);
  });

  it('should skip binary files', async () => {
    writeFileSync(join(testDir, 'image.png'), Buffer.from([0x89, 0x50]));
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export const app = true;');

    const results = await scanDirectory(testDir);
    expect(results.some(f => f.relativePath.includes('.png'))).toBe(false);
  });

  it('should respect .gitignore', async () => {
    writeFileSync(join(testDir, '.gitignore'), 'dist/\n');
    mkdirSync(join(testDir, 'dist'));
    writeFileSync(join(testDir, 'dist', 'bundle.js'), '');
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export const app = true;');

    const results = await scanDirectory(testDir);
    expect(results.some(f => f.relativePath.includes('dist'))).toBe(false);
  });

  it('should handle empty directory', async () => {
    const emptyDir = join(tmpdir(), `helixmind-empty-${randomUUID()}`);
    mkdirSync(emptyDir, { recursive: true });
    const results = await scanDirectory(emptyDir);
    expect(results.length).toBe(0);
    try { rmSync(emptyDir, { recursive: true, force: true }); } catch {}
  });

  it('should handle non-existent directory', async () => {
    const results = await scanDirectory('/nonexistent/path');
    expect(results.length).toBe(0);
  });

  it('should prioritize entry points over regular files', async () => {
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export default 42;');
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const x = 1;');

    const results = await scanDirectory(testDir);
    const indexPriority = results.find(f => f.relativePath.includes('index.ts'))?.priority ?? 99;
    const utilsPriority = results.find(f => f.relativePath.includes('utils.ts'))?.priority ?? 99;
    expect(indexPriority).toBeLessThanOrEqual(utilsPriority);
  });
});
