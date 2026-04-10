import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { JarvisIdentityManager } from '../../../src/cli/jarvis/identity.js';

describe('JarvisIdentityManager prompt copy', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(process.env.TEMP || '/tmp', `jarvis-identity-${randomUUID()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('keeps Jarvis self-description grounded', () => {
    const manager = new JarvisIdentityManager(tmpDir);
    const prompt = manager.getIdentityPrompt();

    expect(prompt).toContain('autonomous assistant');
    expect(prompt).not.toContain('AGI');
    expect(prompt).not.toContain('continuous consciousness');
  });
});
