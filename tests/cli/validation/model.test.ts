import { describe, it, expect } from 'vitest';
import { getValidationModelConfig } from '../../../src/cli/validation/model.js';

describe('Validation Model Selection', () => {
  it('should map claude-opus to haiku', () => {
    const config = getValidationModelConfig('claude-opus-4-6', 'anthropic');
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-haiku-4-5-20251001');
  });

  it('should map claude-sonnet to haiku', () => {
    const config = getValidationModelConfig('claude-sonnet-4-6', 'anthropic');
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-haiku-4-5-20251001');
  });

  it('should map gpt-4o to gpt-4o-mini', () => {
    const config = getValidationModelConfig('gpt-4o', 'openai');
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o-mini');
  });

  it('should map gpt-4-turbo to gpt-4o-mini', () => {
    const config = getValidationModelConfig('gpt-4-turbo', 'openai');
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o-mini');
  });

  it('should map deepseek-chat to deepseek-chat', () => {
    const config = getValidationModelConfig('deepseek-chat', 'deepseek');
    expect(config.provider).toBe('deepseek');
    expect(config.model).toBe('deepseek-chat');
  });

  it('should map groq llama-70b to 8b-instant', () => {
    const config = getValidationModelConfig('llama-3.3-70b-versatile', 'groq');
    expect(config.provider).toBe('groq');
    expect(config.model).toBe('llama-3.1-8b-instant');
  });

  it('should fallback to same provider for unknown model', () => {
    const config = getValidationModelConfig('unknown-model', 'anthropic');
    expect(config.provider).toBe('anthropic');
  });

  it('should fallback to same model for completely unknown', () => {
    const config = getValidationModelConfig('unknown-model', 'unknown-provider');
    expect(config.provider).toBe('unknown-provider');
    expect(config.model).toBe('unknown-model');
  });
});
