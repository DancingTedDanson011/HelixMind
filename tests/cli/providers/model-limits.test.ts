import { describe, it, expect, afterEach } from 'vitest';
import {
  getModelContextLength,
  registerModelContextLength,
  unregisterModelContextLength,
} from '../../../src/cli/providers/model-limits.js';

describe('model-limits - custom registration', () => {
  afterEach(() => {
    // Clean up any custom registrations
    unregisterModelContextLength('glm-5.1');
    unregisterModelContextLength('test-custom-model');
  });

  it('should return hardcoded length for known models', () => {
    expect(getModelContextLength('claude-sonnet-4-6', 'anthropic')).toBe(200_000);
    expect(getModelContextLength('gpt-4o', 'openai')).toBe(128_000);
    expect(getModelContextLength('deepseek-chat', 'deepseek')).toBe(64_000);
  });

  it('should return default 128K for unknown cloud models', () => {
    expect(getModelContextLength('unknown-model', 'zai')).toBe(128_000);
  });

  it('should return 32K default for unknown Ollama models', () => {
    expect(getModelContextLength('my-local-model', 'ollama')).toBe(32_000);
  });

  it('should return custom length after registration', () => {
    registerModelContextLength('glm-5.1', 256_000);
    expect(getModelContextLength('glm-5.1', 'zai')).toBe(256_000);
  });

  it('should prefer custom registration over defaults', () => {
    // Override a known model's context length
    registerModelContextLength('gpt-4o', 256_000);
    expect(getModelContextLength('gpt-4o', 'openai')).toBe(256_000);
    unregisterModelContextLength('gpt-4o');
  });

  it('should remove custom length on unregister', () => {
    registerModelContextLength('test-custom-model', 64_000);
    expect(getModelContextLength('test-custom-model')).toBe(64_000);
    unregisterModelContextLength('test-custom-model');
    expect(getModelContextLength('test-custom-model')).toBe(128_000); // falls back to default
  });
});
