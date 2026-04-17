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
  // FIX: WIDE-SPIRAL-005 — ensure dim-mismatch warning fires at most once per process
  private static warnedDimMismatch = false;

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
    // FIX: WIDE-SPIRAL-006 — new DBs get FK + ON DELETE CASCADE so deleting a node
    // automatically cleans up its embedding (prevents orphan rows).
    // FIX: WIDE-SPIRAL-005 — store embedding dimension so we can detect mismatches.
    this.db.raw.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        dim INTEGER NOT NULL DEFAULT 0
      );
    `);

    // FIX: WIDE-SPIRAL-005 — for existing DBs created before dim column, add it.
    try {
      this.db.raw.exec('ALTER TABLE embeddings ADD COLUMN dim INTEGER NOT NULL DEFAULT 0');
    } catch {
      // Column already exists — ignore
    }
  }

  store(nodeId: string, embedding: Float32Array): void {
    const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

    if (this.useVec) {
      this.db.raw.prepare('INSERT OR REPLACE INTO vec_nodes (node_id, embedding) VALUES (?, ?)').run(nodeId, buffer);
    } else {
      // FIX: WIDE-SPIRAL-005 — record embedding dimension alongside the blob.
      this.db.raw.prepare(
        'INSERT OR REPLACE INTO embeddings (node_id, embedding, dim) VALUES (?, ?, ?)',
      ).run(nodeId, buffer, embedding.length);
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
    // FIX: WIDE-SPIRAL-005 — read dim column if available and skip rows whose
    // stored dimension does not match the query embedding's dimension.
    const rows = this.db.raw.prepare(
      'SELECT node_id, embedding, dim FROM embeddings',
    ).all() as Array<{ node_id: string; embedding: Buffer; dim: number | null }>;
    const queryDim = queryEmbedding.length;

    const results: VectorSearchResult[] = [];
    for (const row of rows) {
      const stored = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      );
      // Prefer the recorded dim; if missing (old row w/ dim=0), fall back to byteLength-derived length
      const storedDim = row.dim && row.dim > 0 ? row.dim : stored.length;
      if (storedDim !== queryDim) {
        if (!VectorStore.warnedDimMismatch) {
          VectorStore.warnedDimMismatch = true;
          logger.warn(
            `Vector dimension mismatch detected (stored=${storedDim}, query=${queryDim}). ` +
            `Skipping mismatched rows. Re-index embeddings to fix.`,
          );
        }
        continue;
      }
      const similarity = VectorStore.cosineSimilarity(queryEmbedding, stored);
      // Convert similarity (1=identical) to distance (0=identical) for consistent API
      results.push({ node_id: row.node_id, distance: 1 - similarity });
    }

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
    // FIX: WIDE-SPIRAL-005 — guard against dimension mismatch so we don't silently
    // iterate past the end of the shorter array (returning garbage similarity).
    if (a.length !== b.length) return 0;
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
