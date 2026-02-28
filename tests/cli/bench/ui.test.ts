import { describe, it, expect } from 'vitest';
import { renderResultsSummary, renderComparison, renderRunList } from '../../../src/cli/bench/ui.js';
import type { BenchRunMetrics, RunSummary } from '../../../src/cli/bench/types.js';

function makeMetrics(overrides: Partial<BenchRunMetrics> = {}): BenchRunMetrics {
  return {
    runId: 'test-run-2026',
    timestamp: '2026-02-28T12:00:00Z',
    dataset: 'verified',
    provider: 'zai',
    model: 'glm-5',
    totalTasks: 50,
    resolved: 40,
    failed: 8,
    errors: 1,
    timeouts: 1,
    resolutionRate: 80,
    avgTokensPerTask: { input: 5000, output: 2000 },
    avgToolCallsPerTask: 12,
    avgDurationMs: 45000,
    totalCostEstimate: 3.5,
    totalDurationMs: 2250000,
    taskResults: [],
    ...overrides,
  };
}

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    runId: 'test-run',
    timestamp: '2026-02-28T12:00:00Z',
    dataset: 'verified',
    provider: 'zai',
    model: 'glm-5',
    resolved: 40,
    totalTasks: 50,
    resolutionRate: 80,
    totalCostEstimate: 3.5,
    ...overrides,
  };
}

describe('renderResultsSummary', () => {
  it('should display Mode as naked for non-spiral runs', () => {
    const output = renderResultsSummary(makeMetrics());
    expect(output).toContain('Mode');
    expect(output).toContain('naked');
  });

  it('should display Mode as spiral mode for spiral runs', () => {
    const output = renderResultsSummary(makeMetrics({ spiralMode: 'learning' }));
    expect(output).toContain('Mode');
    expect(output).toContain('learning');
  });

  it('should display Mode as fresh for fresh spiral runs', () => {
    const output = renderResultsSummary(makeMetrics({ spiralMode: 'fresh' }));
    expect(output).toContain('fresh');
  });

  it('should still display core metrics', () => {
    const output = renderResultsSummary(makeMetrics());
    expect(output).toContain('SWE-bench Results');
    expect(output).toContain('Resolution Rate');
    expect(output).toContain('80.0%');
    expect(output).toContain('glm-5');
    expect(output).toContain('verified');
  });
});

describe('renderComparison', () => {
  it('should include Mode column header', () => {
    const runs = [makeMetrics()];
    const output = renderComparison(runs);
    expect(output).toContain('Mode');
  });

  it('should show naked for non-spiral runs', () => {
    const runs = [makeMetrics()];
    const output = renderComparison(runs);
    expect(output).toContain('naked');
  });

  it('should show spiral mode for spiral runs', () => {
    const runs = [makeMetrics({ spiralMode: 'learning' })];
    const output = renderComparison(runs);
    expect(output).toContain('learning');
  });

  it('should differentiate naked and spiral runs side by side', () => {
    const runs = [
      makeMetrics({ runId: 'naked-run' }),
      makeMetrics({ runId: 'spiral-run', spiralMode: 'learning', resolutionRate: 85, resolved: 42 }),
    ];
    const output = renderComparison(runs);
    expect(output).toContain('naked');
    expect(output).toContain('learning');
  });

  it('should return empty message for no runs', () => {
    const output = renderComparison([]);
    expect(output).toContain('No runs to compare');
  });
});

describe('renderRunList', () => {
  it('should show mode for each run', () => {
    const runs = [
      makeSummary({ runId: 'naked-run' }),
      makeSummary({ runId: 'spiral-run', spiralMode: 'learning' }),
    ];
    const output = renderRunList(runs);
    expect(output).toContain('naked');
    expect(output).toContain('learning');
  });

  it('should handle empty run list', () => {
    const output = renderRunList([]);
    expect(output).toContain('No benchmark runs found');
  });

  it('should display mode as naked when spiralMode is undefined', () => {
    const runs = [makeSummary()];
    const output = renderRunList(runs);
    expect(output).toContain('naked');
  });
});
