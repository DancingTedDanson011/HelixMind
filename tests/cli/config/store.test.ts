import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ConfigStore } from '../../../src/cli/config/store.js';

describe('ConfigStore', () => {
  let testDir: string;
  let store: ConfigStore;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-config-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    store = new ConfigStore(testDir);
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY on Windows */ }
  });

  it('should create config file with defaults on first load', () => {
    const config = store.getAll();
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-6');
    expect(config.spiral.enabled).toBe(true);
  });

  it('should persist config to disk', () => {
    store.set('provider', 'openai');
    const raw = JSON.parse(readFileSync(join(testDir, 'config.json'), 'utf-8'));
    expect(raw.provider).toBe('openai');
  });

  it('should get a single value', () => {
    expect(store.get('provider')).toBe('anthropic');
  });

  it('should set and get nested values', () => {
    store.set('spiral.enabled', false);
    expect(store.get('spiral.enabled')).toBe(false);
  });

  it('should set API key', () => {
    store.set('apiKey', 'sk-ant-test-123');
    expect(store.get('apiKey')).toBe('sk-ant-test-123');
  });

  it('should reload config from disk', () => {
    store.set('model', 'gpt-4o');
    const store2 = new ConfigStore(testDir);
    expect(store2.get('model')).toBe('gpt-4o');
  });

  it('should return default config structure', () => {
    const config = store.getAll();
    expect(config).toHaveProperty('provider');
    expect(config).toHaveProperty('apiKey');
    expect(config).toHaveProperty('model');
    expect(config).toHaveProperty('providers');
    expect(config).toHaveProperty('spiral');
    expect(config.spiral).toHaveProperty('enabled');
    expect(config.spiral).toHaveProperty('autoStore');
    expect(config.spiral).toHaveProperty('maxTokensBudget');
  });

  it('should handle setting the model', () => {
    store.set('model', 'claude-opus-4-6');
    expect(store.get('model')).toBe('claude-opus-4-6');
  });

  it('should list all config as flat entries', () => {
    store.set('apiKey', 'test-key-1234567890');
    const entries = store.listFlat();
    expect(entries).toContainEqual({ key: 'provider', value: 'anthropic' });
    // API key should be masked in listFlat
    const apiEntry = entries.find(e => e.key === 'apiKey');
    expect(apiEntry).toBeDefined();
    expect(apiEntry!.value).toContain('...');
    expect(entries).toContainEqual({ key: 'spiral.enabled', value: true });
  });
});

describe('ConfigStore - Provider Management', () => {
  let testDir: string;
  let store: ConfigStore;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-config-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    store = new ConfigStore(testDir);
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should add a provider with API key', () => {
    store.addProvider('anthropic', 'sk-ant-test-key-12345');
    const providers = store.getProviders();
    expect(providers.length).toBe(1);
    expect(providers[0].name).toBe('anthropic');
    expect(providers[0].entry.apiKey).toBe('sk-ant-test-key-12345');
    expect(providers[0].entry.models.length).toBeGreaterThan(0);
  });

  it('should set first provider as active', () => {
    store.addProvider('anthropic', 'sk-ant-test-key-12345');
    const config = store.getAll();
    expect(config.provider).toBe('anthropic');
    expect(config.apiKey).toBe('sk-ant-test-key-12345');
  });

  it('should add multiple providers', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.addProvider('openai', 'sk-openai-key');
    const providers = store.getProviders();
    expect(providers.length).toBe(2);
  });

  it('should switch between providers', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.addProvider('openai', 'sk-openai-key');

    store.switchProvider('openai');
    const config = store.getAll();
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('sk-openai-key');
  });

  it('should switch provider with specific model', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.switchProvider('anthropic', 'claude-opus-4-6');
    expect(store.getAll().model).toBe('claude-opus-4-6');
  });

  it('should switch model within current provider', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.switchModel('claude-opus-4-6');
    expect(store.getAll().model).toBe('claude-opus-4-6');
  });

  it('should remove a provider', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.addProvider('openai', 'sk-openai-key');

    const removed = store.removeProvider('anthropic');
    expect(removed).toBe(true);
    expect(store.getProviders().length).toBe(1);
  });

  it('should switch to remaining provider when active is removed', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.addProvider('openai', 'sk-openai-key');

    store.removeProvider('anthropic');
    const config = store.getAll();
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('sk-openai-key');
  });

  it('should clear API key when last provider removed', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.removeProvider('anthropic');
    expect(store.hasApiKey()).toBe(false);
  });

  it('should return false when removing non-existent provider', () => {
    expect(store.removeProvider('nonexistent')).toBe(false);
  });

  it('should check hasApiKey correctly', () => {
    expect(store.hasApiKey()).toBe(false);
    store.addProvider('anthropic', 'sk-ant-key');
    expect(store.hasApiKey()).toBe(true);
  });

  it('should get available models for a provider', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    const models = store.getModels('anthropic');
    expect(models).toContain('claude-sonnet-4-6');
    expect(models).toContain('claude-opus-4-6');
  });

  it('should mask API keys for display', () => {
    const masked = ConfigStore.maskKey('sk-ant-api03-longkeyvalue1234');
    expect(masked).toContain('...');
    expect(masked).not.toBe('sk-ant-api03-longkeyvalue1234');
    expect(masked.length).toBeLessThan('sk-ant-api03-longkeyvalue1234'.length);
  });

  it('should update existing provider key', () => {
    store.addProvider('anthropic', 'old-key-12345');
    store.addProvider('anthropic', 'new-key-67890');

    const providers = store.getProviders();
    expect(providers.length).toBe(1);
    expect(providers[0].entry.apiKey).toBe('new-key-67890');
  });

  it('should persist providers to disk', () => {
    store.addProvider('anthropic', 'sk-ant-key');
    store.addProvider('openai', 'sk-openai-key');

    const store2 = new ConfigStore(testDir);
    const providers = store2.getProviders();
    expect(providers.length).toBe(2);
  });
});
