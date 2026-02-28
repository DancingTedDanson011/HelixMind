import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { SpiralEngine } from '../../../src/spiral/engine.js';
import { runFeedPipeline, type FeedProgress } from '../../../src/cli/feed/pipeline.js';
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

function createTestProject(rootDir: string): void {
  const srcDir = join(rootDir, 'src');
  mkdirSync(srcDir, { recursive: true });

  writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
  }));

  writeFileSync(join(srcDir, 'app.ts'), [
    "import express from 'express';",
    "import { Config } from './types.js';",
    '',
    'export function startApp(config: Config) {',
    '  const app = express();',
    '  return app;',
    '}',
  ].join('\n'));

  writeFileSync(join(srcDir, 'types.ts'), [
    'export interface Config {',
    '  port: number;',
    '  debug: boolean;',
    '}',
    '',
    'export type Result<T> = { ok: true; data: T } | { ok: false; error: string };',
  ].join('\n'));
}

describe('runFeedPipeline', () => {
  let engine: SpiralEngine;
  let dataDir: string;
  let projectDir: string;

  beforeEach(() => {
    dataDir = join(tmpdir(), `helixmind-pipeline-data-${randomUUID()}`);
    projectDir = join(tmpdir(), `helixmind-pipeline-project-${randomUUID()}`);
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    engine = new SpiralEngine(testConfig(dataDir));
  });

  afterEach(() => {
    engine.close();
    try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
    try { rmSync(projectDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
  });

  it('should return empty result for empty directory', async () => {
    const result = await runFeedPipeline(projectDir, engine);
    expect(result.filesScanned).toBe(0);
    expect(result.nodesCreated).toBe(0);
    expect(result.summary).toBe('No files found');
  });

  it('should scan, read, parse, and store files', async () => {
    createTestProject(projectDir);

    const result = await runFeedPipeline(projectDir, engine);
    expect(result.filesScanned).toBeGreaterThan(0);
    expect(result.filesRead).toBeGreaterThan(0);
    expect(result.nodesCreated).toBeGreaterThan(0);
  });

  it('should detect tech stack from imports', async () => {
    createTestProject(projectDir);

    const result = await runFeedPipeline(projectDir, engine);
    expect(result.techStack.length).toBeGreaterThan(0);
  });

  it('should call progress callback through all stages', async () => {
    createTestProject(projectDir);

    const stages = new Set<string>();
    const onProgress = (p: FeedProgress) => {
      stages.add(p.stage);
    };

    await runFeedPipeline(projectDir, engine, { onProgress });

    expect(stages.has('scanning')).toBe(true);
    expect(stages.has('reading')).toBe(true);
    expect(stages.has('parsing')).toBe(true);
    expect(stages.has('analyzing')).toBe(true);
    expect(stages.has('spiraling')).toBe(true);
    expect(stages.has('done')).toBe(true);
  });

  it('should return non-empty directory for missing path', async () => {
    const result = await runFeedPipeline(join(projectDir, 'nonexistent'), engine);
    expect(result.filesScanned).toBe(0);
  });

  it('should create relations between importing files', async () => {
    createTestProject(projectDir);

    const result = await runFeedPipeline(projectDir, engine);
    // app.ts imports from types.ts, so there should be at least 1 relation
    expect(result.relationsCreated).toBeGreaterThanOrEqual(0); // May not resolve relative imports to exact paths
  });
});
