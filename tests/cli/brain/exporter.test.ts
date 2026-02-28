import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SpiralEngine } from '../../../src/spiral/engine.js';
import { exportBrainData, type BrainExport } from '../../../src/cli/brain/exporter.js';
import type { SpiralConfig } from '../../../src/types.js';

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

describe('exportBrainData', () => {
  let engine: SpiralEngine;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `helixmind-brain-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new SpiralEngine(testConfig(testDir));
  });

  afterEach(() => {
    engine.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should return valid BrainExport structure', () => {
    const data = exportBrainData(engine, 'Test Project');

    expect(data.meta).toBeDefined();
    expect(data.meta.projectName).toBe('Test Project');
    expect(data.meta.exportDate).toBeTruthy();
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.edges)).toBe(true);
  });

  it('should return empty arrays for empty spiral', () => {
    const data = exportBrainData(engine);
    expect(data.meta.totalNodes).toBe(0);
    expect(data.meta.totalEdges).toBe(0);
    expect(data.nodes).toHaveLength(0);
    expect(data.edges).toHaveLength(0);
  });

  it('should include stored nodes', async () => {
    await engine.store('Test function', 'code', { file: 'test.ts' });
    await engine.store('Architecture decision', 'architecture', { tags: ['design'] });

    const data = exportBrainData(engine);
    expect(data.meta.totalNodes).toBe(2);
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes[0].type).toBeDefined();
    expect(data.nodes[0].level).toBeDefined();
    expect(data.nodes[0].relevanceScore).toBeDefined();
    expect(data.nodes[0].createdAt).toBeDefined();
  });

  it('should include edges between related nodes', async () => {
    const result1 = await engine.store('Function A', 'code');
    const result2 = await engine.store('Function B', 'code');
    engine.relate(result1.node_id, result2.node_id, 'depends_on');

    const data = exportBrainData(engine);
    expect(data.meta.totalEdges).toBeGreaterThanOrEqual(1);
    expect(data.edges.some(e => e.type === 'depends_on')).toBe(true);
  });

  it('should generate node labels from metadata', async () => {
    await engine.store('Some code', 'code', { file: 'src/app.ts' });

    const data = exportBrainData(engine);
    expect(data.nodes[0].label).toBe('src/app.ts');
  });

  it('should include brainScope in meta', () => {
    const globalData = exportBrainData(engine, 'Test', 'global');
    expect(globalData.meta.brainScope).toBe('global');

    const localData = exportBrainData(engine, 'Test', 'project');
    expect(localData.meta.brainScope).toBe('project');
  });

  it('should default brainScope to global', () => {
    const data = exportBrainData(engine);
    expect(data.meta.brainScope).toBe('global');
  });
});
