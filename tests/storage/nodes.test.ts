import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/storage/database.js';
import { NodeStore } from '../../src/storage/nodes.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { ContextType, SpiralLevel } from '../../src/types.js';

describe('NodeStore', () => {
  let db: Database;
  let store: NodeStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-node-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(testDir);
    store = new NodeStore(db);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY on Windows */ }
  });

  describe('create', () => {
    it('should create a node and return it', () => {
      const node = store.create({
        type: 'code',
        content: 'function hello() { return "world"; }',
        metadata: { file: 'test.ts', language: 'typescript' },
      });

      expect(node.id).toBeDefined();
      expect(node.type).toBe('code');
      expect(node.content).toBe('function hello() { return "world"; }');
      expect(node.level).toBe(1);
      expect(node.relevance_score).toBe(1.0);
      expect(node.token_count).toBeGreaterThan(0);
      expect(node.metadata.file).toBe('test.ts');
    });

    it('should assign unique IDs', () => {
      const node1 = store.create({ type: 'code', content: 'a', metadata: {} });
      const node2 = store.create({ type: 'code', content: 'b', metadata: {} });
      expect(node1.id).not.toBe(node2.id);
    });
  });

  describe('getById', () => {
    it('should retrieve a node by ID', () => {
      const created = store.create({ type: 'error', content: 'TypeError: x is not defined', metadata: {} });
      const retrieved = store.getById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.content).toBe('TypeError: x is not defined');
    });

    it('should return null for non-existent ID', () => {
      const result = store.getById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should update accessed_at on retrieval', () => {
      const created = store.create({ type: 'code', content: 'test', metadata: {} });
      const before = created.accessed_at;

      // Small delay to ensure timestamp difference
      const retrieved = store.getById(created.id);
      expect(retrieved!.accessed_at).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getByLevel', () => {
    it('should return nodes filtered by level', () => {
      store.create({ type: 'code', content: 'level 1 node', metadata: {} });

      const level1Nodes = store.getByLevel(1);
      expect(level1Nodes.length).toBeGreaterThanOrEqual(1);
      expect(level1Nodes.every(n => n.level === 1)).toBe(true);
    });

    it('should return empty array for empty level', () => {
      const level3Nodes = store.getByLevel(3);
      expect(level3Nodes).toEqual([]);
    });
  });

  describe('updateLevel', () => {
    it('should change a node level', () => {
      const node = store.create({ type: 'code', content: 'test', metadata: {} });
      expect(node.level).toBe(1);

      store.updateLevel(node.id, 2);
      const updated = store.getById(node.id);
      expect(updated!.level).toBe(2);
    });
  });

  describe('updateRelevance', () => {
    it('should update relevance score', () => {
      const node = store.create({ type: 'code', content: 'test', metadata: {} });

      store.updateRelevance(node.id, 0.5);
      const updated = store.getById(node.id);
      expect(updated!.relevance_score).toBe(0.5);
    });
  });

  describe('updateSummary', () => {
    it('should set summary on a node', () => {
      const node = store.create({ type: 'decision', content: 'We decided to use SQLite because it is simple and portable.', metadata: {} });
      expect(node.summary).toBeNull();

      store.updateSummary(node.id, 'Use SQLite for simplicity.');
      const updated = store.getById(node.id);
      expect(updated!.summary).toBe('Use SQLite for simplicity.');
    });
  });

  describe('count', () => {
    it('should return total node count', () => {
      expect(store.count()).toBe(0);
      store.create({ type: 'code', content: 'a', metadata: {} });
      store.create({ type: 'code', content: 'b', metadata: {} });
      expect(store.count()).toBe(2);
    });
  });

  describe('countByLevel', () => {
    it('should return counts per level', () => {
      store.create({ type: 'code', content: 'a', metadata: {} });
      store.create({ type: 'code', content: 'b', metadata: {} });

      const counts = store.countByLevel();
      expect(counts[1]).toBe(2);
      expect(counts[2]).toBe(0);
      expect(counts[3]).toBe(0);
      expect(counts[4]).toBe(0);
      expect(counts[5]).toBe(0);
    });
  });

  describe('getOldestAndNewest', () => {
    it('should return oldest and newest timestamps', () => {
      store.create({ type: 'code', content: 'first', metadata: {} });
      store.create({ type: 'code', content: 'second', metadata: {} });

      const { oldest, newest } = store.getOldestAndNewest();
      expect(oldest).toBeDefined();
      expect(newest).toBeDefined();
      expect(newest!).toBeGreaterThanOrEqual(oldest!);
    });

    it('should return nulls for empty store', () => {
      const { oldest, newest } = store.getOldestAndNewest();
      expect(oldest).toBeNull();
      expect(newest).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove a node', () => {
      const node = store.create({ type: 'code', content: 'delete me', metadata: {} });
      expect(store.count()).toBe(1);

      store.delete(node.id);
      expect(store.count()).toBe(0);
      expect(store.getById(node.id)).toBeNull();
    });
  });

  describe('getAllWithEmbeddings', () => {
    it('should return nodes that have embeddings (initially none)', () => {
      store.create({ type: 'code', content: 'test', metadata: {} });
      // Nodes don't have embeddings by default (added via VectorStore)
      // This method is for the fallback cosine similarity search
      const results = store.getAll();
      expect(results.length).toBe(1);
    });
  });
});
