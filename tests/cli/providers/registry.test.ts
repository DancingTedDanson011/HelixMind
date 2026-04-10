import { describe, it, expect, afterEach } from 'vitest';
import {
  isModelFree,
  registerFreeModel,
  unregisterFreeModel,
  KNOWN_PROVIDERS,
  getProviderNames,
} from '../../../src/cli/providers/registry.js';

describe('registry - free model detection', () => {
  afterEach(() => {
    unregisterFreeModel('glm-5.1-free');
    unregisterFreeModel('test-free-model');
  });

  it('should detect hardcoded free models', () => {
    expect(isModelFree('glm-4.7-flash')).toBe(true);
    expect(isModelFree('glm-4.5-flash')).toBe(true);
  });

  it('should return false for paid models', () => {
    expect(isModelFree('claude-sonnet-4-6')).toBe(false);
    expect(isModelFree('gpt-4o')).toBe(false);
    expect(isModelFree('glm-5')).toBe(false);
  });

  it('should detect dynamically registered free models', () => {
    registerFreeModel('glm-5.1-free');
    expect(isModelFree('glm-5.1-free')).toBe(true);
  });

  it('should un-detect after unregister', () => {
    registerFreeModel('test-free-model');
    expect(isModelFree('test-free-model')).toBe(true);
    unregisterFreeModel('test-free-model');
    expect(isModelFree('test-free-model')).toBe(false);
  });
});

describe('registry - known providers', () => {
  it('should have 8 providers', () => {
    expect(getProviderNames().length).toBe(8);
  });

  it('should include all expected providers', () => {
    const names = getProviderNames();
    expect(names).toContain('anthropic');
    expect(names).toContain('openai');
    expect(names).toContain('deepseek');
    expect(names).toContain('groq');
    expect(names).toContain('together');
    expect(names).toContain('ollama');
    expect(names).toContain('zai');
    expect(names).toContain('openrouter');
  });
});
