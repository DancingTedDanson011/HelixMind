import type { Database } from './database.js';
import type { VectorSearchResult } from '../types.js';
import { logger } from '../utils/logger.js';

/**
 * Handles vector storage and similarity search.
 * Uses sqlite-vec extension when available, falls back to JS-based cosine similarity.
 */
export class VectorStore {
  private db: Database;
  private dimensions: number;
  private useVec: boolean;

  constructor(db: Database, dimensions: number) {
    this.db = db;
    this.dimensions = dimensions;
    this.useVec = db.hasVecExtension;

    this.initialize();
  }

  private initialize(): void {
    if (this.useVec) {
      try {
        this.db.raw.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_nodes USING vec0(
            node_id TEXT PRIMARY KEY,
            embedding float[${this.dimensions}] distance_metric=cosine
          );
        `);
        logger.debug('vec_nodes virtual table created');
      } catch (err) {
        logger.warn(`Failed to create vec0 table, using fallback: ${err}`);
        this.useVec = false;
        this.createFallbackTable();
      }
    } else {
      this.createFallbackTable();
    }
  }

  private createFallbackTable(): void {
    this.db.raw.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        node_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL
      );
    `);
  }

  store(nodeId: string, embedding: Float32Array): void {
    const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

    if (this.useVec) {
      this.db.raw.prepare('INSERT OR REPLACE INTO vec_nodes (node_id, embedding) VALUES (?, ?)').run(nodeId, buffer);
    } else {
      this.db.raw.prepare('INSERT OR REPLACE INTO embeddings (node_id, embedding) VALUES (?, ?)').run(nodeId, buffer);
    }
  }

  search(queryEmbedding: Float32Array, limit: number): VectorSearchResult[] {
    const buffer = Buffer.from(queryEmbedding.buffer, queryEmbedding.byteOffset, queryEmbedding.byteLength);

    if (this.useVec) {
      return this.searchVec(buffer, limit);
    }
    return this.searchFallback(queryEmbedding, limit);
  }

  private searchVec(queryBuffer: Buffer, limit: number): VectorSearchResult[] {
    const rows = this.db.raw.prepare(`
      SELECT node_id, distance
      FROM vec_nodes
      WHERE embedding MATCH ?
        AND k = ?
      ORDER BY distance
    `).all(queryBuffer, limit) as Array<{ node_id: string; distance: number }>;

    return rows.map(r => ({ node_id: r.node_id, distance: r.distance }));
  }

  private searchFallback(queryEmbedding: Float32Array, limit: number): VectorSearchResult[] {
    const rows = this.db.raw.prepare('SELECT node_id, embedding FROM embeddings').all() as Array<{ node_id: string; embedding: Buffer }>;

    const results: VectorSearchResult[] = rows.map(row => {
      const stored = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      );
      const similarity = VectorStore.cosineSimilarity(queryEmbedding, stored);
      // Convert similarity (1=identical) to distance (0=identical) for consistent API
      return { node_id: row.node_id, distance: 1 - similarity };
    });

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  delete(nodeId: string): void {
    if (this.useVec) {
      this.db.raw.prepare('DELETE FROM vec_nodes WHERE node_id = ?').run(nodeId);
    } else {
      this.db.raw.prepare('DELETE FROM embeddings WHERE node_id = ?').run(nodeId);
    }
  }

  /**
   * Computes cosine similarity between two vectors.
   * Returns value in range [-1, 1] where 1 = identical.
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return dot / denominator;
  }
}
