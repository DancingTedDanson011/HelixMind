import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { writeSummary, listRuns, loadRunSummary, getCompletedTaskIds } from '../../../src/cli/bench/output.js';
import type { BenchRunMetrics } from '../../../src/cli/bench/types.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `bench-output-test-${randomUUID()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch { /* EBUSY */ }
});

function makeMetrics(overrides: Partial<BenchRunMetrics> = {}): BenchRunMetrics {
  return {
    runId: 'test-run',
    timestamp: '2026-02-28T12:00:00Z',
    dataset: 'verified',
    provider: 'zai',
    model: 'glm-5',
    totalTasks: 10,
    resolved: 8,
    failed: 1,
    errors: 1,
    timeouts: 0,
    resolutionRate: 80,
    avgTokensPerTask: { input: 5000, output: 2000 },
    avgToolCallsPerTask: 12,
    avgDurationMs: 45000,
    totalCostEstimate: 1.5,
    totalDurationMs: 450000,
    taskResults: [],
    ...overrides,
  };
}

describe('writeSummary + loadRunSummary', () => {
  it('should persist and load spiralMode', () => {
    const outputDir = join(testDir, 'runs', 'spiral-run');
    mkdirSync(outputDir, { recursive: true });

    writeSummary(outputDir, makeMetrics({ spiralMode: 'learning' }));

    // Read raw to verify JSON
    const raw = JSON.parse(readFileSync(join(outputDir, 'summary.json'), 'utf-8'));
    expect(raw.spiralMode).toBe('learning');
  });

  it('should persist undefined spiralMode as absent key', () => {
    const outputDir = join(testDir, 'runs', 'naked-run');
    mkdirSync(outputDir, { recursive: true });

    writeSummary(outputDir, makeMetrics());

    const raw = JSON.parse(readFileSync(join(outputDir, 'summary.json'), 'utf-8'));
    expect(raw.spiralMode).toBeUndefined();
  });
});

describe('listRuns', () => {
  it('should parse spiralMode from summary', () => {
    const runsDir = join(testDir, 'runs');
    const runDir = join(runsDir, 'my-run');
    mkdirSync(runDir, { recursive: true });

    writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
      runId: 'my-run',
      timestamp: '2026-02-28T12:00:00Z',
      dataset: 'verified',
      provider: 'zai',
      model: 'glm-5',
      resolved: 8,
      totalTasks: 10,
      resolutionRate: 80,
      totalCostEstimate: 1.5,
      spiralMode: 'fresh',
    }));

    const runs = listRuns(testDir);
    expect(runs).toHaveLength(1);
    expect(runs[0].spiralMode).toBe('fresh');
  });

  it('should return undefined spiralMode for old runs without it', () => {
    const runsDir = join(testDir, 'runs');
    const runDir = join(runsDir, 'old-run');
    mkdirSync(runDir, { recursive: true });

    writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
      runId: 'old-run',
      timestamp: '2026-01-01T00:00:00Z',
      dataset: 'lite',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      resolved: 3,
      totalTasks: 5,
      resolutionRate: 60,
      totalCostEstimate: 0.5,
      // No spiralMode field
    }));

    const runs = listRuns(testDir);
    expect(runs).toHaveLength(1);
    expect(runs[0].spiralMode).toBeUndefined();
  });

  it('should load spiralMode from loadRunSummary', () => {
    const runsDir = join(testDir, 'runs');
    const runDir = join(runsDir, 'spiral-learning');
    mkdirSync(runDir, { recursive: true });

    writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
      runId: 'spiral-learning',
      timestamp: '2026-02-28T12:00:00Z',
      dataset: 'verified',
      provider: 'zai',
      model: 'glm-5',
      resolved: 42,
      totalTasks: 50,
      resolutionRate: 84,
      totalCostEstimate: 5.0,
      spiralMode: 'learning',
    }));

    const metrics = loadRunSummary(testDir, 'spiral-learning');
    expect(metrics).not.toBeNull();
    expect(metrics!.spiralMode).toBe('learning');
  });
});

describe('getCompletedTaskIds', () => {
  it('should return empty set for non-existent dir', () => {
    const ids = getCompletedTaskIds(join(testDir, 'nonexistent'));
    expect(ids.size).toBe(0);
  });

  it('should return resolved and failed task IDs', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'results.jsonl'), [
      JSON.stringify({ instance_id: 'task-1', status: 'resolved', tokens: { input: 100, output: 50 } }),
      JSON.stringify({ instance_id: 'task-2', status: 'failed', tokens: { input: 200, output: 80 } }),
      JSON.stringify({ instance_id: 'task-3', status: 'error', tokens: { input: 50, output: 0 } }),
      JSON.stringify({ instance_id: 'task-4', status: 'timeout', tokens: { input: 300, output: 100 } }),
    ].join('\n'));

    const ids = getCompletedTaskIds(testDir);
    // Only resolved and failed count as completed (not error/timeout)
    expect(ids.has('task-1')).toBe(true);
    expect(ids.has('task-2')).toBe(true);
    expect(ids.has('task-3')).toBe(false);
    expect(ids.has('task-4')).toBe(false);
    expect(ids.size).toBe(2);
  });

  it('should handle malformed JSONL lines', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'results.jsonl'),
      JSON.stringify({ instance_id: 'good-task', status: 'resolved' }) + '\n' +
      'not json\n' +
      JSON.stringify({ instance_id: 'also-good', status: 'resolved' }) + '\n'
    );

    const ids = getCompletedTaskIds(testDir);
    expect(ids.size).toBe(2);
    expect(ids.has('good-task')).toBe(true);
    expect(ids.has('also-good')).toBe(true);
  });

  it('should return empty set for empty results file', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'results.jsonl'), '');

    const ids = getCompletedTaskIds(testDir);
    expect(ids.size).toBe(0);
  });
});
