import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../../src/spiral/embeddings.js';

describe('EmbeddingService — LRU Cache', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService('test-model');
  });

  it('should return cached embedding on second call with same text', async () => {
    // Inject a mock pipeline that tracks call count
    let callCount = 0;
    const mockData = new Float32Array([0.1, 0.2, 0.3]);
    (service as any).pipeline = async () => {
      callCount++;
      return { data: mockData };
    };
    (service as any)._status = 'loaded';

    const first = await service.embed('hello world');
    const second = await service.embed('hello world');

    expect(callCount).toBe(1); // Pipeline called only once
    expect(first).toEqual(second);
    expect(first).not.toBe(second); // Different Float32Array instances (copy)
  });

  it('should call pipeline for different texts', async () => {
    let callCount = 0;
    (service as any).pipeline = async () => {
      callCount++;
      return { data: new Float32Array([callCount]) };
    };
    (service as any)._status = 'loaded';

    await service.embed('text one');
    await service.embed('text two');

    expect(callCount).toBe(2);
  });

  it('should evict oldest entry when cache exceeds MAX_CACHE', async () => {
    let callCount = 0;
    (service as any).pipeline = async () => {
      callCount++;
      return { data: new Float32Array([callCount]) };
    };
    (service as any)._status = 'loaded';

    // Fill cache to max
    for (let i = 0; i < 128; i++) {
      await service.embed(`text-${i}`);
    }
    expect(callCount).toBe(128);

    // Add one more — should evict oldest
    await service.embed('text-new');
    expect(callCount).toBe(129);
    expect((service as any).cache.size).toBe(128);

    // Re-embed the first text — should require pipeline call (was evicted)
    await service.embed('text-0');
    expect(callCount).toBe(130);
  });

  it('should clear cache on dispose', async () => {
    (service as any).pipeline = async () => ({ data: new Float32Array([1]) });
    (service as any)._status = 'loaded';

    await service.embed('test');
    expect((service as any).cache.size).toBe(1);

    await service.dispose();
    expect((service as any).cache.size).toBe(0);
  });

  it('should return null when pipeline is not loaded', async () => {
    (service as any)._status = 'fallback';
    (service as any).pipeline = null;

    const result = await service.embed('test');
    expect(result).toBeNull();
  });
});
