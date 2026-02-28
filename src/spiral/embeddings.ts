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

  constructor(model: string) {
    this.model = model;
  }

  get status(): EmbeddingStatus {
    return this._status;
  }

  /**
   * Start loading the model eagerly. Call this at server startup.
   */
  async initialize(): Promise<void> {
    if (this.loading) return this.loading;

    this.loading = this.loadModel();
    return this.loading;
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
   * Generate embedding for a text string.
   * Returns null if embeddings are not available.
   */
  async embed(text: string): Promise<Float32Array | null> {
    if (this._status === 'loading') {
      await this.loading;
    }

    if (!this.pipeline) {
      return null;
    }

    try {
      const result = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true,
      });
      return new Float32Array(result.data);
    } catch (err) {
      logger.error(`Embedding generation failed: ${err}`);
      return null;
    }
  }
}
