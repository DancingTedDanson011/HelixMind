import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../../../src/cli/bench/metrics.js';
import type { BenchConfig, TaskResult } from '../../../src/cli/bench/types.js';

function makeConfig(overrides: Partial<BenchConfig> = {}): BenchConfig {
  return {
    dataset: 'lite',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    apiKey: 'test-key',
    maxIterations: 30,
    timeoutSeconds: 600,
    parallelism: 1,
    outputDir: '/tmp/bench',
    runId: 'test-run',
    ...overrides,
  };
}

function makeTaskResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    instance_id: 'test__test-1',
    status: 'resolved',
    model_patch: 'diff --git a/test.py b/test.py\n+fix',
    tokens: { input: 1000, output: 500 },
    toolCalls: 5,
    steps: [],
    errors: [],
    durationMs: 30000,
    agentText: 'Fixed the bug.',
    ...overrides,
  };
}

describe('computeMetrics', () => {
  it('should return spiralMode undefined for naked runs', () => {
    const config = makeConfig();
    const results = [makeTaskResult()];

    const metrics = computeMetrics(config, results);

    expect(metrics.spiralMode).toBeUndefined();
  });

  it('should return spiralMode "fresh" for fresh spiral runs', () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'fresh' });
    const results = [makeTaskResult()];

    const metrics = computeMetrics(config, results);

    expect(metrics.spiralMode).toBe('fresh');
  });

  it('should return spiralMode "learning" for learning spiral runs', () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    const results = [makeTaskResult(), makeTaskResult({ status: 'failed' })];

    const metrics = computeMetrics(config, results);

    expect(metrics.spiralMode).toBe('learning');
  });

  it('should default spiralMode to "fresh" when withSpiral is true but spiralMode is undefined', () => {
    const config = makeConfig({ withSpiral: true });
    const results = [makeTaskResult()];

    const metrics = computeMetrics(config, results);

    expect(metrics.spiralMode).toBe('fresh');
  });

  it('should still compute resolution rate correctly with spiral', () => {
    const config = makeConfig({ withSpiral: true, spiralMode: 'learning' });
    const results = [
      makeTaskResult({ status: 'resolved' }),
      makeTaskResult({ status: 'resolved' }),
      makeTaskResult({ status: 'failed' }),
      makeTaskResult({ status: 'error' }),
    ];

    const metrics = computeMetrics(config, results);

    expect(metrics.totalTasks).toBe(4);
    expect(metrics.resolved).toBe(2);
    expect(metrics.failed).toBe(1);
    expect(metrics.errors).toBe(1);
    expect(metrics.resolutionRate).toBe(50);
  });
});
