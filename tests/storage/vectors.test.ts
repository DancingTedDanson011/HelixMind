import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/storage/database.js';
import { VectorStore } from '../../src/storage/vectors.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('VectorStore', () => {
  let db: Database;
  let vectors: VectorStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-vec-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(testDir);
    vectors = new VectorStore(db, 384);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY on Windows */ }
  });

  function randomEmbedding(dim = 384): Float32Array {
    const arr = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      arr[i] = Math.random() * 2 - 1;
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += arr[i] * arr[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < dim; i++) arr[i] /= norm;
    return arr;
  }

  function similarEmbedding(base: Float32Array, noise = 0.1): Float32Array {
    const arr = new Float32Array(base.length);
    for (let i = 0; i < base.length; i++) {
      arr[i] = base[i] + (Math.random() * 2 - 1) * noise;
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < arr.length; i++) arr[i] /= norm;
    return arr;
  }

  describe('store and search', () => {
    it('should store an embedding and find it via search', () => {
      const emb = randomEmbedding();
      vectors.store('node-1', emb);

      const query = similarEmbedding(emb, 0.01);
      const results = vectors.search(query, 5);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].node_id).toBe('node-1');
      expect(results[0].distance).toBeLessThan(0.1);
    });

    it('should return results sorted by distance (ascending)', () => {
      const base = randomEmbedding();
      const close = similarEmbedding(base, 0.05);
      const far = randomEmbedding();

      vectors.store('close', close);
      vectors.store('far', far);

      const results = vectors.search(base, 5);
      expect(results.length).toBe(2);
      // Close should have smaller distance
      const closeResult = results.find(r => r.node_id === 'close');
      const farResult = results.find(r => r.node_id === 'far');
      expect(closeResult).toBeDefined();
      expect(farResult).toBeDefined();
      expect(closeResult!.distance).toBeLessThan(farResult!.distance);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        vectors.store(`node-${i}`, randomEmbedding());
      }

      const results = vectors.search(randomEmbedding(), 3);
      expect(results.length).toBe(3);
    });
  });

  describe('delete', () => {
    it('should remove an embedding', () => {
      const emb = randomEmbedding();
      vectors.store('node-1', emb);

      vectors.delete('node-1');

      const results = vectors.search(emb, 5);
      expect(results.find(r => r.node_id === 'node-1')).toBeUndefined();
    });
  });

  describe('cosine similarity fallback', () => {
    it('should compute cosine similarity correctly', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);
      expect(VectorStore.cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      expect(VectorStore.cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([-1, 0, 0]);
      expect(VectorStore.cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });
  });
});
