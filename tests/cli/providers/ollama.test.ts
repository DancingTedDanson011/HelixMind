import { describe, it, expect } from 'vitest';
import { RECOMMENDED_MODELS, formatModelSize } from '../../../src/cli/providers/ollama.js';

describe('Ollama Integration', () => {
  it('should have recommended models with required fields', () => {
    expect(RECOMMENDED_MODELS.length).toBeGreaterThan(0);
    for (const model of RECOMMENDED_MODELS) {
      expect(model.name).toBeTruthy();
      expect(model.size).toBeTruthy();
      expect(model.description).toBeTruthy();
      expect(model.vram).toBeGreaterThan(0);
    }
  });

  it('should have qwen2.5-coder:32b as a recommended model', () => {
    const qwen = RECOMMENDED_MODELS.find(m => m.name === 'qwen2.5-coder:32b');
    expect(qwen).toBeDefined();
    expect(qwen!.vram).toBe(22);
  });

  it('should have qwen3-coder as top recommendation', () => {
    expect(RECOMMENDED_MODELS[0].name).toContain('qwen3-coder');
  });

  it('should format model sizes correctly', () => {
    expect(formatModelSize(1024 * 1024 * 1024 * 22)).toBe('22.0 GB');
    expect(formatModelSize(1024 * 1024 * 1024 * 5.2)).toBe('5.2 GB');
    expect(formatModelSize(1024 * 1024 * 500)).toBe('500 MB');
  });

  it('should have all recommended models fit in 32GB VRAM', () => {
    for (const model of RECOMMENDED_MODELS) {
      expect(model.vram).toBeLessThanOrEqual(32);
    }
  });
});
