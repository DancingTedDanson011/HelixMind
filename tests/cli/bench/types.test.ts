import { describe, it, expect } from 'vitest';
import type { BenchConfig, BenchRunMetrics, RunSummary } from '../../../src/cli/bench/types.js';

describe('BenchConfig types', () => {
  it('should accept config without spiral fields', () => {
    const config: BenchConfig = {
      dataset: 'lite',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      apiKey: 'test-key',
      maxIterations: 30,
      timeoutSeconds: 600,
      parallelism: 1,
      outputDir: '/tmp/bench',
      runId: 'test-run',
    };

    expect(config.withSpiral).toBeUndefined();
    expect(config.spiralMode).toBeUndefined();
  });

  it('should accept config with spiral fields', () => {
    const config: BenchConfig = {
      dataset: 'verified',
      provider: 'zai',
      model: 'glm-5',
      apiKey: 'test-key',
      maxIterations: 25,
      timeoutSeconds: 900,
      parallelism: 1,
      outputDir: '/tmp/bench',
      runId: 'spiral-run',
      withSpiral: true,
      spiralMode: 'learning',
    };

    expect(config.withSpiral).toBe(true);
    expect(config.spiralMode).toBe('learning');
  });

  it('should accept fresh spiral mode', () => {
    const config: BenchConfig = {
      dataset: 'lite',
      provider: 'anthropic',
      model: 'test',
      apiKey: 'key',
      maxIterations: 10,
      timeoutSeconds: 300,
      parallelism: 1,
      outputDir: '/tmp',
      runId: 'r1',
      withSpiral: true,
      spiralMode: 'fresh',
    };

    expect(config.spiralMode).toBe('fresh');
  });
});

describe('BenchRunMetrics types', () => {
  it('should include spiralMode field', () => {
    const metrics: BenchRunMetrics = {
      runId: 'test',
      timestamp: new Date().toISOString(),
      dataset: 'lite',
      provider: 'anthropic',
      model: 'test',
      totalTasks: 5,
      resolved: 3,
      failed: 1,
      errors: 1,
      timeouts: 0,
      resolutionRate: 60,
      avgTokensPerTask: { input: 1000, output: 500 },
      avgToolCallsPerTask: 5,
      avgDurationMs: 30000,
      totalCostEstimate: 0.5,
      totalDurationMs: 150000,
      taskResults: [],
      spiralMode: 'learning',
    };

    expect(metrics.spiralMode).toBe('learning');
  });

  it('should allow undefined spiralMode for naked runs', () => {
    const metrics: BenchRunMetrics = {
      runId: 'naked-run',
      timestamp: new Date().toISOString(),
      dataset: 'verified',
      provider: 'zai',
      model: 'glm-5',
      totalTasks: 10,
      resolved: 8,
      failed: 2,
      errors: 0,
      timeouts: 0,
      resolutionRate: 80,
      avgTokensPerTask: { input: 2000, output: 1000 },
      avgToolCallsPerTask: 8,
      avgDurationMs: 45000,
      totalCostEstimate: 1.5,
      totalDurationMs: 450000,
      taskResults: [],
    };

    expect(metrics.spiralMode).toBeUndefined();
  });
});

describe('RunSummary types', () => {
  it('should include spiralMode field', () => {
    const summary: RunSummary = {
      runId: 'test',
      timestamp: new Date().toISOString(),
      dataset: 'lite',
      provider: 'anthropic',
      model: 'test',
      resolved: 3,
      totalTasks: 5,
      resolutionRate: 60,
      totalCostEstimate: 0.5,
      spiralMode: 'fresh',
    };

    expect(summary.spiralMode).toBe('fresh');
  });

  it('should allow undefined spiralMode', () => {
    const summary: RunSummary = {
      runId: 'test',
      timestamp: new Date().toISOString(),
      dataset: 'lite',
      provider: 'anthropic',
      model: 'test',
      resolved: 3,
      totalTasks: 5,
      resolutionRate: 60,
      totalCostEstimate: 0.5,
    };

    expect(summary.spiralMode).toBeUndefined();
  });
});
