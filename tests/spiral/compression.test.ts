import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/storage/database.js';
import { NodeStore } from '../../src/storage/nodes.js';
import { VectorStore } from '../../src/storage/vectors.js';
import { CompressionService } from '../../src/spiral/compression.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('CompressionService', () => {
  let db: Database;
  let nodes: NodeStore;
  let vectors: VectorStore;
  let compression: CompressionService;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-comp-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(testDir);
    nodes = new NodeStore(db);
    vectors = new VectorStore(db, 384);
    compression = new CompressionService(nodes, vectors);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  describe('summarizeContent', () => {
    it('should return short content unchanged', () => {
      const content = 'Short content';
      expect(compression.summarizeContent(content)).toBe(content);
    });

    it('should truncate long content to ~200 chars with ellipsis', () => {
      const content = 'A'.repeat(500);
      const summary = compression.summarizeContent(content);
      expect(summary.length).toBe(200);
      expect(summary.endsWith('...')).toBe(true);
    });
  });

  describe('applyDecay', () => {
    it('should not change recently accessed nodes', () => {
      const node = nodes.create({ type: 'code', content: 'fresh code', metadata: {} });
      const decayed = compression.applyDecay(0.05);
      // Recently created node should still be Level 1
      const updated = nodes.getById(node.id);
      expect(updated!.level).toBe(1);
    });

    it('should demote old nodes', () => {
      // Create a node and manually set its accessed_at to 48 hours ago
      const node = nodes.create({ type: 'code', content: 'old code', metadata: {} });
      const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
      db.raw.prepare('UPDATE nodes SET accessed_at = ?, relevance_score = 0.5 WHERE id = ?').run(twoDaysAgo, node.id);

      compression.applyDecay(0.05);

      const updated = nodes.getById(node.id);
      expect(updated!.relevance_score).toBeLessThan(0.5);
    });
  });

  describe('compact', () => {
    it('should return zero changes on empty database', () => {
      const result = compression.compact(false);
      expect(result.compacted_nodes).toBe(0);
      expect(result.freed_tokens).toBe(0);
      expect(result.nodes_deleted).toBe(0);
    });

    it('should compress old Level 2 nodes in aggressive mode', () => {
      const longContent = 'A'.repeat(500);
      const node = nodes.create({ type: 'decision', content: longContent, metadata: {} });

      // Set to level 2 and old
      const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
      db.raw.prepare('UPDATE nodes SET level = 2, accessed_at = ? WHERE id = ?').run(twoDaysAgo, node.id);

      const result = compression.compact(true);
      expect(result.compacted_nodes).toBe(1);
      expect(result.freed_tokens).toBeGreaterThan(0);

      const updated = nodes.getById(node.id);
      expect(updated!.level).toBe(3);
      expect(updated!.summary).toBeDefined();
      expect(updated!.summary!.length).toBeLessThanOrEqual(200);
    });

    it('should move old Level 3 nodes to Level 4 in aggressive mode', () => {
      const node = nodes.create({ type: 'code', content: 'old reference code', metadata: {} });

      // Set to level 3 and 4 days old
      const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
      db.raw.prepare('UPDATE nodes SET level = 3, accessed_at = ? WHERE id = ?').run(fourDaysAgo, node.id);

      const result = compression.compact(true);
      expect(result.compacted_nodes).toBeGreaterThanOrEqual(1);

      const updated = nodes.getById(node.id);
      expect(updated).not.toBeNull();
      expect(updated!.level).toBe(4);
    });

    it('should move old Level 4 nodes to Level 5 in aggressive mode', () => {
      const node = nodes.create({ type: 'code', content: 'archive code', metadata: {} });

      // Set to level 4 and 8 days old
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      db.raw.prepare('UPDATE nodes SET level = 4, accessed_at = ? WHERE id = ?').run(eightDaysAgo, node.id);

      const result = compression.compact(true);
      expect(result.compacted_nodes).toBeGreaterThanOrEqual(1);

      const updated = nodes.getById(node.id);
      expect(updated).not.toBeNull();
      expect(updated!.level).toBe(5);
    });

    it('should only delete Level 5 nodes older than 30 days', () => {
      const node = nodes.create({ type: 'code', content: 'ancient code', metadata: {} });

      // Set to level 5 and 31 days old
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      db.raw.prepare('UPDATE nodes SET level = 5, accessed_at = ? WHERE id = ?').run(thirtyOneDaysAgo, node.id);

      const result = compression.compact(true);
      expect(result.nodes_deleted).toBe(1);
      expect(nodes.getById(node.id)).toBeNull();
    });
  });
});
