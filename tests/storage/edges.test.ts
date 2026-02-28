import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/storage/database.js';
import { NodeStore } from '../../src/storage/nodes.js';
import { EdgeStore } from '../../src/storage/edges.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('EdgeStore', () => {
  let db: Database;
  let nodes: NodeStore;
  let edges: EdgeStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-edge-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(testDir);
    nodes = new NodeStore(db);
    edges = new EdgeStore(db);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY on Windows */ }
  });

  describe('create', () => {
    it('should create an edge between two nodes', () => {
      const n1 = nodes.create({ type: 'code', content: 'function A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'function B', metadata: {} });

      const edge = edges.create({
        source_id: n1.id,
        target_id: n2.id,
        relation_type: 'depends_on',
      });

      expect(edge.id).toBeDefined();
      expect(edge.source_id).toBe(n1.id);
      expect(edge.target_id).toBe(n2.id);
      expect(edge.relation_type).toBe('depends_on');
      expect(edge.weight).toBe(1.0);
    });

    it('should accept custom weight', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });

      const edge = edges.create({
        source_id: n1.id,
        target_id: n2.id,
        relation_type: 'related_to',
        weight: 0.5,
      });

      expect(edge.weight).toBe(0.5);
    });

    it('should prevent duplicate edges (same source, target, type)', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });

      edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'depends_on' });

      expect(() => {
        edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'depends_on' });
      }).toThrow();
    });
  });

  describe('getBySource', () => {
    it('should return all edges from a source node', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });
      const n3 = nodes.create({ type: 'code', content: 'C', metadata: {} });

      edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'depends_on' });
      edges.create({ source_id: n1.id, target_id: n3.id, relation_type: 'related_to' });

      const result = edges.getBySource(n1.id);
      expect(result).toHaveLength(2);
    });
  });

  describe('getByTarget', () => {
    it('should return all edges pointing to a target node', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });
      const n3 = nodes.create({ type: 'code', content: 'C', metadata: {} });

      edges.create({ source_id: n1.id, target_id: n3.id, relation_type: 'depends_on' });
      edges.create({ source_id: n2.id, target_id: n3.id, relation_type: 'related_to' });

      const result = edges.getByTarget(n3.id);
      expect(result).toHaveLength(2);
    });
  });

  describe('getConnected', () => {
    it('should return all edges connected to a node (both directions)', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });
      const n3 = nodes.create({ type: 'code', content: 'C', metadata: {} });

      edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'depends_on' });
      edges.create({ source_id: n3.id, target_id: n1.id, relation_type: 'related_to' });

      const result = edges.getConnected(n1.id);
      expect(result).toHaveLength(2);
    });
  });

  describe('count', () => {
    it('should return total edge count', () => {
      expect(edges.count()).toBe(0);

      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });
      edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'related_to' });

      expect(edges.count()).toBe(1);
    });
  });

  describe('delete', () => {
    it('should remove an edge', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });
      const edge = edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'related_to' });

      edges.delete(edge.id);
      expect(edges.count()).toBe(0);
    });
  });

  describe('cascade delete', () => {
    it('should delete edges when source node is deleted', () => {
      const n1 = nodes.create({ type: 'code', content: 'A', metadata: {} });
      const n2 = nodes.create({ type: 'code', content: 'B', metadata: {} });
      edges.create({ source_id: n1.id, target_id: n2.id, relation_type: 'related_to' });

      expect(edges.count()).toBe(1);
      nodes.delete(n1.id);
      expect(edges.count()).toBe(0);
    });
  });
});
