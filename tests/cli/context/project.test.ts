import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { analyzeProject } from '../../../src/cli/context/project.js';

describe('analyzeProject', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-project-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should detect package.json project', async () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      dependencies: { react: '^18.0.0' },
    }));
    mkdirSync(join(testDir, 'src'));
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export default 42;');

    const result = await analyzeProject(testDir);
    expect(result.name).toBe('test-project');
    expect(result.type).toBe('node');
    expect(result.frameworks).toContain('react');
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('should detect multiple frameworks', async () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      name: 'full-stack',
      dependencies: { next: '^14.0.0', tailwindcss: '^3.0.0' },
      devDependencies: { vitest: '^2.0.0' },
    }));

    const result = await analyzeProject(testDir);
    expect(result.frameworks).toContain('next');
    expect(result.frameworks).toContain('tailwindcss');
    expect(result.frameworks).toContain('vitest');
  });

  it('should handle empty directory', async () => {
    const result = await analyzeProject(testDir);
    expect(result.name).toBe('unknown');
    expect(result.type).toBe('unknown');
    expect(result.frameworks).toEqual([]);
  });

  it('should respect gitignore', async () => {
    writeFileSync(join(testDir, '.gitignore'), 'node_modules/\ndist/\n');
    mkdirSync(join(testDir, 'node_modules'));
    writeFileSync(join(testDir, 'node_modules', 'foo.js'), '');
    mkdirSync(join(testDir, 'src'));
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export const app = true;');

    const result = await analyzeProject(testDir);
    const filePaths = result.files.map(f => f.path);
    expect(filePaths.some(f => f.includes('node_modules'))).toBe(false);
    expect(filePaths.some(f => f.includes('app.ts'))).toBe(true);
  });

  it('should generate a project summary', async () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      name: 'my-app',
      dependencies: { express: '^4.0.0' },
    }));

    const result = await analyzeProject(testDir);
    expect(result.summary).toContain('my-app');
  });
});
