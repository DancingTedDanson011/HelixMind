import { describe, it, expect } from 'vitest';
import { supportsVision } from '../../../src/cli/browser/vision.js';

describe('supportsVision', () => {
  describe('Anthropic', () => {
    it('should support claude-3-opus', () => {
      expect(supportsVision('anthropic', 'claude-3-opus-20240229')).toBe(true);
    });

    it('should support claude-3-sonnet', () => {
      expect(supportsVision('anthropic', 'claude-3-sonnet-20240229')).toBe(true);
    });

    it('should support claude-3-haiku', () => {
      expect(supportsVision('anthropic', 'claude-3-haiku-20240307')).toBe(true);
    });

    it('should support claude-3-5-sonnet', () => {
      expect(supportsVision('anthropic', 'claude-3-5-sonnet-20241022')).toBe(true);
    });

    it('should support claude-sonnet-4', () => {
      expect(supportsVision('anthropic', 'claude-sonnet-4-20250514')).toBe(true);
    });

    it('should support claude-opus-4', () => {
      expect(supportsVision('anthropic', 'claude-opus-4-20250514')).toBe(true);
    });

    it('should NOT support claude-2', () => {
      expect(supportsVision('anthropic', 'claude-2.1')).toBe(false);
    });

    it('should NOT support claude-instant', () => {
      expect(supportsVision('anthropic', 'claude-instant-1.2')).toBe(false);
    });
  });

  describe('OpenAI', () => {
    it('should support gpt-4o', () => {
      expect(supportsVision('openai', 'gpt-4o')).toBe(true);
    });

    it('should support gpt-4o-mini', () => {
      expect(supportsVision('openai', 'gpt-4o-mini')).toBe(true);
    });

    it('should support gpt-4-turbo', () => {
      expect(supportsVision('openai', 'gpt-4-turbo-2024-04-09')).toBe(true);
    });

    it('should support o1', () => {
      expect(supportsVision('openai', 'o1')).toBe(true);
    });

    it('should support o3', () => {
      expect(supportsVision('openai', 'o3')).toBe(true);
    });

    it('should support o4-mini', () => {
      expect(supportsVision('openai', 'o4-mini')).toBe(true);
    });

    it('should NOT support gpt-3.5-turbo', () => {
      expect(supportsVision('openai', 'gpt-3.5-turbo')).toBe(false);
    });

    it('should NOT support gpt-4 (non-turbo, non-o)', () => {
      expect(supportsVision('openai', 'gpt-4')).toBe(false);
    });
  });

  describe('Ollama', () => {
    it('should support llava', () => {
      expect(supportsVision('ollama', 'llava:13b')).toBe(true);
    });

    it('should support llava-llama3', () => {
      expect(supportsVision('ollama', 'llava-llama3:8b')).toBe(true);
    });

    it('should support bakllava', () => {
      expect(supportsVision('ollama', 'bakllava:7b')).toBe(true);
    });

    it('should support llama3.2-vision', () => {
      expect(supportsVision('ollama', 'llama3.2-vision:11b')).toBe(true);
    });

    it('should support moondream', () => {
      expect(supportsVision('ollama', 'moondream2:latest')).toBe(true);
    });

    it('should NOT support qwen2.5-coder', () => {
      expect(supportsVision('ollama', 'qwen2.5-coder:32b')).toBe(false);
    });

    it('should NOT support deepseek-r1', () => {
      expect(supportsVision('ollama', 'deepseek-r1:32b')).toBe(false);
    });

    it('should NOT support llama3.1 (non-vision)', () => {
      expect(supportsVision('ollama', 'llama3.1:70b')).toBe(false);
    });
  });

  describe('Unknown provider', () => {
    it('should return false for unknown providers', () => {
      expect(supportsVision('custom', 'some-model')).toBe(false);
    });
  });
});
