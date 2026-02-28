import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// We test the init logic directly
describe('init command', () => {
  let testDir: string;
  let originalCwd: () => string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-init-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    originalCwd = process.cwd;
    process.cwd = () => testDir;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should create .helixmind directory', async () => {
    const { initCommand } = await import('../../../src/cli/commands/init.js');

    // Capture stdout
    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => { writes.push(String(chunk)); return true; }) as any;

    initCommand();

    process.stdout.write = origWrite;

    expect(existsSync(join(testDir, '.helixmind'))).toBe(true);
    expect(existsSync(join(testDir, '.helixmind', 'context.md'))).toBe(true);
    expect(writes.some(w => w.includes('Initialized'))).toBe(true);
  });

  it('should create context.md with template', async () => {
    const { initCommand } = await import('../../../src/cli/commands/init.js');

    const origWrite = process.stdout.write;
    process.stdout.write = (() => true) as any;
    initCommand();
    process.stdout.write = origWrite;

    const content = readFileSync(join(testDir, '.helixmind', 'context.md'), 'utf-8');
    expect(content).toContain('HelixMind Project Context');
    expect(content).toContain('Conventions');
  });

  it('should warn if already initialized', async () => {
    mkdirSync(join(testDir, '.helixmind'));
    const { initCommand } = await import('../../../src/cli/commands/init.js');

    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => { writes.push(String(chunk)); return true; }) as any;

    initCommand();

    process.stdout.write = origWrite;

    expect(writes.some(w => w.includes('Already initialized'))).toBe(true);
  });
});
