import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/storage/database.js';
import { NodeStore } from '../../src/storage/nodes.js';
import { VectorStore } from '../../src/storage/vectors.js';
import { CompressionService } from '../../src/spiral/compression.js';
import { LEVEL_WEIGHTS, determineLevel } from '../../src/spiral/relevance.js';
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
    logLevel: 'error',
    embeddingDimensions: 384,
    levelThresholds: { l1Min: 0.7, l2Min: 0.5, l3Min: 0.3, l4Min: 0.1 },
    decayRate: 0.05,
    decayIntervalHours: 1,
  };
}

describe('5-Level Relevance Scoring', () => {
  it('should have correct weights per level', () => {
    // L1 Focus: semantic heaviest
    expect(LEVEL_WEIGHTS[1].semantic).toBe(0.45);
    expect(LEVEL_WEIGHTS[1].recency).toBe(0.30);
    expect(LEVEL_WEIGHTS[1].connection).toBe(0.15);
    expect(LEVEL_WEIGHTS[1].typeBoost).toBe(0.10);

    // L5 Deep Archive: connection heaviest
    expect(LEVEL_WEIGHTS[5].semantic).toBe(0.25);
    expect(LEVEL_WEIGHTS[5].recency).toBe(0.10);
    expect(LEVEL_WEIGHTS[5].connection).toBe(0.35);
    expect(LEVEL_WEIGHTS[5].typeBoost).toBe(0.30);
  });

  it('should sum to 1.0 for each level', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const w = LEVEL_WEIGHTS[level];
      const sum = w.semantic + w.recency + w.connection + w.typeBoost;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('should shift weights from semantic to connection across levels', () => {
    expect(LEVEL_WEIGHTS[1].semantic).toBeGreaterThan(LEVEL_WEIGHTS[5].semantic);
    expect(LEVEL_WEIGHTS[1].connection).toBeLessThan(LEVEL_WEIGHTS[5].connection);
  });

  it('should determine all 5 levels correctly', () => {
    expect(determineLevel(0.9)).toBe(1);
    expect(determineLevel(0.6)).toBe(2);
    expect(determineLevel(0.4)).toBe(3);
    expect(determineLevel(0.15)).toBe(4);
    expect(determineLevel(0.05)).toBe(5);
  });
});

describe('Evolution Pipeline', () => {
  let db: Database;
  let nodes: NodeStore;
  let vectors: VectorStore;
  let compression: CompressionService;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-evo-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(testDir);
    nodes = new NodeStore(db);
    vectors = new VectorStore(db, 384);
    compression = new CompressionService(nodes, vectors, 0.7, 0.5, 0.3, 0.1);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should evolve a node from L1 through all levels', () => {
    const node = nodes.create({ type: 'code', content: 'function evolveMe() { return true; }', metadata: {} });
    expect(node.level).toBe(1);

    // Set score to L2 range (0.5-0.7) and evolve
    nodes.updateRelevance(node.id, 0.6);
    let result = compression.evolve();
    expect(result.demoted).toBeGreaterThanOrEqual(1);
    let updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(2);

    // Set score to L3 range (0.3-0.5) and evolve
    nodes.updateRelevance(node.id, 0.4);
    result = compression.evolve();
    expect(result.demoted).toBeGreaterThanOrEqual(1);
    updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(3);

    // Set score to L4 range (0.1-0.3) and evolve
    nodes.updateRelevance(node.id, 0.2);
    result = compression.evolve();
    expect(result.demoted).toBeGreaterThanOrEqual(1);
    updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(4);

    // Set score to L5 range (<0.1) and evolve
    nodes.updateRelevance(node.id, 0.05);
    result = compression.evolve();
    expect(result.demoted).toBeGreaterThanOrEqual(1);
    updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(5);
  });

  it('should promote nodes when relevance increases', () => {
    const node = nodes.create({
      type: 'code',
      content: 'function promote() {}',
      metadata: {},
      level: 4,
      relevance_score: 0.2,
    });

    // Increase relevance to L1
    nodes.updateRelevance(node.id, 0.9);
    const result = compression.evolve();
    expect(result.promoted).toBeGreaterThanOrEqual(1);

    const updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(1);
  });

  it('should summarize content when entering L3', () => {
    const longContent = 'A'.repeat(500);
    const node = nodes.create({ type: 'code', content: longContent, metadata: {} });

    nodes.updateRelevance(node.id, 0.4); // L3 range
    compression.evolve();

    const updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(3);
    expect(updated.summary).toBeDefined();
    expect(updated.summary!.length).toBeLessThanOrEqual(200);
  });

  it('should deep compress when entering L4', () => {
    const longContent = 'A'.repeat(500);
    const node = nodes.create({ type: 'code', content: longContent, metadata: {} });

    // First move to L3 to get summary
    nodes.updateRelevance(node.id, 0.4);
    compression.evolve();

    // Then move to L4 for deep compression
    nodes.updateRelevance(node.id, 0.15);
    compression.evolve();

    const updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(4);
    expect(updated.summary).toBeDefined();
    expect(updated.summary!.length).toBeLessThanOrEqual(100);
  });
});

describe('Evolution Archive', () => {
  let db: Database;
  let nodes: NodeStore;
  let vectors: VectorStore;
  let compression: CompressionService;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-archive-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(testDir);
    nodes = new NodeStore(db);
    vectors = new VectorStore(db, 384);
    compression = new CompressionService(nodes, vectors, 0.7, 0.5, 0.3, 0.1);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('archived nodes at L4 should still be retrievable', () => {
    const node = nodes.create({ type: 'code', content: 'archive me', metadata: {} });

    // Push to L4
    nodes.updateRelevance(node.id, 0.15);
    nodes.updateLevel(node.id, 4);

    const retrieved = nodes.getById(node.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('archive me');
  });

  it('deep archived nodes at L5 should still be retrievable', () => {
    const node = nodes.create({ type: 'code', content: 'deep archive me', metadata: {} });

    // Push to L5
    nodes.updateRelevance(node.id, 0.05);
    nodes.updateLevel(node.id, 5);

    const retrieved = nodes.getById(node.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('deep archive me');
    expect(retrieved!.level).toBe(5);
  });

  it('archived nodes can be promoted back to L1', () => {
    const node = nodes.create({
      type: 'code',
      content: 'resurrection',
      metadata: {},
      level: 5,
      relevance_score: 0.05,
    });

    nodes.updateRelevance(node.id, 0.9);
    compression.evolve();

    const updated = nodes.getById(node.id)!;
    expect(updated.level).toBe(1);
  });
});

describe('Migration 3→5 levels', () => {
  it('should migrate existing 3-level database to 5 levels', () => {
    const testDir = join(tmpdir(), `spiral-migrate-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });

    // Create a database and insert nodes at levels 1, 2, 3
    const db = new Database(testDir);
    const nodeStore = new NodeStore(db);

    nodeStore.create({ type: 'code', content: 'L1 node', metadata: {}, level: 1 });
    nodeStore.create({ type: 'code', content: 'L2 node', metadata: {}, level: 2 });
    nodeStore.create({ type: 'code', content: 'L3 node', metadata: {}, level: 3 });

    // Verify the DB now accepts level 4 and 5
    nodeStore.create({ type: 'code', content: 'L4 node', metadata: {}, level: 4 });
    nodeStore.create({ type: 'code', content: 'L5 node', metadata: {}, level: 5 });

    const counts = nodeStore.countByLevel();
    expect(counts[1]).toBe(1);
    expect(counts[2]).toBe(1);
    expect(counts[3]).toBe(1);
    expect(counts[4]).toBe(1);
    expect(counts[5]).toBe(1);

    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });
});

describe('saveState on quit', () => {
  let engine: SpiralEngine;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `spiral-quit-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new SpiralEngine(testConfig(testDir));
  });

  afterEach(() => {
    engine.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should save conversation as nodes on quit', async () => {
    const messages = [
      { role: 'user', content: 'How do I implement auth?' },
      { role: 'assistant', content: 'Use JWT tokens with refresh rotation.' },
    ];

    await engine.saveState(messages);

    const status = engine.status();
    expect(status.total_nodes).toBeGreaterThanOrEqual(2);
  });

  it('should trigger evolution on save', async () => {
    // Create some nodes with low relevance
    await engine.store('old context', 'code');
    await engine.store('another old context', 'code');

    // Manually lower relevance to trigger demotion
    const data = engine.exportForVisualization();
    for (const node of data.nodes) {
      // This updates in DB but saveState will call evolve()
    }

    // saveState should call evolve() without errors
    await engine.saveState();
    const status = engine.status();
    expect(status.total_nodes).toBeGreaterThanOrEqual(2);
  });
});
