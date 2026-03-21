import { createHash } from 'node:crypto';
import { logger } from '../utils/logger.js';
import type { EmbeddingStatus } from '../types.js';

type Pipeline = (text: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>;

/**
 * Manages local embedding generation using HuggingFace Transformers.js.
 * Falls back gracefully if the model can't be loaded.
 */
export class EmbeddingService {
  private pipeline: Pipeline | null = null;
  private loading: Promise<void> | null = null;
  private _status: EmbeddingStatus = 'loading';
  private model: string;
  private cache = new Map<string, Float32Array>();
  private static readonly MAX_CACHE = 128;

  constructor(model: string) {
    this.model = model;
    this._status = 'idle';
  }

  get status(): EmbeddingStatus {
    return this._status;
  }

  /**
   * Start loading the model. Now lazy by default — the model is loaded
   * on the first embed() call rather than blocking CLI startup.
   * Calling initialize() explicitly still works for eager preloading.
   */
  async initialize(): Promise<void> {
    if (this.loading) return this.loading;

    this.loading = this.loadModel();
    return this.loading;
  }

  /** Ensure the model is loaded (lazy init on first use) */
  private async ensureLoaded(): Promise<void> {
    if (this.pipeline) return;
    if (this._status === 'fallback') return;
    if (this.loading) { await this.loading; return; }
    await this.initialize();
  }

  private async loadModel(): Promise<void> {
    try {
      logger.info(`Loading embedding model: ${this.model}`);
      const startTime = Date.now();

      const { pipeline } = await import('@huggingface/transformers');
      const extractor = await pipeline('feature-extraction', this.model, {
        dtype: 'q8' as any,
      });

      this.pipeline = extractor as unknown as Pipeline;
      this._status = 'loaded';

      const elapsed = Date.now() - startTime;
      logger.info(`Embedding model loaded in ${elapsed}ms`);
    } catch (err) {
      logger.warn(`Failed to load embedding model: ${err}. Using keyword fallback.`);
      this._status = 'fallback';
      this.pipeline = null;
    }
  }

  /**
   * Dispose the embedding model to free memory (ONNX sessions, WASM buffers).
   */
  async dispose(): Promise<void> {
    if (this.pipeline) {
      try {
        await (this.pipeline as any).dispose?.();
      } catch { /* ignore disposal errors */ }
      this.pipeline = null;
      this._status = 'fallback';
    }
    this.cache.clear();
    this.loading = null;
  }

  /**
   * Generate embedding for a text string.
   * Returns null if embeddings are not available.
   */
  async embed(text: string): Promise<Float32Array | null> {
    // Lazy-load: initialize on first embed() call instead of blocking startup
    await this.ensureLoaded();

    if (!this.pipeline) {
      return null;
    }

    // LRU cache: same input text → return cached embedding
    const key = createHash('sha256').update(text).digest('hex').slice(0, 16);
    const cached = this.cache.get(key);
    if (cached) return new Float32Array(cached);

    try {
      const result = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true,
      });
      const embedding = new Float32Array(result.data);

      // Evict oldest entry if cache is full
      if (this.cache.size >= EmbeddingService.MAX_CACHE) {
        const oldest = this.cache.keys().next().value!;
        this.cache.delete(oldest);
      }
      this.cache.set(key, new Float32Array(embedding));

      return embedding;
    } catch (err) {
      logger.error(`Embedding generation failed: ${err}`);
      return null;
    }
  }
}
