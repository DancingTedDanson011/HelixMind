import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ConfigStore } from '../../../src/cli/config/store.js';

describe('config commands logic', () => {
  let testDir: string;
  let store: ConfigStore;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-cmd-config-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    store = new ConfigStore(testDir);
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should set string values', () => {
    store.set('apiKey', 'sk-test-123');
    expect(store.get('apiKey')).toBe('sk-test-123');
  });

  it('should set boolean values', () => {
    store.set('spiral.enabled', false);
    expect(store.get('spiral.enabled')).toBe(false);
  });

  it('should set numeric values', () => {
    store.set('spiral.maxTokensBudget', 50000);
    expect(store.get('spiral.maxTokensBudget')).toBe(50000);
  });

  it('should change provider', () => {
    store.set('provider', 'openai');
    expect(store.get('provider')).toBe('openai');
  });

  it('should list config entries with masked API key', () => {
    store.set('apiKey', 'sk-ant-api03-very-long-key-here');
    const entries = store.listFlat();
    const apiEntry = entries.find(e => e.key === 'apiKey');
    expect(apiEntry).toBeDefined();
    // API key should be masked in listFlat output
    expect(apiEntry!.value).toContain('...');
    expect(apiEntry!.value).not.toBe('sk-ant-api03-very-long-key-here');
  });
});
