import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpiralEngine } from '../../src/spiral/engine.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { SpiralConfig } from '../../src/types.js';

function testConfig(dataDir: string): SpiralConfig {
  return {
    dataDir,
    maxTokens: 4000,
    model: 'Xenova/all-MiniLM-L6-v2',
    logLevel: 'error', // Suppress logs in tests
    embeddingDimensions: 384,
    levelThresholds: { l1Min: 0.7, l2Min: 0.5, l3Min: 0.3, l4Min: 0.1 },
    decayRate: 0.05,
    decayIntervalHours: 1,
  };
}

describe('SpiralEngine', () => {
  let engine: SpiralEngine;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-eng-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new SpiralEngine(testConfig(testDir));
    // Note: We don't call initialize() to avoid loading the embedding model in tests.
    // The engine falls back to non-embedding mode gracefully.
  });

  afterEach(() => {
    engine.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  describe('store', () => {
    it('should store context and return result', async () => {
      const result = await engine.store('function hello() { return "world"; }', 'code', {
        file: 'test.ts',
        language: 'typescript',
      });

      expect(result.node_id).toBeDefined();
      expect(result.level).toBe(1);
      expect(result.token_count).toBeGreaterThan(0);
    });

    it('should store with explicit relations', async () => {
      const first = await engine.store('function A() {}', 'code');
      const second = await engine.store('function B() { A(); }', 'code', {}, [first.node_id]);

      expect(second.connections).toBeGreaterThanOrEqual(1);
    });
  });

  describe('query', () => {
    it('should return empty result on empty database', async () => {
      const result = await engine.query('anything');

      expect(result.level_1).toEqual([]);
      expect(result.level_2).toEqual([]);
      expect(result.level_3).toEqual([]);
      expect(result.level_4).toEqual([]);
      expect(result.level_5).toEqual([]);
      expect(result.total_tokens).toBe(0);
    });

    it('should return stored nodes', async () => {
      await engine.store('The database uses SQLite with WAL mode', 'decision');
      await engine.store('function connectDB() { ... }', 'code');

      const result = await engine.query('database connection');

      expect(result.node_count).toBeGreaterThanOrEqual(1);
    });

    it('should respect level filter', async () => {
      await engine.store('test content', 'code');

      const result = await engine.query('test', undefined, [1]);

      // Level 2 and 3 should be empty when filtered
      expect(result.level_2).toEqual([]);
      expect(result.level_3).toEqual([]);
    });
  });

  describe('status', () => {
    it('should return status for empty database', () => {
      const status = engine.status();

      expect(status.total_nodes).toBe(0);
      expect(status.per_level[1]).toBe(0);
      expect(status.per_level[2]).toBe(0);
      expect(status.per_level[3]).toBe(0);
      expect(status.per_level[4]).toBe(0);
      expect(status.per_level[5]).toBe(0);
      expect(status.total_edges).toBe(0);
      expect(status.oldest_node).toBeNull();
      expect(status.newest_node).toBeNull();
    });

    it('should reflect stored nodes', async () => {
      await engine.store('some context', 'code');
      await engine.store('another context', 'decision');

      const status = engine.status();

      expect(status.total_nodes).toBe(2);
      expect(status.per_level[1]).toBe(2);
      expect(status.oldest_node).not.toBeNull();
      expect(status.newest_node).not.toBeNull();
      expect(status.storage_size_bytes).toBeGreaterThan(0);
    });
  });

  describe('compact', () => {
    it('should run without errors on empty database', () => {
      const result = engine.compact(false);
      expect(result.compacted_nodes).toBe(0);
    });
  });

  describe('relate', () => {
    it('should create a relation between nodes', async () => {
      const a = await engine.store('function A', 'code');
      const b = await engine.store('function B', 'code');

      const edge = engine.relate(a.node_id, b.node_id, 'depends_on', 0.8);

      expect(edge.id).toBeDefined();
      expect(edge.source_id).toBe(a.node_id);
      expect(edge.target_id).toBe(b.node_id);
      expect(edge.relation_type).toBe('depends_on');
      expect(edge.weight).toBe(0.8);
    });
  });
});
